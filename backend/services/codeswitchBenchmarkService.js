const {
  NORMALIZATION_VERSION,
  calculateWordErrorRate,
} = require("./codeswitchService");

const {
  createCodeswitchProviderRegistry,
} = require("./codeswitchProviderRegistry");

const validateBenchmarkAudio = (audio) => {
  if (
    !audio ||
    typeof audio !== "object" ||
    Array.isArray(audio) ||
    !Buffer.isBuffer(audio.buffer)
  ) {
    throw new TypeError(
      "Benchmark audio must contain a Buffer."
    );
  }
};

const validateProviders = (providers) => {
  if (
    !Array.isArray(providers) ||
    providers.length === 0
  ) {
    throw new TypeError(
      "Benchmark providers must be a non-empty array."
    );
  }

  for (const provider of providers) {
    if (
      !provider ||
      typeof provider.id !== "string" ||
      !provider.id.trim() ||
      typeof provider.transcribe !== "function" ||
      typeof provider.isKnownError !== "function"
    ) {
      throw new TypeError(
        "Every benchmark provider must expose id, transcribe, and isKnownError."
      );
    }
  }
};

const normalizeProviderFailure = ({
  provider,
  error,
}) => {
  const isKnownError =
    provider.isKnownError(error);

  return {
    ok: false,
    provider: provider.id,
    error: {
      code:
        isKnownError &&
        typeof error?.code === "string"
          ? error.code
          : "PROVIDER_FAILED",

      message:
        isKnownError &&
        typeof error?.message === "string"
          ? error.message
          : `${provider.id} transcription failed unexpectedly.`,
    },
    diagnostics: {
      isKnownError,
      statusCode:
        isKnownError &&
        Number.isInteger(
          error?.statusCode
        )
          ? error.statusCode
          : 502,
    },
  };
};

const runCodeswitchBenchmark = async ({
  audio,
  languagePair,
  languageCode,
  referenceTranscript = "",
  requestId = "",
  providers =
    createCodeswitchProviderRegistry(),
  logger = console,
} = {}) => {
  validateBenchmarkAudio(audio);
  validateProviders(providers);

  if (
    typeof referenceTranscript !==
    "string"
  ) {
    throw new TypeError(
      "referenceTranscript must be a string."
    );
  }

  const settled =
    await Promise.allSettled(
      providers.map(
        (provider) =>
          provider.transcribe({
            audio,
            languagePair,
            languageCode,
          })
      )
    );

  const models =
    settled.map(
      (entry, index) => {
        const provider =
          providers[index];

        if (
          entry.status ===
          "fulfilled"
        ) {
          const result =
            entry.value;

          const safeResult = {
            ...result,
          };

          delete safeResult.providerFileId;

          const evaluation =
            referenceTranscript.trim()
              ? calculateWordErrorRate({
                  reference:
                    referenceTranscript,
                  hypothesis:
                    result.transcript,
                })
              : null;

          return {
            ok: true,
            ...safeResult,
            languagePair,
            evaluation,
          };
        }

        const failure =
          normalizeProviderFailure({
            provider,
            error: entry.reason,
          });

        if (
          logger &&
          typeof logger.warn ===
            "function"
        ) {
          logger.warn(
            "[voicebridge:benchmark] provider failed",
            {
              requestId:
                requestId || "",
              provider:
                provider.id,
              code:
                failure.error
                  .code,
              statusCode:
                failure
                  .diagnostics
                  .statusCode,
              languagePair,
              fileSize:
                audio.buffer
                  .length,
            }
          );
        }

        const safeFailure = {
          ok: false,
          provider:
            failure.provider,
          error:
            failure.error,
        };

        return safeFailure;
      }
    );

  const successfulModels =
    models.filter(
      (model) =>
        model.ok === true
    ).length;

  const body = {
    ok:
      successfulModels > 0,

    languagePair,

    normalizationVersion:
      NORMALIZATION_VERSION,

    benchmarkMode: true,

    sameSourceAudio: true,

    sourceAudioBytes:
      audio.buffer.length,

    successfulModels,

    requestedModels:
      providers.length,

    models,
  };

  return {
    statusCode:
      successfulModels > 0
        ? 200
        : 502,

    body,
  };
};

module.exports = {
  normalizeProviderFailure,
  runCodeswitchBenchmark,
  validateBenchmarkAudio,
  validateProviders,
};
