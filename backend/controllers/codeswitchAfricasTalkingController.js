const {
  AfricasTalkingVoiceError,
  buildVoiceCallbackXml,
  validateRecordingMetadata,
  summarizeVoiceEvent,
} = require(
  "../services/africasTalkingVoiceService"
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

    /*
     * Africa's Talking Voice callbacks should
     * receive a successful HTTP response.
     *
     * Fail safely without exposing configuration
     * details or internal exceptions.
     */

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


const voiceRecording = (
  req,
  res
) => {

  setNoStore(
    res
  );


  try {

    const recording =
      validateRecordingMetadata(
        req.body
      );


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

  } catch (error) {

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


    throw error;
  }
};


module.exports = {
  voiceCallback,
  voiceEvents,
  voiceRecording,
};