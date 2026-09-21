const { config } = require("../config/env");
const {
  buildRecordingCallbackUrl,
  buildVoiceCallbackXml,
  escapeXml,
} = require("./africasTalkingVoiceService");

const LANGUAGE_MENU_PATH =
  "/api/codeswitch/africastalking/voice/language";

const LANGUAGE_BY_KEY = Object.freeze({
  "1": "ha-en",
  "2": "pcm-en",
});

const LANGUAGE_LABELS = Object.freeze({
  "ha-en": "Hausa and English",
  "pcm-en": "Nigerian Pidgin and English",
});

const resolveLanguagePairFromDigits = (digits) =>
  typeof digits === "string"
    ? LANGUAGE_BY_KEY[digits.trim()] || null
    : null;

const buildLanguageMenuXml = ({
  callbackBaseUrl = config.africasTalking?.callbackBaseUrl,
  retry = false,
} = {}) => {
  // Reuse the voice service's HTTPS/origin/credential validation.
  const recordingUrl = buildRecordingCallbackUrl(
    callbackBaseUrl,
    "ha-en"
  );
  if (!recordingUrl) {
    throw new Error("VoiceBridge callback base URL is not configured.");
  }

  const callbackUrl = new URL(
    LANGUAGE_MENU_PATH,
    new URL(recordingUrl).origin
  );
  if (retry) {
    callbackUrl.searchParams.set("retry", "1");
  }

  const prompt = retry
    ? "Invalid choice. Press 1 for Hausa and English, or press 2 for Nigerian Pidgin and English."
    : "Welcome to Tengacion VoiceBridge. Press 1 for Hausa and English. Press 2 for Nigerian Pidgin and English.";

  // One digit completes GetDigits automatically; the caller need not press #.
  // A missing choice ends the call without recording or selecting Hausa by default.
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    '<GetDigits numDigits="1" timeout="10" callbackUrl="' +
      escapeXml(callbackUrl.toString()) + '">',
    "<Say>" + escapeXml(prompt) + "</Say>",
    "</GetDigits>",
    "<Say>No language selected. Please call again when you are ready. Goodbye.</Say>",
    "</Response>",
  ].join("");
};

const buildLanguageSelectionXml = ({
  digits,
  retry = false,
  callbackBaseUrl = config.africasTalking?.callbackBaseUrl,
} = {}) => {
  const languagePair = resolveLanguagePairFromDigits(digits);

  if (languagePair) {
    return buildVoiceCallbackXml({
      callbackBaseUrl,
      languagePair,
      greeting: "You selected " + LANGUAGE_LABELS[languagePair] + ".",
    });
  }

  if (!retry) {
    return buildLanguageMenuXml({
      callbackBaseUrl,
      retry: true,
    });
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    "<Say>We could not recognize your language choice. Please call again. Goodbye.</Say>",
    "</Response>",
  ].join("");
};

module.exports = {
  LANGUAGE_MENU_PATH,
  resolveLanguagePairFromDigits,
  buildLanguageMenuXml,
  buildLanguageSelectionXml,
};
