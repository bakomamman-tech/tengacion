const {
  config,
} = require("../config/env");


const SERVICE_VERSION =
  "voicebridge-africastalking-voice-v1";

const RECORDING_CALLBACK_PATH =
  "/api/codeswitch/africastalking/voice/recording";

const MAX_PROMPT_CHARS =
  600;

const MAX_RECORDING_SECONDS =
  60;

const DEFAULT_GREETING =
  "Welcome to Tengacion VoiceBridge.";

const DEFAULT_RECORDING_PROMPT =
  "After the beep, describe the payment or transaction issue you want help with.";


class AfricasTalkingVoiceError
  extends Error {

  constructor(
    code,
    message,
    {
      statusCode = 400,
    } = {}
  ) {

    super(message);

    this.name =
      "AfricasTalkingVoiceError";

    this.code =
      code;

    this.statusCode =
      statusCode;
  }
}


const toText = (value) =>
  typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();


const escapeXml = (
  value
) =>
  String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&apos;"
    );


const validatePrompt = (
  value,
  {
    field =
      "prompt",
  } = {}
) => {

  const text =
    toText(
      value
    );

  if (!text) {

    throw new AfricasTalkingVoiceError(
      "AFRICASTALKING_INVALID_VOICE_PROMPT",
      `${field} must not be empty.`
    );
  }


  if (
    text.length >
    MAX_PROMPT_CHARS
  ) {

    throw new AfricasTalkingVoiceError(
      "AFRICASTALKING_INVALID_VOICE_PROMPT",
      `${field} must not exceed ${MAX_PROMPT_CHARS} characters.`
    );
  }


  return text;
};


const validatePositiveInteger = (
  value,
  {
    field,
    minimum = 1,
    maximum,
  }
) => {

  const parsed =
    Number(value);


  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed < minimum ||
    parsed > maximum
  ) {

    throw new AfricasTalkingVoiceError(
      "AFRICASTALKING_INVALID_VOICE_OPTION",
      `${field} must be an integer between ${minimum} and ${maximum}.`
    );
  }


  return parsed;
};


const validateHttpsUrl = (
  value,
  {
    field =
      "url",
    required =
      true,
  } = {}
) => {

  const text =
    toText(
      value
    );


  if (
    !text &&
    !required
  ) {
    return "";
  }


  if (!text) {

    throw new AfricasTalkingVoiceError(
      "AFRICASTALKING_INVALID_RECORDING_URL",
      `${field} is required.`
    );
  }


  let parsed;

  try {

    parsed =
      new URL(
        text
      );

  } catch {

    throw new AfricasTalkingVoiceError(
      "AFRICASTALKING_INVALID_RECORDING_URL",
      `${field} must be a valid HTTPS URL.`
    );
  }


  if (
    parsed.protocol !==
      "https:"
  ) {

    throw new AfricasTalkingVoiceError(
      "AFRICASTALKING_INVALID_RECORDING_URL",
      `${field} must use HTTPS.`
    );
  }


  if (
    parsed.username ||
    parsed.password
  ) {

    throw new AfricasTalkingVoiceError(
      "AFRICASTALKING_INVALID_RECORDING_URL",
      `${field} must not contain URL credentials.`
    );
  }


  return parsed.toString();
};


const buildRecordingCallbackUrl = (
  callbackBaseUrl =
    config.africasTalking
      ?.callbackBaseUrl
) => {

  const base =
    toText(
      callbackBaseUrl
    );


  if (!base) {
    return "";
  }


  let parsed;

  try {

    parsed =
      new URL(
        base
      );

  } catch {

    throw new AfricasTalkingVoiceError(
      "AFRICASTALKING_INVALID_CALLBACK_URL",
      "Africa's Talking callback base URL is invalid."
    );
  }


  if (
    parsed.protocol !==
      "https:"
  ) {

    throw new AfricasTalkingVoiceError(
      "AFRICASTALKING_INVALID_CALLBACK_URL",
      "Africa's Talking callback base URL must use HTTPS."
    );
  }


  if (
    parsed.username ||
    parsed.password
  ) {

    throw new AfricasTalkingVoiceError(
      "AFRICASTALKING_INVALID_CALLBACK_URL",
      "Africa's Talking callback base URL must not contain URL credentials."
    );
  }


  return new URL(
    RECORDING_CALLBACK_PATH,
    parsed.origin
  ).toString();
};


const serializeXmlAttributes = (
  attributes
) =>
  Object.entries(
    attributes
  )
    .filter(
      ([, value]) =>
        value !== "" &&
        value !== null &&
        value !== undefined
    )
    .map(
      ([key, value]) =>
        ` ${key}="${escapeXml(value)}"`
    )
    .join("");


const buildVoiceCallbackXml = ({
  greeting =
    DEFAULT_GREETING,

  recordingPrompt =
    DEFAULT_RECORDING_PROMPT,

  callbackBaseUrl =
    config.africasTalking
      ?.callbackBaseUrl,

  maxLength =
    30,

  timeout =
    5,

  finishOnKey =
    "#",

  playBeep =
    true,

  trimSilence =
    true,
} = {}) => {

  const safeGreeting =
    validatePrompt(
      greeting,
      {
        field:
          "greeting",
      }
    );


  const safePrompt =
    validatePrompt(
      recordingPrompt,
      {
        field:
          "recordingPrompt",
      }
    );


  const safeMaxLength =
    validatePositiveInteger(
      maxLength,
      {
        field:
          "maxLength",

        minimum:
          1,

        maximum:
          MAX_RECORDING_SECONDS,
      }
    );


  const safeTimeout =
    validatePositiveInteger(
      timeout,
      {
        field:
          "timeout",

        minimum:
          1,

        maximum:
          30,
      }
    );


  const safeFinishOnKey =
    toText(
      finishOnKey
    );


  if (
    safeFinishOnKey.length !==
      1
  ) {

    throw new AfricasTalkingVoiceError(
      "AFRICASTALKING_INVALID_VOICE_OPTION",
      "finishOnKey must contain exactly one character."
    );
  }


  const callbackUrl =
    buildRecordingCallbackUrl(
      callbackBaseUrl
    );


  const recordAttributes = {
    finishOnKey:
      safeFinishOnKey,

    maxLength:
      safeMaxLength,

    timeout:
      safeTimeout,

    playBeep:
      Boolean(
        playBeep
      ),

    trimSilence:
      Boolean(
        trimSilence
      ),

    callbackUrl:
      callbackUrl,
  };


  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `<Say>${escapeXml(safeGreeting)}</Say>`,
    `<Record${serializeXmlAttributes(recordAttributes)}>`,
    `<Say>${escapeXml(safePrompt)}</Say>`,
    "</Record>",
    "</Response>",
  ].join("");
};


const resolveRecordingUrl = (
  body
) =>
  toText(
    body?.recordingUrl ||
    body?.recording_url ||
    body?.recordingURL
  );


const parseDurationSeconds = (
  body
) => {

  const raw =
    body?.durationInSeconds ??
    body?.duration ??
    null;


  if (
    raw === null ||
    raw === undefined ||
    raw === ""
  ) {
    return null;
  }


  const parsed =
    Number(raw);


  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed < 0 ||
    parsed >
      60 * 60
  ) {
    return null;
  }


  return parsed;
};


const validateRecordingMetadata = (
  body
) => {

  if (
    !body ||
    typeof body !==
      "object" ||
    Array.isArray(
      body
    )
  ) {

    throw new AfricasTalkingVoiceError(
      "AFRICASTALKING_INVALID_RECORDING_CALLBACK",
      "Recording callback body must be an object."
    );
  }


  const recordingUrl =
    validateHttpsUrl(
      resolveRecordingUrl(
        body
      ),
      {
        field:
          "recordingUrl",
      }
    );


  const sessionId =
    toText(
      body.sessionId ||
      body.session_id
    );


  return {
    version:
      SERVICE_VERSION,

    provider:
      "africastalking",

    channel:
      "voice",

    recordingUrlPresent:
      Boolean(
        recordingUrl
      ),

    recordingUrlHttps:
      true,

    sessionIdPresent:
      Boolean(
        sessionId
      ),

    durationSeconds:
      parseDurationSeconds(
        body
      ),

    remoteFetchPerformed:
      false,

    audioDownloaded:
      false,
  };
};


const summarizeVoiceEvent = (
  body
) => {

  const source =
    body &&
    typeof body ===
      "object" &&
    !Array.isArray(
      body
    )
      ? body
      : {};


  const event =
    toText(
      source.event ||
      source.status ||
      source.callSessionState ||
      source.callStatus
    )
      .slice(
        0,
        80
      );


  const sessionId =
    toText(
      source.sessionId ||
      source.session_id
    );


  const caller =
    toText(
      source.callerNumber ||
      source.phoneNumber ||
      source.from
    );


  return {
    version:
      SERVICE_VERSION,

    provider:
      "africastalking",

    channel:
      "voice",

    event:
      event ||
      "unknown",

    sessionIdPresent:
      Boolean(
        sessionId
      ),

    callerPresent:
      Boolean(
        caller
      ),

    rawPayloadEchoed:
      false,
  };
};


module.exports = {
  SERVICE_VERSION,
  RECORDING_CALLBACK_PATH,
  MAX_PROMPT_CHARS,
  MAX_RECORDING_SECONDS,
  DEFAULT_GREETING,
  DEFAULT_RECORDING_PROMPT,
  AfricasTalkingVoiceError,
  escapeXml,
  buildRecordingCallbackUrl,
  buildVoiceCallbackXml,
  validateRecordingMetadata,
  summarizeVoiceEvent,
};