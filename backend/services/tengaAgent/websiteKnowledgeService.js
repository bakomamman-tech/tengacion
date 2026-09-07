const {
  URL,
} = require("url");

const {
  normalizeKnowledgeText,
} = require(
  "./knowledgeChunkingService"
);

const CUSTOMER_ZERO_ALLOWED_HOSTS =
  new Set([
    "tengacion.com",
    "www.tengacion.com",
  ]);

const MAX_WEBSITE_BYTES =
  1500000;

const DEFAULT_TIMEOUT_MS =
  12000;

const decodeHtmlEntities = (
  value
) =>
  String(value || "")
    .replace(
      /&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi,
      (match, entity) => {
        const normalized =
          entity.toLowerCase();

        const named = {
          amp: "&",
          lt: "<",
          gt: ">",
          quot: '"',
          apos: "'",
          nbsp: " ",
        };

        if (
          Object.prototype
            .hasOwnProperty.call(
              named,
              normalized
            )
        ) {
          return named[normalized];
        }

        if (
          normalized.startsWith("#")
        ) {
          const isHex =
            normalized.startsWith(
              "#x"
            );

          const digits =
            normalized.slice(
              isHex ? 2 : 1
            );

          const codePoint =
            Number.parseInt(
              digits,
              isHex ? 16 : 10
            );

          if (
            Number.isFinite(
              codePoint
            )
          ) {
            try {
              return String.fromCodePoint(
                codePoint
              );
            } catch (_error) {
              return match;
            }
          }
        }

        return match;
      }
    );

const htmlToKnowledgeText = (
  html
) => {
  const withoutHiddenContent =
    String(html || "")
      .replace(
        /<!--[\s\S]*?-->/g,
        " "
      )
      .replace(
        /<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi,
        " "
      );

  const withBoundaries =
    withoutHiddenContent
      .replace(
        /<li\b[^>]*>/gi,
        "\n- "
      )
      .replace(
        /<(br|\/p|\/div|\/section|\/article|\/li|\/h[1-6]|\/tr|\/header|\/footer|\/main|\/nav)\b[^>]*>/gi,
        "\n"
      );

  const withoutTags =
    withBoundaries.replace(
      /<[^>]+>/g,
      " "
    );

  return normalizeKnowledgeText(
    decodeHtmlEntities(
      withoutTags
    )
  );
};

const validateCustomerZeroWebsiteUrl =
  (value) => {
    let parsed;

    try {
      parsed =
        new URL(
          String(value || "")
        );
    } catch (_error) {
      throw new Error(
        "Invalid knowledge-source URL."
      );
    }

    if (
      parsed.protocol !== "https:"
    ) {
      throw new Error(
        "Knowledge-source URL must use HTTPS."
      );
    }

    if (
      parsed.username ||
      parsed.password
    ) {
      throw new Error(
        "Knowledge-source URL cannot contain credentials."
      );
    }

    if (
      !CUSTOMER_ZERO_ALLOWED_HOSTS.has(
        parsed.hostname
          .toLowerCase()
      )
    ) {
      throw new Error(
        "Knowledge-source host is not allowed."
      );
    }

    parsed.hash = "";

    return parsed;
  };

const fetchWebsiteText =
  async ({
    url,
    fetchImpl =
      global.fetch,
    timeoutMs =
      DEFAULT_TIMEOUT_MS,
    maxRedirects = 3,
  }) => {
    if (
      typeof fetchImpl !==
      "function"
    ) {
      throw new Error(
        "Website fetch implementation is unavailable."
      );
    }

    const originalUrl =
      validateCustomerZeroWebsiteUrl(
        url
      ).toString();

    let currentUrl =
      originalUrl;

    for (
      let redirectCount = 0;
      redirectCount <= maxRedirects;
      redirectCount += 1
    ) {
      const controller =
        new AbortController();

      const timer =
        setTimeout(
          () =>
            controller.abort(),
          timeoutMs
        );

      let response;

      try {
        response =
          await fetchImpl(
            currentUrl,
            {
              method: "GET",
              redirect: "manual",
              signal:
                controller.signal,
              headers: {
                Accept:
                  "text/html,text/plain;q=0.9",
                "User-Agent":
                  "TengaAgentKnowledgeBot/1.0 (+https://tengacion.com)",
              },
            }
          );
      } finally {
        clearTimeout(timer);
      }

      if (
        response.status >= 300 &&
        response.status < 400
      ) {
        const location =
          response.headers?.get?.(
            "location"
          );

        if (!location) {
          throw new Error(
            "Website redirect did not provide a location."
          );
        }

        currentUrl =
          validateCustomerZeroWebsiteUrl(
            new URL(
              location,
              currentUrl
            ).toString()
          ).toString();

        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Website request failed with HTTP ${response.status}.`
        );
      }

      const contentType =
        String(
          response.headers?.get?.(
            "content-type"
          ) || ""
        ).toLowerCase();

      if (
        contentType &&
        !contentType.includes(
          "text/html"
        ) &&
        !contentType.includes(
          "text/plain"
        )
      ) {
        throw new Error(
          "Website response was not HTML or plain text."
        );
      }

      const contentLength =
        Number(
          response.headers?.get?.(
            "content-length"
          )
        );

      if (
        Number.isFinite(
          contentLength
        ) &&
        contentLength >
          MAX_WEBSITE_BYTES
      ) {
        throw new Error(
          "Website response is too large."
        );
      }

      const html =
        await response.text();

      if (
        Buffer.byteLength(
          html,
          "utf8"
        ) >
        MAX_WEBSITE_BYTES
      ) {
        throw new Error(
          "Website response is too large."
        );
      }

      const text =
        contentType.includes(
          "text/plain"
        )
          ? normalizeKnowledgeText(
              html
            )
          : htmlToKnowledgeText(
              html
            );

      if (
        text.length < 40
      ) {
        throw new Error(
          "Website did not contain enough readable knowledge."
        );
      }

      return {
        requestedUrl:
          originalUrl,
        finalUrl:
          currentUrl,
        text,
      };
    }

    throw new Error(
      "Website exceeded the allowed redirect limit."
    );
  };

module.exports = {
  CUSTOMER_ZERO_ALLOWED_HOSTS,
  decodeHtmlEntities,
  fetchWebsiteText,
  htmlToKnowledgeText,
  validateCustomerZeroWebsiteUrl,
};