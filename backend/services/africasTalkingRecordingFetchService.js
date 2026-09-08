const dns =
  require("node:dns").promises;

const net =
  require("node:net");


const SERVICE_VERSION =
  "voicebridge-africastalking-recording-fetch-v1";

const DEFAULT_TIMEOUT_MS =
  15000;

const DEFAULT_MAX_BYTES =
  25 * 1024 * 1024;

const DEFAULT_MAX_REDIRECTS =
  2;

const REDIRECT_STATUSES =
  new Set([
    301,
    302,
    303,
    307,
    308,
  ]);

const SUPPORTED_CONTENT_TYPES =
  new Map([
    ["audio/wav", {
      mimeType: "audio/wav",
      extension: ".wav",
    }],
    ["audio/x-wav", {
      mimeType: "audio/wav",
      extension: ".wav",
    }],
    ["audio/mpeg", {
      mimeType: "audio/mpeg",
      extension: ".mp3",
    }],
    ["audio/mp3", {
      mimeType: "audio/mpeg",
      extension: ".mp3",
    }],
  ]);


class AfricasTalkingRecordingFetchError
  extends Error {

  constructor(
    code,
    message,
    {
      statusCode = 502,
    } = {}
  ) {

    super(message);

    this.name =
      "AfricasTalkingRecordingFetchError";

    this.code =
      code;

    this.statusCode =
      statusCode;

    this.isOperational =
      true;
  }
}


const toText = (
  value
) =>
  typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();


const isBlockedIpv4 = (
  address
) => {

  const parts =
    address
      .split(".")
      .map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (value) =>
        !Number.isInteger(value) ||
        value < 0 ||
        value > 255
    )
  ) {
    return true;
  }

  const [
    a,
    b,
  ] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (
      a === 100 &&
      b >= 64 &&
      b <= 127
    ) ||
    (
      a === 169 &&
      b === 254
    ) ||
    (
      a === 172 &&
      b >= 16 &&
      b <= 31
    ) ||
    (
      a === 192 &&
      b === 168
    ) ||
    (
      a === 192 &&
      b === 0
    ) ||
    (
      a === 192 &&
      b === 0 &&
      parts[2] === 2
    ) ||
    (
      a === 198 &&
      (
        b === 18 ||
        b === 19 ||
        b === 51
      )
    ) ||
    (
      a === 203 &&
      b === 0 &&
      parts[2] === 113
    ) ||
    a >= 224
  );
};


const isBlockedIpv6 = (
  address
) => {

  const text =
    String(address || "")
      .toLowerCase();

  if (
    text === "::" ||
    text === "::1"
  ) {
    return true;
  }

  if (
    text.startsWith("fc") ||
    text.startsWith("fd") ||
    text.startsWith("fe8") ||
    text.startsWith("fe9") ||
    text.startsWith("fea") ||
    text.startsWith("feb") ||
    text.startsWith("ff") ||
    text.startsWith("2001:db8:")
  ) {
    return true;
  }

  if (
    text.startsWith("::ffff:")
  ) {

    const mapped =
      text.slice(
        "::ffff:".length
      );

    return (
      net.isIP(mapped) === 4
        ? isBlockedIpv4(mapped)
        : true
    );
  }

  return false;
};


const isBlockedAddress = (
  address
) => {

  const family =
    net.isIP(
      String(address || "")
    );

  if (family === 4) {
    return isBlockedIpv4(
      address
    );
  }

  if (family === 6) {
    return isBlockedIpv6(
      address
    );
  }

  return true;
};


const validatePublicHttpsUrl =
  async (
    value,
    {
      lookupImpl =
        dns.lookup,
    } = {}
  ) => {

    const raw =
      toText(value);

    if (!raw) {
      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_RECORDING_URL_REQUIRED",
        "Recording URL is required.",
        {
          statusCode: 400,
        }
      );
    }

    let parsed;

    try {

      parsed =
        new URL(raw);

    } catch {

      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_INVALID_RECORDING_URL",
        "Recording URL must be a valid HTTPS URL.",
        {
          statusCode: 400,
        }
      );
    }

    if (
      parsed.protocol !==
        "https:"
    ) {

      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_INSECURE_RECORDING_URL",
        "Recording URL must use HTTPS.",
        {
          statusCode: 400,
        }
      );
    }

    if (
      parsed.username ||
      parsed.password
    ) {

      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_RECORDING_URL_CREDENTIALS",
        "Recording URL must not contain embedded credentials.",
        {
          statusCode: 400,
        }
      );
    }

    if (
      parsed.port &&
      parsed.port !== "443"
    ) {

      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_RECORDING_URL_PORT",
        "Recording URL must use the standard HTTPS port.",
        {
          statusCode: 400,
        }
      );
    }

    /*
     * Do not accept literal IP URLs.
     * Provider recording URLs should use a
     * hostname with valid TLS.
     */
    if (
      net.isIP(
        parsed.hostname
      )
    ) {

      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_RECORDING_IP_LITERAL_BLOCKED",
        "Recording URL must use a public hostname.",
        {
          statusCode: 400,
        }
      );
    }

    let resolved;

    try {

      resolved =
        await lookupImpl(
          parsed.hostname,
          {
            all: true,
            verbatim: true,
          }
        );

    } catch {

      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_RECORDING_DNS_FAILED",
        "Recording host could not be resolved."
      );
    }

    if (
      !Array.isArray(resolved) ||
      resolved.length === 0
    ) {

      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_RECORDING_DNS_FAILED",
        "Recording host did not resolve to a public address."
      );
    }

    if (
      resolved.some(
        (entry) =>
          isBlockedAddress(
            entry?.address
          )
      )
    ) {

      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_RECORDING_PRIVATE_ADDRESS_BLOCKED",
        "Recording host resolved to a private or reserved address.",
        {
          statusCode: 400,
        }
      );
    }

    return parsed;
  };


const contentTypeWithoutParameters =
  (
    value
  ) =>
    toText(value)
      .toLowerCase()
      .split(";")[0]
      .trim();


const inferAudioFormat = ({
  contentType,
  url,
}) => {

  const normalized =
    contentTypeWithoutParameters(
      contentType
    );

  if (
    SUPPORTED_CONTENT_TYPES.has(
      normalized
    )
  ) {

    return (
      SUPPORTED_CONTENT_TYPES.get(
        normalized
      )
    );
  }

  let pathname = "";

  try {

    pathname =
      new URL(url)
        .pathname
        .toLowerCase();

  } catch {
    pathname = "";
  }

  /*
   * Some recording/CDN endpoints may return
   * application/octet-stream. In that case,
   * permit only an explicit WAV or MP3 path.
   */
  if (
    !normalized ||
    normalized ===
      "application/octet-stream"
  ) {

    if (
      pathname.endsWith(".wav")
    ) {
      return {
        mimeType:
          "audio/wav",
        extension:
          ".wav",
      };
    }

    if (
      pathname.endsWith(".mp3")
    ) {
      return {
        mimeType:
          "audio/mpeg",
        extension:
          ".mp3",
      };
    }
  }

  throw new AfricasTalkingRecordingFetchError(
    "AFRICASTALKING_UNSUPPORTED_RECORDING_TYPE",
    "Recording must be WAV or MP3 audio.",
    {
      statusCode: 415,
    }
  );
};


const readBodyLimited =
  async (
    response,
    {
      maxBytes,
    }
  ) => {

    const declaredLength =
      Number(
        response?.headers
          ?.get?.(
            "content-length"
          )
      );

    if (
      Number.isFinite(
        declaredLength
      ) &&
      declaredLength >
        maxBytes
    ) {

      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_RECORDING_TOO_LARGE",
        "Recording exceeds the maximum permitted size.",
        {
          statusCode: 413,
        }
      );
    }

    if (!response?.body) {

      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_RECORDING_EMPTY",
        "Recording response contained no audio."
      );
    }

    const chunks = [];
    let total = 0;

    try {

      for await (
        const chunk of
        response.body
      ) {

        const buffer =
          Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk);

        total +=
          buffer.length;

        if (
          total >
          maxBytes
        ) {

          throw new AfricasTalkingRecordingFetchError(
            "AFRICASTALKING_RECORDING_TOO_LARGE",
            "Recording exceeds the maximum permitted size.",
            {
              statusCode: 413,
            }
          );
        }

        chunks.push(
          buffer
        );
      }

    } catch (error) {

      if (
        error instanceof
          AfricasTalkingRecordingFetchError
      ) {
        throw error;
      }

      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_RECORDING_READ_FAILED",
        "Recording audio could not be read."
      );
    }

    if (total === 0) {

      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_RECORDING_EMPTY",
        "Recording response contained no audio."
      );
    }

    return Buffer.concat(
      chunks,
      total
    );
  };


const fetchRecordingIntoMemory =
  async (
    recordingUrl,
    {
      fetchImpl =
        global.fetch,

      lookupImpl =
        dns.lookup,

      timeoutMs =
        DEFAULT_TIMEOUT_MS,

      maxBytes =
        DEFAULT_MAX_BYTES,

      maxRedirects =
        DEFAULT_MAX_REDIRECTS,
    } = {}
  ) => {

    if (
      typeof fetchImpl !==
        "function"
    ) {

      throw new AfricasTalkingRecordingFetchError(
        "AFRICASTALKING_RECORDING_FETCH_UNAVAILABLE",
        "Recording fetch is unavailable."
      );
    }

    let current =
      await validatePublicHttpsUrl(
        recordingUrl,
        {
          lookupImpl,
        }
      );

    let redirectsFollowed =
      0;

    while (true) {

      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () =>
            controller.abort(),
          timeoutMs
        );

      timeout.unref?.();

      let response;

      try {

        response =
          await fetchImpl(
            current.toString(),
            {
              method:
                "GET",

              redirect:
                "manual",

              signal:
                controller.signal,

              headers: {
                Accept:
                  "audio/wav, audio/x-wav, audio/mpeg, audio/mp3, application/octet-stream;q=0.5",
              },
            }
          );

      } catch (error) {

        const timedOut =
          error?.name ===
            "AbortError" ||
          /timed?\s*out|timeout/i
            .test(
              String(
                error?.message ||
                ""
              )
            );

        throw new AfricasTalkingRecordingFetchError(
          timedOut
            ? "AFRICASTALKING_RECORDING_FETCH_TIMEOUT"
            : "AFRICASTALKING_RECORDING_FETCH_FAILED",
          timedOut
            ? "Recording download timed out."
            : "Recording could not be downloaded.",
          {
            statusCode:
              timedOut
                ? 504
                : 502,
          }
        );

      } finally {

        clearTimeout(
          timeout
        );
      }

      const status =
        Number(
          response?.status ||
          0
        );

      if (
        REDIRECT_STATUSES.has(
          status
        )
      ) {

        if (
          redirectsFollowed >=
          maxRedirects
        ) {

          throw new AfricasTalkingRecordingFetchError(
            "AFRICASTALKING_RECORDING_TOO_MANY_REDIRECTS",
            "Recording download exceeded the redirect limit."
          );
        }

        const location =
          response?.headers
            ?.get?.(
              "location"
            );

        if (!location) {

          throw new AfricasTalkingRecordingFetchError(
            "AFRICASTALKING_RECORDING_REDIRECT_INVALID",
            "Recording redirect did not contain a destination."
          );
        }

        const nextUrl =
          new URL(
            location,
            current
          );

        current =
          await validatePublicHttpsUrl(
            nextUrl.toString(),
            {
              lookupImpl,
            }
          );

        redirectsFollowed += 1;

        continue;
      }

      if (
        !response?.ok
      ) {

        throw new AfricasTalkingRecordingFetchError(
          "AFRICASTALKING_RECORDING_UPSTREAM_ERROR",
          "Recording host returned an unsuccessful response.",
          {
            statusCode:
              status === 404
                ? 502
                : 502,
          }
        );
      }

      const format =
        inferAudioFormat({
          contentType:
            response.headers
              ?.get?.(
                "content-type"
              ),

          url:
            current.toString(),
        });

      const buffer =
        await readBodyLimited(
          response,
          {
            maxBytes,
          }
        );

      return {
        version:
          SERVICE_VERSION,

        provider:
          "africastalking",

        source:
          "voice-recording",

        buffer,

        filename:
          `voicebridge-call${format.extension}`,

        mimeType:
          format.mimeType,

        byteLength:
          buffer.length,

        sourceHost:
          current.hostname,

        redirectsFollowed,

        stored:
          false,

        diskWritePerformed:
          false,
      };
    }
  };


module.exports = {
  SERVICE_VERSION,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_REDIRECTS,
  AfricasTalkingRecordingFetchError,
  isBlockedAddress,
  validatePublicHttpsUrl,
  inferAudioFormat,
  fetchRecordingIntoMemory,
};
