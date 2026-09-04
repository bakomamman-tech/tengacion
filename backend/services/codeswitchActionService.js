const crypto = require("crypto");

const AdminComplaint = require("../models/AdminComplaint");
const {
  analyzeCodeswitchIntent,
} = require("./codeswitchIntentService");

const ACTION_VERSION = "voicebridge-action-v1";

class CodeswitchActionError extends Error {
  constructor(
    code,
    message,
    {
      statusCode = 400,
      analysis = null,
    } = {}
  ) {
    super(message);
    this.name = "CodeswitchActionError";
    this.code = code;
    this.statusCode = statusCode;
    this.analysis = analysis;
  }
}

const normalizeRequestId = (value) => {
  if (typeof value !== "string") {
    throw new CodeswitchActionError(
      "INVALID_ACTION_REQUEST_ID",
      "requestId must be a string.",
      { statusCode: 400 }
    );
  }

  const requestId = value.trim();

  if (
    requestId.length < 8 ||
    requestId.length > 120
  ) {
    throw new CodeswitchActionError(
      "INVALID_ACTION_REQUEST_ID",
      "requestId must contain between 8 and 120 characters.",
      { statusCode: 400 }
    );
  }

  return requestId;
};

const createCaseId = () =>
  `VB-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;

const fingerprintTranscript = (
  normalizedTranscript
) =>
  crypto
    .createHash("sha256")
    .update(
      String(normalizedTranscript || ""),
      "utf8"
    )
    .digest("hex");

const safeEntities = (entities = {}) => ({
  amount: Number.isFinite(entities.amount)
    ? entities.amount
    : null,

  currency:
    typeof entities.currency === "string"
      ? entities.currency
      : null,

  timeReference:
    typeof entities.timeReference === "string"
      ? entities.timeReference
      : null,

  transactionReference:
    typeof entities.transactionReference ===
    "string"
      ? entities.transactionReference
      : null,
});

const formatCaseDetails = (entities) => {
  const parts = [
    "VoiceBridge payment verification request.",
  ];

  if (
    Number.isFinite(entities.amount) &&
    entities.currency
  ) {
    parts.push(
      `Amount: ${entities.currency} ${entities.amount}.`
    );
  }

  if (entities.timeReference) {
    parts.push(
      `Time reference: ${entities.timeReference}.`
    );
  }

  if (entities.transactionReference) {
    parts.push(
      `Transaction reference: ${entities.transactionReference}.`
    );
  }

  parts.push(
    "No payment, refund, transfer, wallet, or payout operation was performed."
  );

  return parts.join(" ");
};

const buildResult = ({
  complaint,
  analysis,
  entities,
  idempotentReplay,
}) => {
  const metadata = complaint?.metadata || {};

  const caseId =
    metadata.voicebridgeCaseId ||
    "VB-UNKNOWN";

  return {
    actionVersion: ACTION_VERSION,

    taskSuccess: true,
    safetySuccess: true,

    intent: analysis.intent,
    requestedAction:
      analysis.requestedAction,

    executedAction:
      "create_payment_verification_case",

    case: {
      caseId,
      recordId: String(
        complaint?._id || ""
      ),
      type: "payment_verification",
      status: "queued_for_verification",
      supportRecordStatus:
        complaint?.status || "open",
      amount: entities.amount,
      currency: entities.currency,
      timeReference:
        entities.timeReference,
      transactionReference:
        entities.transactionReference,
    },

    moneyMovementPerformed: false,
    idempotentReplay:
      Boolean(idempotentReplay),

    message: idempotentReplay
      ? `Payment verification case ${caseId} already exists for this request.`
      : `Payment verification case ${caseId} created successfully.`,
  };
};

const executeCodeswitchAction = async ({
  transcript,
  languagePair,
  requestId,
} = {}) => {
  const safeRequestId =
    normalizeRequestId(requestId);

  const analysis =
    analyzeCodeswitchIntent({
      transcript,
      languagePair,
    });

  if (
    analysis.actionPolicy
      ?.moneyMovementAllowed
  ) {
    throw new CodeswitchActionError(
      "UNSAFE_ACTION_POLICY",
      "VoiceBridge will not execute actions that permit money movement.",
      {
        statusCode: 403,
        analysis,
      }
    );
  }

  if (
    analysis.actionPolicy
      ?.requiresConfirmation
  ) {
    throw new CodeswitchActionError(
      "CONFIRMATION_REQUIRED",
      "This request requires explicit confirmation and manual review before any support action is created.",
      {
        statusCode: 409,
        analysis,
      }
    );
  }

  if (
    analysis.requestedAction !==
    "check_payment_status"
  ) {
    throw new CodeswitchActionError(
      analysis.actionPolicy
        ?.manualReviewRequired
        ? "MANUAL_REVIEW_REQUIRED"
        : "ACTION_NOT_EXECUTABLE",
      analysis.actionPolicy
        ?.manualReviewRequired
        ? "This request requires manual review and was not executed automatically."
        : "This VoiceBridge action is not executable.",
      {
        statusCode: 422,
        analysis,
      }
    );
  }

  const entities =
    safeEntities(analysis.entities);

  const transcriptFingerprint =
    fingerprintTranscript(
      analysis.normalizedTranscript
    );

  const existing =
    await AdminComplaint.findOne({
      "metadata.voicebridge": true,
      "metadata.voicebridgeActionRequestId":
        safeRequestId,
    }).lean();

  if (existing) {
    const existingMetadata =
      existing.metadata || {};

    const existingFingerprint =
      existingMetadata.transcriptFingerprint;

    const existingLanguagePair =
      existingMetadata.languagePair;

    if (
      (
        existingFingerprint &&
        existingFingerprint !==
          transcriptFingerprint
      ) ||
      (
        existingLanguagePair &&
        existingLanguagePair !==
          languagePair
      )
    ) {
      throw new CodeswitchActionError(
        "IDEMPOTENCY_CONFLICT",
        "requestId has already been used for a different VoiceBridge action payload.",
        {
          statusCode: 409,
          analysis,
        }
      );
    }

    return buildResult({
      complaint: existing,
      analysis,
      entities: safeEntities(
        existingMetadata.entities ||
          entities
      ),
      idempotentReplay: true,
    });
  }

  const caseId = createCaseId();

  const complaint =
    await AdminComplaint.create({
      reporterId: null,

      subject:
        `VoiceBridge payment verification ${caseId}`,

      category: "other",

      details:
        formatCaseDetails(entities),

      sourcePath: "/codeswitch",

      sourceLabel:
        "Tengacion VoiceBridge",

      priority: "medium",
      priorityScore: 200,

      status: "open",

      metadata: {
        voicebridge: true,
        voicebridgeActionVersion:
          ACTION_VERSION,

        voicebridgeActionRequestId:
          safeRequestId,

        voicebridgeCaseId: caseId,

        languagePair,

        intent: analysis.intent,

        requestedAction:
          analysis.requestedAction,

        executedAction:
          "create_payment_verification_case",

        entities,

        transcriptFingerprint,

        transcriptStored: false,
        audioStored: false,

        moneyMovementPerformed: false,
      },
    });

  return buildResult({
    complaint,
    analysis,
    entities,
    idempotentReplay: false,
  });
};

module.exports = {
  ACTION_VERSION,
  CodeswitchActionError,
  executeCodeswitchAction,
};