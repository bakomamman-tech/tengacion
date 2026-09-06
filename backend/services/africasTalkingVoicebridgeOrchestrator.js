const {
  executeCodeswitchAction,
  CodeswitchActionError,
} = require(
  "./codeswitchActionService"
);

const {
  sendTransactionalStatus,
} = require(
  "./africasTalkingSmsService"
);


const ORCHESTRATOR_VERSION =
  "voicebridge-africastalking-orchestrator-v1";

const E164_PATTERN =
  /^\+[1-9]\d{7,14}$/;


class VoicebridgeOrchestratorError
  extends Error {

  constructor(
    code,
    message,
    {
      statusCode = 400,
      causeCode = null,
    } = {}
  ) {

    super(message);

    this.name =
      "VoicebridgeOrchestratorError";

    this.code =
      code;

    this.statusCode =
      statusCode;

    this.causeCode =
      causeCode;
  }
}


const toText = (
  value
) =>
  typeof value ===
    "string"
    ? value.trim()
    : value == null
      ? ""
      : String(
          value
        ).trim();


const validateNotifyFlag = (
  value
) => {

  if (
    value === undefined ||
    value === null
  ) {
    return false;
  }


  if (
    typeof value !==
      "boolean"
  ) {

    throw new VoicebridgeOrchestratorError(
      "INVALID_NOTIFICATION_FLAG",
      "notifyBySms must be a boolean."
    );
  }


  return value;
};


const isValidE164Phone = (
  value
) =>
  E164_PATTERN.test(
    toText(
      value
    )
  );


const buildStatusMessage = (
  actionResult
) => {

  const caseId =
    toText(
      actionResult
        ?.case
        ?.caseId
    ) ||
    "your case";


  return (
    `Tengacion VoiceBridge: payment verification case ${caseId} ` +
    "is queued for verification. " +
    "No payment, refund, transfer, wallet, or payout operation was performed."
  );
};


const safeActionSummary = (
  actionResult
) => ({
  actionVersion:
    actionResult
      ?.actionVersion ||
    null,

  taskSuccess:
    actionResult
      ?.taskSuccess ===
    true,

  safetySuccess:
    actionResult
      ?.safetySuccess ===
    true,

  intent:
    actionResult
      ?.intent ||
    null,

  requestedAction:
    actionResult
      ?.requestedAction ||
    null,

  executedAction:
    actionResult
      ?.executedAction ||
    null,

  case:
    actionResult
      ?.case
      ? {
          caseId:
            actionResult
              .case
              .caseId ||
            null,

          type:
            actionResult
              .case
              .type ||
            null,

          status:
            actionResult
              .case
              .status ||
            null,

          supportRecordStatus:
            actionResult
              .case
              .supportRecordStatus ||
            null,

          amount:
            Number.isFinite(
              actionResult
                .case
                .amount
            )
              ? actionResult
                  .case
                  .amount
              : null,

          currency:
            actionResult
              .case
              .currency ||
            null,

          timeReference:
            actionResult
              .case
              .timeReference ||
            null,

          transactionReference:
            actionResult
              .case
              .transactionReference ||
            null,
        }
      : null,

  idempotentReplay:
    Boolean(
      actionResult
        ?.idempotentReplay
    ),

  moneyMovementPerformed:
    false,
});


const createNotificationState = ({
  requested,
  attempted = false,
  delivered = false,
  accepted = false,
  statusCode = null,
  status = null,
  messageId = null,
  recipientMasked = null,
  errorCode = null,
} = {}) => ({
  channel:
    "sms",

  requested:
    Boolean(
      requested
    ),

  attempted:
    Boolean(
      attempted
    ),

  delivered:
    Boolean(
      delivered
    ),

  accepted:
    Boolean(
      accepted
    ),

  statusCode:
    Number.isFinite(
      statusCode
    )
      ? statusCode
      : null,

  status:
    typeof status ===
      "string"
      ? status
      : null,

  messageId:
    typeof messageId ===
      "string"
      ? messageId
      : null,

  recipientMasked:
    typeof recipientMasked ===
      "string"
      ? recipientMasked
      : null,

  errorCode:
    typeof errorCode ===
      "string"
      ? errorCode
      : null,
});


const runVoicebridgeChannelOrchestration =
  async (
    {
      transcript,
      languagePair,
      requestId,
      notifyBySms = false,
      phoneNumber = null,
    } = {},
    {
      executeAction =
        executeCodeswitchAction,

      sendSms =
        sendTransactionalStatus,
    } = {}
  ) => {

    const notificationRequested =
      validateNotifyFlag(
        notifyBySms
      );


    /*
     * IMPORTANT:
     * The existing action service remains the
     * single source of truth for:
     *
     * - transcript normalization
     * - intent extraction
     * - entity extraction
     * - safety policy
     * - idempotency
     * - support-case creation
     *
     * This orchestrator must not duplicate
     * financial/action logic.
     */

    let actionResult;


    try {

      actionResult =
        await executeAction({
          transcript,
          languagePair,
          requestId,
        });

    } catch (error) {

      if (
        error instanceof
          CodeswitchActionError ||
        (
          error &&
          typeof error ===
            "object" &&
          typeof error.code ===
            "string"
        )
      ) {

        throw new VoicebridgeOrchestratorError(
          error.code ||
            "VOICEBRIDGE_ACTION_FAILED",
          "VoiceBridge downstream action was not completed.",
          {
            statusCode:
              Number.isInteger(
                error.statusCode
              )
                ? error.statusCode
                : 422,

            causeCode:
              error.code ||
              null,
          }
        );
      }


      throw new VoicebridgeOrchestratorError(
        "VOICEBRIDGE_ACTION_FAILED",
        "VoiceBridge downstream action was not completed.",
        {
          statusCode:
            500,
        }
      );
    }


    /*
     * Fail closed if a future change to the action
     * layer ever violates the no-money-movement
     * contract.
     */

    if (
      actionResult
        ?.moneyMovementPerformed !==
        false ||
      actionResult
        ?.taskSuccess !==
        true ||
      actionResult
        ?.safetySuccess !==
        true
    ) {

      throw new VoicebridgeOrchestratorError(
        "UNSAFE_ACTION_RESULT",
        "VoiceBridge rejected an unsafe downstream action result.",
        {
          statusCode:
            500,
        }
      );
    }


    const action =
      safeActionSummary(
        actionResult
      );


    /*
     * Notification is optional and cannot cause
     * the already-safe downstream action itself
     * to be reported as a failure.
     */

    if (
      !notificationRequested
    ) {

      return {
        version:
          ORCHESTRATOR_VERSION,

        channel:
          "africastalking",

        source:
          "voicebridge-transcript",

        actionCompleted:
          true,

        action,

        notification:
          createNotificationState({
            requested:
              false,
          }),

        transcriptReturned:
          false,

        transcriptStoredByOrchestrator:
          false,

        audioStoredByOrchestrator:
          false,

        moneyMovementPerformed:
          false,
      };
    }


    const safePhone =
      toText(
        phoneNumber
      );


    if (
      !isValidE164Phone(
        safePhone
      )
    ) {

      return {
        version:
          ORCHESTRATOR_VERSION,

        channel:
          "africastalking",

        source:
          "voicebridge-transcript",

        actionCompleted:
          true,

        action,

        notification:
          createNotificationState({
            requested:
              true,

            attempted:
              false,

            delivered:
              false,

            errorCode:
              "INVALID_SMS_RECIPIENT",
          }),

        transcriptReturned:
          false,

        transcriptStoredByOrchestrator:
          false,

        audioStoredByOrchestrator:
          false,

        moneyMovementPerformed:
          false,
      };
    }


    const message =
      buildStatusMessage(
        actionResult
      );


    try {

      const smsResult =
        await sendSms({
          to:
            safePhone,

          message,
        });


      return {
        version:
          ORCHESTRATOR_VERSION,

        channel:
          "africastalking",

        source:
          "voicebridge-transcript",

        actionCompleted:
          true,

        action,

        notification:
          createNotificationState({
            requested:
              true,

            attempted:
              true,

            delivered:
              smsResult
                ?.accepted ===
              true,

            accepted:
              smsResult
                ?.accepted ===
              true,

            statusCode:
              smsResult
                ?.statusCode,

            status:
              smsResult
                ?.status,

            messageId:
              smsResult
                ?.messageId,

            recipientMasked:
              smsResult
                ?.recipientMasked,

            errorCode:
              smsResult
                ?.accepted ===
              true
                ? null
                : "SMS_NOT_ACCEPTED",
          }),

        transcriptReturned:
          false,

        transcriptStoredByOrchestrator:
          false,

        audioStoredByOrchestrator:
          false,

        moneyMovementPerformed:
          false,
      };

    } catch (error) {

      return {
        version:
          ORCHESTRATOR_VERSION,

        channel:
          "africastalking",

        source:
          "voicebridge-transcript",

        actionCompleted:
          true,

        action,

        notification:
          createNotificationState({
            requested:
              true,

            attempted:
              true,

            delivered:
              false,

            accepted:
              false,

            errorCode:
              typeof error?.code ===
                "string"
                ? error.code
                : "SMS_NOTIFICATION_FAILED",
          }),

        transcriptReturned:
          false,

        transcriptStoredByOrchestrator:
          false,

        audioStoredByOrchestrator:
          false,

        moneyMovementPerformed:
          false,
      };
    }
  };


module.exports = {
  ORCHESTRATOR_VERSION,
  VoicebridgeOrchestratorError,
  isValidE164Phone,
  buildStatusMessage,
  runVoicebridgeChannelOrchestration,
};