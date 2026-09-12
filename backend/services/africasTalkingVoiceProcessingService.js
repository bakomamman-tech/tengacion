const crypto =
  require("node:crypto");

const {
  fetchRecordingIntoMemory,
} = require(
  "./africasTalkingRecordingFetchService"
);

const {
  transcribeWithSahara,
} = require(
  "./saharaService"
);

const {
  runVoicebridgeChannelOrchestration,
} = require(
  "./africasTalkingVoicebridgeOrchestrator"
);


const PROCESSING_VERSION =
  "voicebridge-africastalking-processing-v1";

const LANGUAGE_PAIR_TO_SAHARA_LANGUAGE =
  Object.freeze({
    "ha-en":
      "ha",

    "pcm-en":
      "pcm",
  });


const RECORDING_FETCH_MAX_ATTEMPTS =
  4;

const RECORDING_FETCH_RETRY_DELAY_MS =
  1000;

const waitForRecordingRetryDefault =
  (delayMs) =>
    new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          delayMs
        )
    );


class AfricasTalkingVoiceProcessingError
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
      "AfricasTalkingVoiceProcessingError";

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


const resolveLanguageCode = (
  languagePair
) => {

  const pair =
    toText(
      languagePair
    );

  const languageCode =
    LANGUAGE_PAIR_TO_SAHARA_LANGUAGE[
      pair
    ];

  if (!languageCode) {

    throw new AfricasTalkingVoiceProcessingError(
      "AFRICASTALKING_UNSUPPORTED_LANGUAGE_PAIR",
      "languagePair must be one of: ha-en, pcm-en.",
      {
        statusCode:
          400,
      }
    );
  }

  return {
    languagePair:
      pair,

    languageCode,
  };
};


const buildPrivateActionRequestId = (
  sessionId
) => {

  const safeSessionId =
    toText(
      sessionId
    );

  if (!safeSessionId) {

    throw new AfricasTalkingVoiceProcessingError(
      "AFRICASTALKING_SESSION_REQUIRED",
      "A Voice session identifier is required.",
      {
        statusCode:
          400,
      }
    );
  }

  /*
   * Never persist or expose the raw Africa's
   * Talking session identifier through the
   * VoiceBridge action layer.
   *
   * The stable hash also provides idempotency
   * when Africa's Talking retries a callback.
   */
  const digest =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        safeSessionId,
        "utf8"
      )
      .digest(
        "hex"
      );

  return (
    `at-${digest.slice(0, 40)}`
  );
};


const ensureTranscript = (
  value
) => {

  const transcript =
    toText(
      value
    );

  if (!transcript) {

    throw new AfricasTalkingVoiceProcessingError(
      "AFRICASTALKING_EMPTY_TRANSCRIPT",
      "Sahara did not return a usable transcript.",
      {
        statusCode:
          502,
      }
    );
  }

  return transcript;
};


const fetchRecordingWithRetry =
  async (
    recordingUrl,
    {
      fetchRecording,
      waitForRecordingRetry,
    }
  ) => {

    let lastError =
      null;

    for (
      let attempt = 1;
      attempt <=
        RECORDING_FETCH_MAX_ATTEMPTS;
      attempt += 1
    ) {

      try {

        return await fetchRecording(
          recordingUrl
        );

      } catch (error) {

        lastError =
          error;

        const retryable =
          error?.code ===
            "AFRICASTALKING_RECORDING_UPSTREAM_ERROR";

        if (
          !retryable ||
          attempt ===
            RECORDING_FETCH_MAX_ATTEMPTS
        ) {
          throw error;
        }

        await waitForRecordingRetry(
          RECORDING_FETCH_RETRY_DELAY_MS
        );
      }
    }

    throw lastError;
  };


const processAfricasTalkingVoiceRecording =
  async (
    {
      recordingUrl,
      sessionId,
      languagePair,
      notifyBySms = false,
      phoneNumber = null,
    } = {},
    {
      fetchRecording =
        fetchRecordingIntoMemory,

      waitForRecordingRetry =
        waitForRecordingRetryDefault,

      transcribe =
        transcribeWithSahara,

      orchestrate =
        runVoicebridgeChannelOrchestration,
    } = {}
  ) => {

    const language =
      resolveLanguageCode(
        languagePair
      );

    const requestId =
      buildPrivateActionRequestId(
        sessionId
      );

    /*
     * STEP 1
     *
     * Retrieve the provider recording into
     * memory only.
     */
    const recording =
      await fetchRecordingWithRetry(
        recordingUrl,
        {
          fetchRecording,
          waitForRecordingRetry,
        }
      );


    /*
     * STEP 2
     *
     * Sahara remains the speech provider for
     * this application-channel flow.
     *
     * This does not modify or rerun the formal
     * four-provider benchmark.
     */
    const transcription =
      await transcribe({
        buffer:
          recording.buffer,

        filename:
          recording.filename,

        mimeType:
          recording.mimeType,

        languageCode:
          language.languageCode,
      });


    const transcript =
      ensureTranscript(
        transcription
          ?.transcript
      );


    /*
     * STEP 3
     *
     * Delegate all intent/entity/policy/action
     * logic to the existing VoiceBridge
     * orchestrator.
     */
    const orchestration =
      await orchestrate({
        transcript,

        languagePair:
          language.languagePair,

        requestId,

        notifyBySms,

        phoneNumber,
      });


    /*
     * Fail closed if a future orchestration
     * change ever violates VoiceBridge's
     * no-money-movement invariant.
     */
    if (
      orchestration
        ?.moneyMovementPerformed !==
        false ||
      orchestration
        ?.actionCompleted !==
        true
    ) {

      throw new AfricasTalkingVoiceProcessingError(
        "AFRICASTALKING_UNSAFE_PROCESSING_RESULT",
        "VoiceBridge rejected an unsafe processing result.",
        {
          statusCode:
            500,
        }
      );
    }


    /*
     * IMPORTANT:
     *
     * Do not return:
     * - raw recording URL
     * - raw caller number
     * - raw session id
     * - raw transcript
     * - audio buffer
     */
    return {
      version:
        PROCESSING_VERSION,

      channel:
        "africastalking-voice",

      processingCompleted:
        true,

      languagePair:
        language.languagePair,

      recording: {
        downloaded:
          true,

        byteLength:
          Number(
            recording.byteLength ||
            recording.buffer
              ?.length ||
            0
          ),

        mimeType:
          recording.mimeType ||
          null,

        redirectsFollowed:
          Number.isInteger(
            recording
              .redirectsFollowed
          )
            ? recording
                .redirectsFollowed
            : 0,

        stored:
          false,

        diskWritePerformed:
          false,
      },

      transcription: {
        completed:
          true,

        provider:
          transcription
            ?.provider ||
          "sahara",

        model:
          transcription
            ?.model ||
          "sahara-v2.5",

        languageCode:
          language.languageCode,

        providerFileIdPresent:
          Boolean(
            transcription
              ?.providerFileId
          ),

        processedAudioDurationSeconds:
          Number.isFinite(
            transcription
              ?.processedAudioDurationSeconds
          )
            ? transcription
                .processedAudioDurationSeconds
            : null,

        transcriptReturned:
          false,
      },

      action:
        orchestration
          .action,

      notification:
        orchestration
          .notification,

      transcriptReturned:
        false,

      transcriptStoredByProcessor:
        false,

      audioReturned:
        false,

      audioStoredByProcessor:
        false,

      rawRecordingUrlReturned:
        false,

      rawSessionIdReturned:
        false,

      rawPhoneNumberReturned:
        false,

      moneyMovementPerformed:
        false,
    };
  };


module.exports = {
  PROCESSING_VERSION,
  LANGUAGE_PAIR_TO_SAHARA_LANGUAGE,
  AfricasTalkingVoiceProcessingError,
  resolveLanguageCode,
  buildPrivateActionRequestId,
  processAfricasTalkingVoiceRecording,
};
