const {
  config,
} = require("../../config/env");

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

const createClient = () => {
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

const withTimeout = (
  promise,
  timeoutMs = 15000
) =>
  new Promise(
    (resolve, reject) => {
      const timer =
        setTimeout(() => {
          const error =
            new Error(
              "TengaAgent AI request timed out."
            );

          error.code =
            "TENGAAGENT_AI_TIMEOUT";

          reject(error);
        }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    }
  );

const sanitizeHistory = (
  conversationHistory = []
) =>
  (
    Array.isArray(
      conversationHistory
    )
      ? conversationHistory
      : []
  )
    .filter(
      (entry) =>
        entry &&
        typeof entry.content ===
          "string" &&
        entry.content.trim()
    )
    .slice(-12)
    .map((entry) => ({
      role:
        entry.sender === "agent"
          ? "assistant"
          : "user",

      content:
        entry.content
          .trim()
          .slice(0, 2000),
    }));

const normalizeOutputText = (
  response
) => {
  if (
    typeof response?.output_text ===
      "string"
  ) {
    return response.output_text
      .trim();
  }

  const output =
    Array.isArray(
      response?.output
    )
      ? response.output
      : [];

  for (const item of output) {
    const content =
      Array.isArray(item?.content)
        ? item.content
        : [];

    for (const part of content) {
      if (
        typeof part?.text ===
          "string" &&
        part.text.trim()
      ) {
        return part.text.trim();
      }
    }
  }

  return "";
};

const generateTengaAgentReply =
  async ({
    instructions,
    conversationHistory = [],
    message,
  }) => {
    const client =
      createClient();

    if (!client) {
      return null;
    }

    const input =
      sanitizeHistory(
        conversationHistory
      );

    const latestMessage =
      String(message || "")
        .trim();

    const last =
      input[
        input.length - 1
      ];

    if (
      latestMessage &&
      !(
        last?.role === "user" &&
        last?.content ===
          latestMessage
      )
    ) {
      input.push({
        role: "user",
        content:
          latestMessage,
      });
    }

    if (input.length === 0) {
      return null;
    }

    const model =
      config.openAiModelFast ||
      "gpt-5.6-luna";

    const response =
      await withTimeout(
        client.responses.create({
          model,

          instructions,

          input,

          reasoning: {
            effort:
              /^gpt-5\.6(?:-|$)/i.test(
                model
              )
                ? "none"
                : "minimal",
          },

          text: {
            verbosity: "low",
          },

          max_output_tokens:
            450,
        }),
        15000
      );

    const reply =
      normalizeOutputText(
        response
      );

    if (!reply) {
      return null;
    }

    return {
      reply,
      model,
      provider: "openai",
    };
  };

module.exports = {
  createClient,
  generateTengaAgentReply,
  normalizeOutputText,
  sanitizeHistory,
};
