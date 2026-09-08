const {
  AfricasTalkingVoiceError,
  buildVoiceCallbackXml,
  validateRecordingMetadata,
  summarizeVoiceEvent,
} = require(
  "../services/africasTalkingVoiceService"
);

const {
  processAfricasTalkingVoiceRecording,
} = require(
  "../services/africasTalkingVoiceProcessingService"
);


const SERVICE_NAME =
  "Tengacion VoiceBridge";

const CHANNEL =
  "africastalking-voice";


const setNoStore = (
  res
) => {

  res.set(
    "Cache-Control",
    "no-store"
  );
};


const toText = (
  value
) =>
  typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();


const resolveRecordingUrl = (
  body
) =>
  toText(
    body?.recordingUrl ||
    body?.recording_url ||
    body?.recordingURL
  );


const resolveSessionId = (
  body
) =>
  toText(
    body?.sessionId ||
    body?.session_id
  );


const resolveCallerNumber = (
  body
) =>
  toText(
    body?.callerNumber ||
    body?.phoneNumber ||
    body?.from
  );


const MINIMAL_FAILURE_XML =
  '<?xml version="1.0" encoding="UTF-8"?><Response><Say>VoiceBridge is temporarily unavailable.</Say></Response>';


const voiceCallback = (
  _req,
  res
) => {

  setNoStore(
    res
  );


  try {

    const xml =
      buildVoiceCallbackXml();


    return res
      .status(200)
      .type(
        "application/xml"
      )
      .send(
        xml
      );

  } catch {

    return res
      .status(200)
      .type(
        "application/xml"
      )
      .send(
        MINIMAL_FAILURE_XML
      );
  }
};


const voiceEvents = (
  req,
  res
) => {

  setNoStore(
    res
  );


  const summary =
    summarizeVoiceEvent(
      req.body
    );


  return res
    .status(200)
    .json({
      ok:
        true,

      service:
        SERVICE_NAME,

      channel:
        CHANNEL,

      acknowledged:
        true,

      eventReceived:
        summary.event !==
          "unknown",

      sessionIdPresent:
        summary.sessionIdPresent,

      callerPresent:
        summary.callerPresent,

      rawPayloadEchoed:
        false,

      providerCallsPerformed:
        false,

      moneyMovementPerformed:
        false,
    });
};


const voiceRecording =
  async (
    req,
    res
  ) => {

    setNoStore(
      res
    );


    try {

      /*
       * STEP 1
       *
       * Preserve the existing callback metadata
       * validation before any remote operation.
       */
      const recording =
        validateRecordingMetadata(
          req.body
        );


      /*
       * Only VoiceBridge-generated callback URLs
       * include languagePair.
       *
       * Calls without it stay on the legacy
       * metadata-only path.
       */
      const languagePair =
        toText(
          req.query
            ?.languagePair
        );


      if (!languagePair) {

        return res
          .status(202)
          .json({
            ok:
              true,

            service:
              SERVICE_NAME,

            channel:
              CHANNEL,

            recordingAccepted:
              true,

            processingEnabled:
              false,

            providerCallsPerformed:
              false,

            remoteFetchPerformed:
              false,

            audioDownloaded:
              false,

            moneyMovementPerformed:
              false,

            recording,
          });
      }


      const recordingUrl =
        resolveRecordingUrl(
          req.body
        );

      const sessionId =
        resolveSessionId(
          req.body
        );

      const callerNumber =
        resolveCallerNumber(
          req.body
        );


      /*
       * STEP 2
       *
       * Secure fetch -> Sahara ->
       * VoiceBridge intent/action ->
       * optional Africa's Talking SMS.
       */
      const result =
        await processAfricasTalkingVoiceRecording({
          recordingUrl,

          sessionId,

          languagePair,

          notifyBySms:
            Boolean(
              callerNumber
            ),

          phoneNumber:
            callerNumber ||
            null,
        });


      /*
       * Never echo the raw provider callback
       * payload. The processor returns only
       * sanitized metadata and action outcome.
       */
      return res
        .status(200)
        .json({
          ok:
            true,

          service:
            SERVICE_NAME,

          channel:
            CHANNEL,

          recordingAccepted:
            true,

          processingEnabled:
            true,

          processingCompleted:
            result
              .processingCompleted ===
              true,

          providerCallsPerformed:
            true,

          remoteFetchPerformed:
            true,

          audioDownloaded:
            result.recording
              ?.downloaded ===
              true,

          moneyMovementPerformed:
            false,

          processing:
            result,
        });

    } catch (error) {

      /*
       * Metadata validation errors remain
       * distinguishable and happen before
       * remote processing.
       */
      if (
        error instanceof
          AfricasTalkingVoiceError
      ) {

        return res
          .status(
            error.statusCode
          )
          .json({
            ok:
              false,

            service:
              SERVICE_NAME,

            channel:
              CHANNEL,

            recordingAccepted:
              false,

            processingEnabled:
              false,

            providerCallsPerformed:
              false,

            remoteFetchPerformed:
              false,

            audioDownloaded:
              false,

            moneyMovementPerformed:
              false,

            error: {
              code:
                error.code,

              message:
                error.message,
            },
          });
      }


      /*
       * Downstream errors are intentionally
       * sanitized so provider internals,
       * recording URLs, transcripts and caller
       * data never leak through this endpoint.
       */
      const safeStatus =
        Number.isInteger(
          error?.statusCode
        ) &&
        error.statusCode >= 400 &&
        error.statusCode <= 599
          ? error.statusCode
          : 502;

      const safeCode =
        typeof error?.code ===
          "string" &&
        error.code.length <= 120
          ? error.code
          : "AFRICASTALKING_VOICE_PROCESSING_FAILED";


      console.warn(
        "[voicebridge:africastalking] recording processing failed",
        {
          requestId:
            req.requestId ||
            "",

          code:
            safeCode,

          statusCode:
            safeStatus,

          languagePair:
            toText(
              req.query
                ?.languagePair
            ),
        }
      );


      return res
        .status(
          safeStatus
        )
        .json({
          ok:
            false,

          service:
            SERVICE_NAME,

          channel:
            CHANNEL,

          recordingAccepted:
            true,

          processingEnabled:
            true,

          processingCompleted:
            false,

          moneyMovementPerformed:
            false,

          error: {
            code:
              safeCode,

            message:
              "VoiceBridge could not safely complete recording processing.",
          },
        });
    }
  };


module.exports = {
  voiceCallback,
  voiceEvents,
  voiceRecording,
};
