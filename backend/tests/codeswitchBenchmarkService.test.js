const {
  runCodeswitchBenchmark,
} = require("../services/codeswitchBenchmarkService");

const createProvider = ({
  id,
  transcribe,
  isKnownError = () => false,
}) => ({
  id,
  transcribe,
  isKnownError,
});

describe(
  "VoiceBridge CodeSwitch benchmark service",
  () => {
    test(
      "benchmarks all providers from the exact same audio Buffer",
      async () => {
        const receivedBuffers = [];

        const makeProvider =
          (id) =>
            createProvider({
              id,
              transcribe:
                jest.fn(
                  async ({
                    audio,
                  }) => {
                    receivedBuffers.push(
                      audio.buffer
                    );

                    return {
                      provider: id,
                      model:
                        `${id}-model`,
                      transcript:
                        "Don Allah check my order",
                      normalizedTranscript:
                        "don allah check my order",
                      normalizationVersion:
                        "voicebridge-nwer-v1",
                      latencyMs: 100,
                      processingStatus:
                        "FILE_TRANSCRIBED",
                      benchmarkMode:
                        true,
                    };
                  }
                ),
            });

        const providers = [
          makeProvider("sahara"),
          makeProvider("openai"),
          makeProvider("whisper"),
          makeProvider("chirp"),
        ];

        const buffer =
          Buffer.from(
            "shared-audio"
          );

        const result =
          await runCodeswitchBenchmark({
            audio: {
              buffer,
              filename:
                "support.wav",
              mimeType:
                "audio/wav",
            },
            languagePair:
              "ha-en",
            languageCode:
              "ha",
            referenceTranscript:
              "Don Allah check my order",
            providers,
            logger: {
              warn:
                jest.fn(),
            },
          });

        expect(
          receivedBuffers
        ).toHaveLength(4);

        for (
          const receivedBuffer of
          receivedBuffers
        ) {
          expect(
            receivedBuffer
          ).toBe(buffer);
        }

        expect(
          result.statusCode
        ).toBe(200);

        expect(
          result.body
        ).toEqual(
          expect.objectContaining({
            ok: true,
            languagePair:
              "ha-en",
            normalizationVersion:
              "voicebridge-nwer-v1",
            benchmarkMode:
              true,
            sameSourceAudio:
              true,
            sourceAudioBytes:
              buffer.length,
            successfulModels:
              4,
            requestedModels:
              4,
          })
        );

        expect(
          result.body.models
        ).toHaveLength(4);

        for (
          const model of
          result.body.models
        ) {
          expect(model.ok)
            .toBe(true);

          expect(
            model.evaluation
          ).toEqual(
            expect.objectContaining({
              wer: 0,
            })
          );
        }
      }
    );

    test(
      "removes providerFileId from successful provider results",
      async () => {
        const result =
          await runCodeswitchBenchmark({
            audio: {
              buffer:
                Buffer.from(
                  "audio"
                ),
              filename:
                "sample.wav",
              mimeType:
                "audio/wav",
            },
            languagePair:
              "ha-en",
            languageCode:
              "ha",
            providers: [
              createProvider({
                id: "sahara",
                transcribe:
                  async () => ({
                    provider:
                      "sahara",
                    model:
                      "sahara-v2.5",
                    transcript:
                      "hello",
                    providerFileId:
                      "secret-provider-id",
                  }),
              }),
            ],
            logger: {
              warn:
                jest.fn(),
            },
          });

        expect(
          result.body
            .models[0]
            .providerFileId
        ).toBeUndefined();
      }
    );

    test(
      "leaves WER evaluation null when no reference transcript is supplied",
      async () => {
        const result =
          await runCodeswitchBenchmark({
            audio: {
              buffer:
                Buffer.from(
                  "audio"
                ),
            },
            languagePair:
              "pcm-en",
            languageCode:
              "pcm",
            providers: [
              createProvider({
                id: "whisper",
                transcribe:
                  async () => ({
                    provider:
                      "whisper",
                    model:
                      "whisper-1",
                    transcript:
                      "Abeg check am",
                  }),
              }),
            ],
            logger: {
              warn:
                jest.fn(),
            },
          });

        expect(
          result.body
            .models[0]
            .evaluation
        ).toBeNull();
      }
    );

    test(
      "keeps successful providers when one known provider fails",
      async () => {
        class KnownError
          extends Error {
          constructor() {
            super(
              "Provider rate limited."
            );

            this.code =
              "RATE_LIMITED";
            this.statusCode =
              429;
          }
        }

        const logger = {
          warn: jest.fn(),
        };

        const result =
          await runCodeswitchBenchmark({
            audio: {
              buffer:
                Buffer.from(
                  "audio"
                ),
            },
            languagePair:
              "ha-en",
            languageCode:
              "ha",
            providers: [
              createProvider({
                id: "sahara",
                transcribe:
                  async () => ({
                    provider:
                      "sahara",
                    model:
                      "sahara-v2.5",
                    transcript:
                      "hello",
                  }),
              }),

              createProvider({
                id: "openai",
                transcribe:
                  async () => {
                    throw new KnownError();
                  },
                isKnownError:
                  (error) =>
                    error instanceof
                    KnownError,
              }),
            ],
            logger,
          });

        expect(
          result.statusCode
        ).toBe(200);

        expect(
          result.body
            .successfulModels
        ).toBe(1);

        expect(
          result.body
            .requestedModels
        ).toBe(2);

        expect(
          result.body
            .models[1]
        ).toEqual({
          ok: false,
          provider:
            "openai",
          error: {
            code:
              "RATE_LIMITED",
            message:
              "Provider rate limited.",
          },
        });

        expect(
          logger.warn
        ).toHaveBeenCalledWith(
          "[voicebridge:benchmark] provider failed",
          expect.objectContaining({
            provider:
              "openai",
            code:
              "RATE_LIMITED",
            statusCode:
              429,
          })
        );
      }
    );

    test(
      "returns 502 with safe errors when every provider fails",
      async () => {
        const result =
          await runCodeswitchBenchmark({
            audio: {
              buffer:
                Buffer.from(
                  "audio"
                ),
            },
            languagePair:
              "pcm-en",
            languageCode:
              "pcm",
            providers: [
              createProvider({
                id: "sahara",
                transcribe:
                  async () => {
                    throw new Error(
                      "internal secret"
                    );
                  },
              }),

              createProvider({
                id: "chirp",
                transcribe:
                  async () => {
                    throw new Error(
                      "credentials"
                    );
                  },
              }),
            ],
            logger: {
              warn:
                jest.fn(),
            },
          });

        expect(
          result.statusCode
        ).toBe(502);

        expect(
          result.body.ok
        ).toBe(false);

        expect(
          result.body
            .successfulModels
        ).toBe(0);

        expect(
          result.body.models
        ).toEqual([
          {
            ok: false,
            provider:
              "sahara",
            error: {
              code:
                "PROVIDER_FAILED",
              message:
                "sahara transcription failed unexpectedly.",
            },
          },
          {
            ok: false,
            provider:
              "chirp",
            error: {
              code:
                "PROVIDER_FAILED",
              message:
                "chirp transcription failed unexpectedly.",
            },
          },
        ]);
      }
    );

    test(
      "rejects malformed benchmark inputs",
      async () => {
        await expect(
          runCodeswitchBenchmark({
            audio: {},
            providers: [
              createProvider({
                id: "sahara",
                transcribe:
                  async () => ({}),
              }),
            ],
          })
        ).rejects.toThrow(
          "Benchmark audio must contain a Buffer."
        );

        await expect(
          runCodeswitchBenchmark({
            audio: {
              buffer:
                Buffer.from(
                  "audio"
                ),
            },
            providers: [],
          })
        ).rejects.toThrow(
          "Benchmark providers must be a non-empty array."
        );

        await expect(
          runCodeswitchBenchmark({
            audio: {
              buffer:
                Buffer.from(
                  "audio"
                ),
            },
            providers: [
              createProvider({
                id: "sahara",
                transcribe:
                  async () => ({}),
              }),
            ],
            referenceTranscript:
              42,
          })
        ).rejects.toThrow(
          "referenceTranscript must be a string."
        );
      }
    );
  }
);

describe(
  "VoiceBridge downstream-integrated benchmark",
  () => {
    const gold = {
      intent:
        "payment_confirmation_check",
      requestedAction:
        "check_payment_status",
      entities: {
        amount: 5000,
        currency: "NGN",
        timeReference:
          "yesterday",
        transactionReference:
          null,
      },
    };

    const successTranscript =
      "Don Allah check my payment na biya naira dubu biyar jiya amma ban samu confirmation ba";

    test(
      "adds downstream task-success metrics when gold labels are supplied",
      async () => {
        const providers = [
          {
            id: "sahara",
            isKnownError:
              () => false,
            transcribe:
              async () => ({
                provider:
                  "sahara",
                model:
                  "sahara-v2.5",
                transcript:
                  successTranscript,
              }),
          },
          {
            id: "openai",
            isKnownError:
              () => false,
            transcribe:
              async () => ({
                provider:
                  "openai",
                model:
                  "gpt-transcribe",
                transcript:
                  successTranscript,
              }),
          },
        ];

        const result =
          await runCodeswitchBenchmark({
            audio: {
              buffer:
                Buffer.from(
                  "phase-five-audio"
                ),
            },
            languagePair:
              "ha-en",
            languageCode:
              "ha",
            referenceTranscript:
              successTranscript,
            downstreamGold:
              gold,
            providers,
            logger: {
              warn:
                jest.fn(),
            },
          });

        expect(
          result.statusCode
        ).toBe(200);

        expect(
          result.body
            .downstreamEvaluation
        ).toEqual(
          expect.objectContaining({
            evaluationVersion:
              "voicebridge-downstream-eval-v1",
            evaluationOnly:
              true,
            databaseWritesPerformed:
              false,
            moneyMovementPerformed:
              false,
            languagePair:
              "ha-en",
            requestedModels:
              2,
            evaluatedModels:
              2,
          })
        );

        expect(
          result.body
            .downstreamEvaluation
            .summary
        ).toEqual({
          modelCompletionRate:
            1,
          intentAccuracy:
            1,
          requestedActionAccuracy:
            1,
          entityExactMatchRate:
            1,
          taskSuccessCount:
            2,
          taskSuccessRate:
            1,
        });

        expect(
          result.body
            .downstreamEvaluation
            .models
            .every(
              (model) =>
                model.taskSuccess ===
                true
            )
        ).toBe(true);
      }
    );

    test(
      "keeps WER-only benchmark responses backward-compatible",
      async () => {
        const result =
          await runCodeswitchBenchmark({
            audio: {
              buffer:
                Buffer.from(
                  "wer-only"
                ),
            },
            languagePair:
              "pcm-en",
            languageCode:
              "pcm",
            providers: [
              {
                id:
                  "whisper",
                isKnownError:
                  () => false,
                transcribe:
                  async () => ({
                    provider:
                      "whisper",
                    model:
                      "whisper-1",
                    transcript:
                      "Abeg check am",
                  }),
              },
            ],
            logger: {
              warn:
                jest.fn(),
            },
          });

        expect(
          result.body
            .downstreamEvaluation
        ).toBeUndefined();
      }
    );

    test(
      "validates downstream gold before making provider calls",
      async () => {
        const transcribe =
          jest.fn(
            async () => ({
              provider:
                "sahara",
              transcript:
                successTranscript,
            })
          );

        await expect(
          runCodeswitchBenchmark({
            audio: {
              buffer:
                Buffer.from(
                  "audio"
                ),
            },
            languagePair:
              "ha-en",
            languageCode:
              "ha",
            downstreamGold: {
              intent: "",
              requestedAction:
                "check_payment_status",
              entities: {},
            },
            providers: [
              {
                id:
                  "sahara",
                transcribe,
                isKnownError:
                  () => false,
              },
            ],
          })
        ).rejects.toThrow(
          "gold.intent must be a non-empty string."
        );

        expect(
          transcribe
        ).not.toHaveBeenCalled();
      }
    );
  }
);
