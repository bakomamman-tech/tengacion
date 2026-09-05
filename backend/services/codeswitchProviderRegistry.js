const {
  SaharaServiceError,
  transcribeWithSahara,
} = require("./saharaService");

const {
  OpenAiCodeswitchError,
  transcribeWithOpenAI,
} = require("./openAiCodeswitchService");

const {
  WhisperCodeswitchError,
  transcribeWithWhisper,
} = require("./whisperCodeswitchService");

const {
  ChirpCodeswitchError,
  transcribeWithChirp,
} = require("./chirpCodeswitchService");

const DEFAULT_PROVIDER_IDS = Object.freeze([
  "sahara",
  "openai",
  "whisper",
  "chirp",
]);

const createKnownErrorPredicate = (ErrorType) => {
  if (typeof ErrorType !== "function") {
    throw new TypeError(
      "Provider ErrorType must be a constructor."
    );
  }

  return (error) =>
    error instanceof ErrorType;
};

const createProviderDefinition = ({
  id,
  transcribe,
  isKnownError,
}) => {
  if (
    typeof id !== "string" ||
    !id.trim()
  ) {
    throw new TypeError(
      "Provider id must be a non-empty string."
    );
  }

  if (typeof transcribe !== "function") {
    throw new TypeError(
      `Provider ${id} must expose a transcribe function.`
    );
  }

  if (typeof isKnownError !== "function") {
    throw new TypeError(
      `Provider ${id} must expose an isKnownError function.`
    );
  }

  return Object.freeze({
    id,

    /**
     * Shared VoiceBridge provider contract.
     *
     * Every provider receives the same benchmark
     * context. Provider implementations may ignore
     * fields they do not need.
     */
    transcribe: async ({
      audio,
      languagePair,
      languageCode,
    } = {}) => {
      if (
        !audio ||
        typeof audio !== "object" ||
        Array.isArray(audio)
      ) {
        throw new TypeError(
          "Provider transcription requires an audio object."
        );
      }

      return transcribe({
        ...audio,
        languagePair,
        languageCode,
      });
    },

    isKnownError,
  });
};

const resolveOverride = (
  overrides,
  providerId
) => {
  const override =
    overrides?.[providerId];

  return override &&
    typeof override === "object" &&
    !Array.isArray(override)
    ? override
    : {};
};

const createCodeswitchProviderRegistry = (
  overrides = {}
) => {
  const saharaOverride =
    resolveOverride(
      overrides,
      "sahara"
    );

  const openAiOverride =
    resolveOverride(
      overrides,
      "openai"
    );

  const whisperOverride =
    resolveOverride(
      overrides,
      "whisper"
    );

  const chirpOverride =
    resolveOverride(
      overrides,
      "chirp"
    );

  const registry = [
    createProviderDefinition({
      id: "sahara",
      transcribe:
        saharaOverride.transcribe ||
        transcribeWithSahara,
      isKnownError:
        saharaOverride.isKnownError ||
        createKnownErrorPredicate(
          SaharaServiceError
        ),
    }),

    createProviderDefinition({
      id: "openai",
      transcribe:
        openAiOverride.transcribe ||
        transcribeWithOpenAI,
      isKnownError:
        openAiOverride.isKnownError ||
        createKnownErrorPredicate(
          OpenAiCodeswitchError
        ),
    }),

    createProviderDefinition({
      id: "whisper",
      transcribe:
        whisperOverride.transcribe ||
        transcribeWithWhisper,
      isKnownError:
        whisperOverride.isKnownError ||
        createKnownErrorPredicate(
          WhisperCodeswitchError
        ),
    }),

    createProviderDefinition({
      id: "chirp",
      transcribe:
        chirpOverride.transcribe ||
        transcribeWithChirp,
      isKnownError:
        chirpOverride.isKnownError ||
        createKnownErrorPredicate(
          ChirpCodeswitchError
        ),
    }),
  ];

  return Object.freeze(registry);
};

const getCodeswitchProvider = (
  registry,
  providerId
) => {
  if (!Array.isArray(registry)) {
    throw new TypeError(
      "registry must be an array."
    );
  }

  const provider =
    registry.find(
      (entry) =>
        entry?.id === providerId
    );

  if (!provider) {
    throw new RangeError(
      `Unknown VoiceBridge provider: ${providerId}`
    );
  }

  return provider;
};

const isKnownCodeswitchProviderError = (
  registry,
  error
) => {
  if (!Array.isArray(registry)) {
    return false;
  }

  return registry.some(
    (provider) =>
      typeof provider?.isKnownError ===
        "function" &&
      provider.isKnownError(error)
  );
};

module.exports = {
  DEFAULT_PROVIDER_IDS,
  createCodeswitchProviderRegistry,
  createProviderDefinition,
  getCodeswitchProvider,
  isKnownCodeswitchProviderError,
};
