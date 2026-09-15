const {
  processAfricasTalkingVoiceRecording,
} = require(
  "../services/africasTalkingVoiceProcessingService"
);


const buildRecording =
  () => ({
    buffer:
      Buffer.from(
        "fake-audio"
      ),

    filename:
      "voicebridge-call.wav",

    mimeType:
      "audio/wav",

    byteLength:
      10,

    redirectsFollowed:
      0,
  });


const buildTranscription =
  () => ({
    provider:
      "sahara",

    model:
      "sahara-v2.5",

    languageCode:
      "ha",

    transcript:
      "Don Allah check my payment na biya 5000 naira jiya amma ban samu confirmation ba.",
  });


const buildOrchestration =
  () => ({
    actionCompleted:
      true,

    action: {
      taskSuccess:
        true,

      safetySuccess:
        true,

      intent:
        "payment_confirmation_check",

      executedAction:
        "create_payment_verification_case",

      moneyMovementPerformed:
        false,
    },

    notification: {
      requested:
        false,

      attempted:
        false,

      delivered:
        false,
    },

    moneyMovementPerformed:
      false,
  });


const buildUpstreamError =
  () => {
    const error =
      new Error(
        "Recording host returned an unsuccessful response."
      );

    error.code =
      "AFRICASTALKING_RECORDING_UPSTREAM_ERROR";

    error.statusCode =
      502;

    return error;
  };


describe(
  "Africa's Talking recording availability backoff",
  () => {

    test(
      "waits through the bounded 22-second backoff window before succeeding on attempt seven",
      async () => {

        const fetchRecording =
          jest.fn();

        for (
          let index = 0;
          index < 6;
          index += 1
        ) {
          fetchRecording.mockRejectedValueOnce(
            buildUpstreamError()
          );
        }

        fetchRecording.mockResolvedValueOnce(
          buildRecording()
        );

        const waitForRecordingRetry =
          jest.fn()
            .mockResolvedValue(
              undefined
            );

        const transcribe =
          jest.fn()
            .mockResolvedValue(
              buildTranscription()
            );

        const orchestrate =
          jest.fn()
            .mockResolvedValue(
              buildOrchestration()
            );

        const consoleInfo =
          jest.spyOn(
            console,
            "info"
          )
            .mockImplementation(
              () => {}
            );

        try {
          const result =
            await processAfricasTalkingVoiceRecording(
              {
                recordingUrl:
                  "https://recordings.example.com/delayed.wav",

                sessionId:
                  "AT_DELAYED_RECORDING_123",

                languagePair:
                  "ha-en",
              },
              {
                fetchRecording,
                waitForRecordingRetry,
                transcribe,
                orchestrate,
              }
            );

          expect(
            fetchRecording
          ).toHaveBeenCalledTimes(
            7
          );

          expect(
            waitForRecordingRetry.mock.calls
              .map(
                ([delayMs]) =>
                  delayMs
              )
          ).toEqual([
            1000,
            2000,
            4000,
            5000,
            5000,
            5000,
          ]);

          expect(
            waitForRecordingRetry.mock.calls
              .reduce(
                (total, [delayMs]) =>
                  total + delayMs,
                0
              )
          ).toBe(
            22000
          );

          expect(
            transcribe
          ).toHaveBeenCalledTimes(
            1
          );

          expect(
            orchestrate
          ).toHaveBeenCalledTimes(
            1
          );

          expect(result)
            .toMatchObject({
              processingCompleted:
                true,

              languagePair:
                "ha-en",

              moneyMovementPerformed:
                false,
            });
        } finally {
          consoleInfo.mockRestore();
        }
      }
    );


    test(
      "does not retry non-upstream recording errors",
      async () => {

        const error =
          new Error(
            "Unsafe recording URL."
          );

        error.code =
          "AFRICASTALKING_RECORDING_URL_FORBIDDEN";

        error.statusCode =
          400;

        const fetchRecording =
          jest.fn()
            .mockRejectedValue(
              error
            );

        const waitForRecordingRetry =
          jest.fn();

        const transcribe =
          jest.fn();

        const orchestrate =
          jest.fn();

        await expect(
          processAfricasTalkingVoiceRecording(
            {
              recordingUrl:
                "https://recordings.example.com/unsafe.wav",

              sessionId:
                "AT_UNSAFE_RECORDING_123",

              languagePair:
                "ha-en",
            },
            {
              fetchRecording,
              waitForRecordingRetry,
              transcribe,
              orchestrate,
            }
          )
        ).rejects.toBe(
          error
        );

        expect(
          fetchRecording
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          waitForRecordingRetry
        ).not.toHaveBeenCalled();

        expect(
          transcribe
        ).not.toHaveBeenCalled();

        expect(
          orchestrate
        ).not.toHaveBeenCalled();
      }
    );
  }
);
