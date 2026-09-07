const express =
  require("express");

const request =
  require("supertest");


jest.mock(
  "../services/africasTalkingVoiceProcessingService",
  () => ({
    processAfricasTalkingVoiceRecording:
      jest.fn(),
  })
);


const {
  processAfricasTalkingVoiceRecording,
} = require(
  "../services/africasTalkingVoiceProcessingService"
);

const codeswitchRouter =
  require(
    "../routes/codeswitch"
  );


const app =
  express();

app.use(
  express.json({
    limit:
      "512kb",
  })
);

app.use(
  express.urlencoded({
    extended:
      true,

    limit:
      "512kb",
  })
);

app.use(
  "/api/codeswitch",
  codeswitchRouter
);


describe(
  "Africa's Talking VoiceBridge E2E recording callback",
  () => {

    afterEach(
      () => {
        jest.clearAllMocks();
      }
    );


    test(
      "routes Hausa-English telephone recording through VoiceBridge",
      async () => {

        const recordingUrl =
          "https://recordings.example.com/private.wav?token=PRIVATE_TOKEN";

        const sessionId =
          "PRIVATE_AT_SESSION";

        const callerNumber =
          "+2348012345678";


        processAfricasTalkingVoiceRecording
          .mockResolvedValue({
            version:
              "voicebridge-africastalking-processing-v1",

            channel:
              "africastalking-voice",

            processingCompleted:
              true,

            languagePair:
              "ha-en",

            recording: {
              downloaded:
                true,

              byteLength:
                4096,

              mimeType:
                "audio/wav",

              redirectsFollowed:
                0,

              stored:
                false,

              diskWritePerformed:
                false,
            },

            transcription: {
              completed:
                true,

              provider:
                "sahara",

              model:
                "sahara-v2.5",

              languageCode:
                "ha",

              transcriptReturned:
                false,
            },

            action: {
              taskSuccess:
                true,

              safetySuccess:
                true,

              intent:
                "payment_confirmation_check",

              requestedAction:
                "check_payment_status",

              executedAction:
                "create_payment_verification_case",

              moneyMovementPerformed:
                false,
            },

            notification: {
              channel:
                "sms",

              requested:
                true,

              attempted:
                true,

              delivered:
                true,
            },

            transcriptReturned:
              false,

            audioReturned:
              false,

            moneyMovementPerformed:
              false,
          });


        const response =
          await request(
            app
          )
            .post(
              "/api/codeswitch/africastalking/voice/recording?languagePair=ha-en"
            )
            .type(
              "form"
            )
            .send({
              recordingUrl,

              sessionId,

              callerNumber,

              durationInSeconds:
                "8.4",
            });


        expect(
          response.status
        ).toBe(
          200
        );


        expect(
          processAfricasTalkingVoiceRecording
        ).toHaveBeenCalledWith({
          recordingUrl,

          sessionId,

          languagePair:
            "ha-en",

          notifyBySms:
            true,

          phoneNumber:
            callerNumber,
        });


        expect(
          response.body
        ).toMatchObject({
          ok:
            true,

          recordingAccepted:
            true,

          processingEnabled:
            true,

          processingCompleted:
            true,

          providerCallsPerformed:
            true,

          remoteFetchPerformed:
            true,

          audioDownloaded:
            true,

          moneyMovementPerformed:
            false,

          processing: {
            transcription: {
              provider:
                "sahara",

              model:
                "sahara-v2.5",

              transcriptReturned:
                false,
            },

            action: {
              executedAction:
                "create_payment_verification_case",

              moneyMovementPerformed:
                false,
            },
          },
        });


        const serialized =
          JSON.stringify(
            response.body
          );


        expect(serialized)
          .not.toContain(
            recordingUrl
          );

        expect(serialized)
          .not.toContain(
            "PRIVATE_TOKEN"
          );

        expect(serialized)
          .not.toContain(
            sessionId
          );

        expect(serialized)
          .not.toContain(
            callerNumber
          );
      }
    );


    test(
      "routes Pidgin-English telephone recording with pcm language pair",
      async () => {

        processAfricasTalkingVoiceRecording
          .mockResolvedValue({
            processingCompleted:
              true,

            languagePair:
              "pcm-en",

            recording: {
              downloaded:
                true,

              stored:
                false,
            },

            transcription: {
              completed:
                true,

              provider:
                "sahara",

              model:
                "sahara-v2.5",

              languageCode:
                "pcm",

              transcriptReturned:
                false,
            },

            action: {
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


        const response =
          await request(
            app
          )
            .post(
              "/api/codeswitch/africastalking/voice/recording?languagePair=pcm-en"
            )
            .type(
              "form"
            )
            .send({
              recordingUrl:
                "https://recordings.example.com/pidgin.wav",

              sessionId:
                "PRIVATE_PCM_SESSION",
            });


        expect(
          response.status
        ).toBe(
          200
        );


        expect(
          processAfricasTalkingVoiceRecording
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            languagePair:
              "pcm-en",

            notifyBySms:
              false,

            phoneNumber:
              null,
          })
        );
      }
    );


    test(
      "preserves metadata-only path without language pair",
      async () => {

        const response =
          await request(
            app
          )
            .post(
              "/api/codeswitch/africastalking/voice/recording"
            )
            .type(
              "form"
            )
            .send({
              recordingUrl:
                "https://recordings.example.com/legacy.wav",

              sessionId:
                "LEGACY_SESSION",
            });


        expect(
          response.status
        ).toBe(
          202
        );

        expect(
          response.body
        ).toMatchObject({
          ok:
            true,

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
        });

        expect(
          processAfricasTalkingVoiceRecording
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "returns sanitized processing failure",
      async () => {

        const error =
          new Error(
            "private Sahara upstream detail"
          );

        error.code =
          "SAHARA_UNAVAILABLE";

        error.statusCode =
          503;


        processAfricasTalkingVoiceRecording
          .mockRejectedValue(
            error
          );


        const response =
          await request(
            app
          )
            .post(
              "/api/codeswitch/africastalking/voice/recording?languagePair=ha-en"
            )
            .type(
              "form"
            )
            .send({
              recordingUrl:
                "https://recordings.example.com/call.wav",

              sessionId:
                "PRIVATE_FAILURE_SESSION",
            });


        expect(
          response.status
        ).toBe(
          503
        );

        expect(
          response.body
        ).toMatchObject({
          ok:
            false,

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
              "SAHARA_UNAVAILABLE",

            message:
              "VoiceBridge could not safely complete recording processing.",
          },
        });


        const serialized =
          JSON.stringify(
            response.body
          );

        expect(serialized)
          .not.toContain(
            "private Sahara upstream detail"
          );

        expect(serialized)
          .not.toContain(
            "PRIVATE_FAILURE_SESSION"
          );
      }
    );
  }
);
