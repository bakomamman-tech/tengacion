const {
  MAX_TRANSCRIPT_CHARS,
  normalizeTranscript,
} = require("./codeswitchService");

const INTENT_VERSION = "voicebridge-intent-v1";

const SUPPORTED_LANGUAGE_PAIRS = Object.freeze([
  "ha-en",
  "pcm-en",
]);

const ENGLISH_THOUSANDS = Object.freeze({
  one: 1000,
  two: 2000,
  three: 3000,
  four: 4000,
  five: 5000,
  six: 6000,
  seven: 7000,
  eight: 8000,
  nine: 9000,
  ten: 10000,
});

const HAUSA_THOUSANDS = Object.freeze({
  daya: 1000,
  biyu: 2000,
  uku: 3000,
  hudu: 4000,
  biyar: 5000,
  shida: 6000,
  bakwai: 7000,
  takwas: 8000,
  tara: 9000,
  goma: 10000,
});

const CONFIRMATION_TERMS = [
  "confirmation",
  "conformation",
  "konfirmation",
];

const parseCurrencyNumber = (transcript) => {
  const patterns = [
    /₦\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /\b(?:ngn|naira)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /\b([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:ngn|naira)\b/i,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);

    if (!match) {
      continue;
    }

    const value = Number(
      match[1].replace(/,/g, "")
    );

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
};

const parseWordThousands = (text) => {
  const english = text.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten) thousand\b/
  );

  if (english) {
    return ENGLISH_THOUSANDS[english[1]] || null;
  }

  const hausa = text.match(
    /\bdubu (daya|biyu|uku|hudu|biyar|shida|bakwai|takwas|tara|goma)\b/
  );

  return hausa
    ? HAUSA_THOUSANDS[hausa[1]] || null
    : null;
};

const extractTimeReference = (text) => {
  if (/\b(?:yesterday|jiya)\b/.test(text)) {
    return "yesterday";
  }

  if (/\b(?:today|yau)\b/.test(text)) {
    return "today";
  }

  if (/\b(?:tomorrow|gobe)\b/.test(text)) {
    return "tomorrow";
  }

  return null;
};

const detectIntent = (text) => {
  const hasPayment =
    /\b(?:payment|pay|paid|biya|transaction|transfer)\b/.test(
      text
    );

  const hasCheck =
    /\b(?:check|verify|status|duba)\b/.test(
      text
    );

  const hasConfirmation =
    CONFIRMATION_TERMS.some(
      (term) =>
        new RegExp(
          `(?:^|\\s)${term}(?:$|\\s)`
        ).test(text)
    );

  const hasRefund =
    /\b(?:refund|reversal|reverse)\b/.test(
      text
    ) ||
    text.includes("money back");

  if (hasPayment && hasRefund) {
    return {
      intent: "refund_request",
      confidence: 0.94,
      requestedAction:
        "prepare_refund_support_case",
      actionPolicy: {
        mode: "support_case_only",
        moneyMovementAllowed: false,
        requiresConfirmation: true,
        manualReviewRequired: true,
      },
    };
  }

  if (hasPayment && hasConfirmation) {
    return {
      intent: "payment_confirmation_check",
      confidence: 0.98,
      requestedAction: "check_payment_status",
      actionPolicy: {
        mode: "read_only",
        moneyMovementAllowed: false,
        requiresConfirmation: false,
        manualReviewRequired: false,
      },
    };
  }

  if (hasPayment && hasCheck) {
    return {
      intent: "payment_status_check",
      confidence: 0.9,
      requestedAction: "check_payment_status",
      actionPolicy: {
        mode: "read_only",
        moneyMovementAllowed: false,
        requiresConfirmation: false,
        manualReviewRequired: false,
      },
    };
  }

  return {
    intent: "unknown",
    confidence: 0.25,
    requestedAction: "manual_support_review",
    actionPolicy: {
      mode: "manual_review",
      moneyMovementAllowed: false,
      requiresConfirmation: false,
      manualReviewRequired: true,
    },
  };
};

const analyzeCodeswitchIntent = ({
  transcript,
  languagePair,
} = {}) => {
  if (typeof transcript !== "string") {
    throw new TypeError(
      "transcript must be a string."
    );
  }

  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    throw new RangeError(
      `transcript must not exceed ${MAX_TRANSCRIPT_CHARS} characters.`
    );
  }

  if (
    !SUPPORTED_LANGUAGE_PAIRS.includes(
      languagePair
    )
  ) {
    throw new RangeError(
      "languagePair must be one of: ha-en, pcm-en."
    );
  }

  const normalizedTranscript =
    normalizeTranscript(transcript);

  const decision =
    detectIntent(normalizedTranscript);

  return {
    intentVersion: INTENT_VERSION,
    languagePair,
    normalizedTranscript,
    intent: decision.intent,
    confidence: decision.confidence,
    confidenceType:
      "deterministic-heuristic-score-not-calibrated-probability",
    entities: {
      amount:
        parseCurrencyNumber(transcript) ??
        parseWordThousands(
          normalizedTranscript
        ),
      currency:
        transcript.includes("₦") ||
        /\bngn\b/i.test(transcript) ||
        /\bnaira\b/.test(
          normalizedTranscript
        )
          ? "NGN"
          : null,
      timeReference:
        extractTimeReference(
          normalizedTranscript
        ),
      transactionReference: null,
    },
    requestedAction:
      decision.requestedAction,
    actionPolicy:
      decision.actionPolicy,
  };
};

module.exports = {
  INTENT_VERSION,
  SUPPORTED_LANGUAGE_PAIRS,
  analyzeCodeswitchIntent,
};
