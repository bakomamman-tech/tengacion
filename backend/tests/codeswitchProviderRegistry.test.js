const {
  DEFAULT_PROVIDER_IDS,
  createCodeswitchProviderRegistry,
  createProviderDefinition,
  getCodeswitchProvider,
  isKnownCodeswitchProviderError,
} = require("../services/codeswitchProviderRegistry");

describe(
  "VoiceBridge CodeSwitch provider registry",
  () => {
    test(
      "registers the four benchmark providers in deterministic order",
      () => {
        const registry =
          createCodeswitchProviderRegistry();

        expect(
          registry.map(
            (provider) =>
              provider.id
          )
        ).toEqual(
          DEFAULT_PROVIDER_IDS
        );

        expect(
          DEFAULT_PROVIDER_IDS
        ).toEqual([
          "sahara",
          "openai",
          "whisper",
          "chirp",
        ]);
      }
    );

    test(
      "uses one shared transcription contract for every provider",
      async () => {
        const calls = {};

        const makeTranscribe =
          (providerId) =>
          jest.fn(async (input) => {
            calls[providerId] =
              input;

            return {
              provider:
                providerId,
              model:
                `${providerId}-model`,
              transcript:
                "Please check my order",
            };
          });

        const registry =
          createCodeswitchProviderRegistry({
            sahara: {
              transcribe:
                makeTranscribe(
                  "sahara"
                ),
            },
            openai: {
              transcribe:
                makeTranscribe(
                  "openai"
                ),
            },
            whisper: {
              transcribe:
                makeTranscribe(
                  "whisper"
                ),
            },
            chirp: {
              transcribe:
                makeTranscribe(
                  "chirp"
                ),
            },
          });

        const audio = {
          buffer:
            Buffer.from(
              "voicebridge-test"
            ),
          filename:
            "sample.wav",
          mimeType:
            "audio/wav",
        };

        await Promise.all(
          registry.map(
            (provider) =>
              provider.transcribe({
                audio,
                languagePair:
                  "ha-en",
                languageCode:
                  "ha",
              })
          )
        );

        for (
          const providerId of
          DEFAULT_PROVIDER_IDS
        ) {
          expect(
            calls[providerId]
          ).toEqual({
            ...audio,
            languagePair:
              "ha-en",
            languageCode:
              "ha",
          });
        }
      }
    );

    test(
      "keeps Sahara language mapping available through the common contract",
      async () => {
        const transcribe =
          jest.fn(
            async (input) => ({
              provider:
                "sahara",
              model:
                "sahara-v2.5",
              transcript:
                "Don Allah duba payment",
              languageCode:
                input.languageCode,
            })
          );

        const registry =
          createCodeswitchProviderRegistry({
            sahara: {
              transcribe,
            },
          });

        const sahara =
          getCodeswitchProvider(
            registry,
            "sahara"
          );

        const result =
          await sahara.transcribe({
            audio: {
              buffer:
                Buffer.from(
                  "audio"
                ),
              filename:
                "hausa.wav",
              mimeType:
                "audio/wav",
            },
            languagePair:
              "ha-en",
            languageCode:
              "ha",
          });

        expect(
          transcribe
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            languagePair:
              "ha-en",
            languageCode:
              "ha",
          })
        );

        expect(
          result.languageCode
        ).toBe("ha");
      }
    );

    test(
      "allows provider-specific known-error predicates",
      () => {
        class FakeProviderError
          extends Error {}

        const registry =
          createCodeswitchProviderRegistry({
            openai: {
              isKnownError:
                (error) =>
                  error instanceof
                  FakeProviderError,
            },
          });

        expect(
          isKnownCodeswitchProviderError(
            registry,
            new FakeProviderError(
              "expected"
            )
          )
        ).toBe(true);

        expect(
          isKnownCodeswitchProviderError(
            registry,
            new Error(
              "unexpected"
            )
          )
        ).toBe(false);
      }
    );

    test(
      "retrieves providers by id and rejects unknown providers",
      () => {
        const registry =
          createCodeswitchProviderRegistry();

        expect(
          getCodeswitchProvider(
            registry,
            "whisper"
          ).id
        ).toBe("whisper");

        expect(() =>
          getCodeswitchProvider(
            registry,
            "unknown-model"
          )
        ).toThrow(
          "Unknown VoiceBridge provider: unknown-model"
        );
      }
    );

    test(
      "freezes the registry and provider definitions",
      () => {
        const registry =
          createCodeswitchProviderRegistry();

        expect(
          Object.isFrozen(
            registry
          )
        ).toBe(true);

        for (
          const provider of
          registry
        ) {
          expect(
            Object.isFrozen(
              provider
            )
          ).toBe(true);
        }
      }
    );

    test(
      "validates custom provider definitions",
      () => {
        expect(() =>
          createProviderDefinition({
            id: "",
            transcribe:
              async () => ({}),
            isKnownError:
              () => false,
          })
        ).toThrow(
          "Provider id must be a non-empty string."
        );

        expect(() =>
          createProviderDefinition({
            id: "test",
            transcribe:
              null,
            isKnownError:
              () => false,
          })
        ).toThrow(
          "Provider test must expose a transcribe function."
        );
      }
    );

    test(
      "rejects transcription without an audio object",
      async () => {
        const registry =
          createCodeswitchProviderRegistry({
            sahara: {
              transcribe:
                jest.fn(),
            },
          });

        const sahara =
          getCodeswitchProvider(
            registry,
            "sahara"
          );

        await expect(
          sahara.transcribe({
            languagePair:
              "ha-en",
            languageCode:
              "ha",
          })
        ).rejects.toThrow(
          "Provider transcription requires an audio object."
        );
      }
    );
  }
);
