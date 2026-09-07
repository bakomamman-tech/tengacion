const {
  config,
} = require("../../config/env");

const EMBEDDING_MODEL =
  process.env.TENGAAGENT_EMBEDDING_MODEL ||
  "text-embedding-3-small";

let cachedClient = null;

const getOpenAIConstructor = () => {
  const openaiModule =
    require("openai");

  return (
    openaiModule.OpenAI ||
    openaiModule.default ||
    openaiModule
  );
};

const createEmbeddingClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  if (!config.hasOpenAI) {
    return null;
  }

  const OpenAI =
    getOpenAIConstructor();

  cachedClient =
    new OpenAI({
      apiKey:
        config.OPENAI_API_KEY ||
        config.openAiApiKey,
    });

  return cachedClient;
};

const normalizeEmbeddingInput = (
  value
) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);

const embedTexts = async (
  values,
  {
    client =
      createEmbeddingClient(),
    model =
      EMBEDDING_MODEL,
  } = {}
) => {
  const inputs =
    (
      Array.isArray(values)
        ? values
        : []
    )
      .map(
        normalizeEmbeddingInput
      )
      .filter(Boolean);

  if (inputs.length === 0) {
    return [];
  }

  if (!client) {
    return null;
  }

  const response =
    await client.embeddings.create({
      model,
      input: inputs,
      encoding_format: "float",
    });

  const data =
    Array.isArray(response?.data)
      ? [...response.data]
      : [];

  data.sort(
    (a, b) =>
      Number(a.index) -
      Number(b.index)
  );

  const embeddings =
    data.map(
      (entry) =>
        Array.isArray(
          entry?.embedding
        )
          ? entry.embedding
          : []
    );

  if (
    embeddings.length !==
      inputs.length ||
    embeddings.some(
      (embedding) =>
        embedding.length === 0
    )
  ) {
    throw new Error(
      "TengaAgent embedding response was incomplete."
    );
  }

  return embeddings;
};

const embedText = async (
  value,
  options = {}
) => {
  const embeddings =
    await embedTexts(
      [value],
      options
    );

  if (!embeddings) {
    return null;
  }

  return embeddings[0] || null;
};

module.exports = {
  EMBEDDING_MODEL,
  createEmbeddingClient,
  embedText,
  embedTexts,
  normalizeEmbeddingInput,
};