const {
  AfricasTalkingVoiceProcessingError,
  resolveLanguageCode,
  buildPrivateActionRequestId,
  processAfricasTalkingVoiceRecording,
} = require(
  "../services/africasTalkingVoiceProcessingService"
);


const TRANSCRIPT =
  "Don Allah check my payment na biya 5000 naira jiya amma ban samu confirmation ba.";


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

    stored:
      false,

    diskWritePerformed:
      false,
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
      TRANSCRIPT,

    providerFileId:
      "provider-file-123",

    processedAudioDurationSeconds:
      8.4,
  });


const buildOrchestration =
  () => ({
    version:
      "voicebridge-africastalking-orchestrator-v1",

    channel:
      "africastalking",

    actionCompleted:
      true,

    action: {
      actionVersion:
        "voicebridge-action-v1",

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

      case: {
        caseId:
          "VB-TEST-001",

        type:
          "payment_verification",

        status:
          "queued_for_verification",

        amount:
          5000,

        currency:
          "NGN",

        timeReference:
          "yesterday",

        transactionReference:
          null,
      },

      moneyMovementPerformed:
        false,
    },

    notification: {
      channel:
        "sms",

      requested:
        false,

      attempted:
        false,

      delivered:
        false,
    },

    transcriptReturned:
      false,

    transcriptStoredByOrchestrator:
      false,

    audioStoredByOrchestrator:
      false,

    moneyMovementPerformed:
      false,
  });


describe(
  "Africa's Talking Voice processing service",
  () => {

    test(
      "maps supported language pairs to Sahara codes",
      () => {

        expect(
          resolveLanguageCode(
            "ha-en"
          )
        ).toEqual({
          languagePair:
            "ha-en",

          languageCode:
            "ha",
        });

        expect(
          resolveLanguageCode(
            "pcm-en"
          )
        ).toEqual({
          languagePair:
            "pcm-en",

          languageCode:
            "pcm",
        });
      }
    );


    test(
      "rejects unsupported language pair",
      () => {

        expect(
          () =>
            resolveLanguageCode(
              "yo-en"
            )
        ).toThrow(
          AfricasTalkingVoiceProcessingError
        );
      }
    );


    test(
      "creates stable private request id without exposing session id",
      () => {

        const session =
          "AT_PRIVATE_SESSION_123456";

        const first =
          buildPrivateActionRequestId(
            session
          );

        const second =
          buildPrivateActionRequestId(
            session
          );

        expect(first)
          .toBe(second);

        expect(first)
          .toMatch(
            /^at-[a-f0-9]{40}$/
          );

        expect(first)
          .not.toContain(
            session
          );
      }
    );


    test(
      "runs recording through Sahara and safe downstream orchestration",
      async () => {

        const fetchRecording =
          jest.fn()
            .mockResolvedValue(
              buildRecording()
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

        const rawSession =
          "AT_PRIVATE_SESSION_ABC";

        const rawPhone =
          "+2348012345678";

        const recordingUrl =
          "https://recordings.example.com/private.wav?token=SECRET";

        const result =
          await processAfricasTalkingVoiceRecording(
            {
              recordingUrl,

              sessionId:
                rawSession,

              languagePair:
                "ha-en",

              notifyBySms:
                true,

              phoneNumber:
                rawPhone,
            },
            {
              fetchRecording,
              transcribe,
              orchestrate,
            }
          );


        expect(
          fetchRecording
        ).toHaveBeenCalledWith(
          recordingUrl
        );


        expect(
          transcribe
        ).toHaveBeenCalledWith({
          buffer:
            Buffer.from(
              "fake-audio"
            ),

          filename:
            "voicebridge-call.wav",

          mimeType:
            "audio/wav",

          languageCode:
            "ha",
        });


        expect(
          orchestrate
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            transcript:
              TRANSCRIPT,

            languagePair:
              "ha-en",

            requestId:
              expect.stringMatching(
                /^at-[a-f0-9]{40}$/
              ),

            notifyBySms:
              true,

            phoneNumber:
              rawPhone,
          })
        );


        expect(result)
          .toMatchObject({
            processingCompleted:
              true,

            languagePair:
              "ha-en",

            recording: {
              downloaded:
                true,

              mimeType:
                "audio/wav",

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

            transcriptReturned:
              false,

            audioReturned:
              false,

            rawRecordingUrlReturned:
              false,

            rawSessionIdReturned:
              false,

            rawPhoneNumberReturned:
              false,

            moneyMovementPerformed:
              false,
          });


        const serialized =
          JSON.stringify(
            result
          );

        expect(serialized)
          .not.toContain(
            TRANSCRIPT
          );

        expect(serialized)
          .not.toContain(
            rawSession
          );

        expect(serialized)
          .not.toContain(
            rawPhone
          );

        expect(serialized)
          .not.toContain(
            recordingUrl
          );

        expect(serialized)
          .not.toContain(
            "SECRET"
          );
      }
    );


    test(
      "uses pcm for Pidgin-English recordings",
      async () => {

        const fetchRecording =
          jest.fn()
            .mockResolvedValue(
              buildRecording()
            );

        const transcribe =
          jest.fn()
            .mockResolvedValue({
              ...buildTranscription(),

              languageCode:
                "pcm",
            });

        const orchestrate =
          jest.fn()
            .mockResolvedValue(
              buildOrchestration()
            );


        await processAfricasTalkingVoiceRecording(
          {
            recordingUrl:
              "https://recordings.example.com/call.wav",

            sessionId:
              "AT_PIDGIN_SESSION_123",

            languagePair:
              "pcm-en",
          },
          {
            fetchRecording,
            transcribe,
            orchestrate,
          }
        );


        expect(
          transcribe
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            languageCode:
              "pcm",
          })
        );


        expect(
          orchestrate
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            languagePair:
              "pcm-en",
          })
        );
      }
    );


    test(
      "rejects empty Sahara transcript before downstream action",
      async () => {

        const fetchRecording =
          jest.fn()
            .mockResolvedValue(
              buildRecording()
            );

        const transcribe =
          jest.fn()
            .mockResolvedValue({
              ...buildTranscription(),

              transcript:
                "   ",
            });

        const orchestrate =
          jest.fn();


        await expect(
          processAfricasTalkingVoiceRecording(
            {
              recordingUrl:
                "https://recordings.example.com/call.wav",

              sessionId:
                "AT_EMPTY_TRANSCRIPT_123",

              languagePair:
                "ha-en",
            },
            {
              fetchRecording,
              transcribe,
              orchestrate,
            }
          )
        ).rejects.toMatchObject({
          code:
            "AFRICASTALKING_EMPTY_TRANSCRIPT",
          statusCode:
            502,
        });


        expect(
          orchestrate
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "fails closed when downstream result violates safety invariant",
      async () => {

        const fetchRecording =
          jest.fn()
            .mockResolvedValue(
              buildRecording()
            );

        const transcribe =
          jest.fn()
            .mockResolvedValue(
              buildTranscription()
            );

        const orchestrate =
          jest.fn()
            .mockResolvedValue({
              ...buildOrchestration(),

              moneyMovementPerformed:
                true,
            });


        await expect(
          processAfricasTalkingVoiceRecording(
            {
              recordingUrl:
                "https://recordings.example.com/call.wav",

              sessionId:
                "AT_UNSAFE_SESSION_123",

              languagePair:
                "ha-en",
            },
            {
              fetchRecording,
              transcribe,
              orchestrate,
            }
          )
        ).rejects.toMatchObject({
          code:
            "AFRICASTALKING_UNSAFE_PROCESSING_RESULT",
          statusCode:
            500,
        });
      }
    );
  }
);
