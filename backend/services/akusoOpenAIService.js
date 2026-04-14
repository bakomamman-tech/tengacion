const { config } = require("../config/env");
const { sanitizeMultilineText } = require("./assistant/outputSanitizer");

let cachedClient = null;

const getOpenAIConstructor = () => {
  const openaiModule = require("openai");
  return openaiModule.OpenAI || openaiModule.default || openaiModule;
};

const createClient = () => {
  if (cachedClient) {
    return cachedClient;
  }
  if (!config.akuso?.hasOpenAI) {
    return null;
  }

  const OpenAI = getOpenAIConstructor();
  cachedClient = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
  });
  return cachedClient;
};

const normalizeResponseText = (payload = {}) => {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
      if (typeof part?.text?.value === "string" && part.text.value.trim()) {
        return part.text.value.trim();
      }
    }
  }

  return "";
};

const parseStructuredPayload = (text = "") => {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

const withTimeout = (promise, timeoutMs) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error("Akuso OpenAI request timed out.");
      error.code = "AKUSO_OPENAI_TIMEOUT";
      error.status = 504;
      reject(error);
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const isTransientStatus = (statusCode = 0) =>
  [408, 409, 429, 500, 502, 503, 504].includes(Number(statusCode) || 0);

const handleOpenAIError = (error = {}) => {
  const status = Number(error?.status || error?.statusCode || 502) || 502;
  const retryable =
    error?.code === "AKUSO_OPENAI_TIMEOUT" || isTransientStatus(status);

  return {
    status,
    retryable,
    code: retryable ? "AKUSO_OPENAI_RETRYABLE" : "AKUSO_OPENAI_FAILURE",
    message: sanitizeMultilineText(
      retryable
        ? "Akuso could not reach OpenAI in time. A safe local fallback was used."
        : "Akuso could not complete the OpenAI request. A safe local fallback was used.",
      220
    ),
  };
};

const performRequest = async ({
  model,
  systemPrompt,
  userPrompt,
  responseSchema,
  timeoutMs = config.akuso?.requestTimeoutMs || 12000,
  maxOutputTokens = config.akuso?.maxOutputTokens || 600,
  requestName = "akuso_response",
  reasoningEffort = "minimal",
  verbosity = "low",
} = {}) => {
  const client = createClient();
  if (!client) {
    return null;
  }

  const textConfig = {};
  if (verbosity) {
    textConfig.verbosity = verbosity;
  }
  if (responseSchema) {
    textConfig.format = {
      type: "json_schema",
      name: requestName,
      strict: true,
      schema: responseSchema,
    };
  }

  const payload = {
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userPrompt }],
      },
    ],
    max_output_tokens: maxOutputTokens,
    reasoning: reasoningEffort
      ? {
          effort: reasoningEffort,
        }
      : undefined,
    text: Object.keys(textConfig).length > 0 ? textConfig : undefined,
  };

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await withTimeout(client.responses.create(payload), timeoutMs);
      const text = normalizeResponseText(response);
      return {
        model,
        raw: response,
        text,
        parsed: parseStructuredPayload(text),
      };
    } catch (error) {
      const handled = handleOpenAIError(error);
      lastError = Object.assign(new Error(handled.message), handled);
      if (!handled.retryable || attempt === 2) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error("Akuso OpenAI request failed.");
};

const sendChatRequest = (options = {}) =>
  performRequest({
    reasoningEffort: "minimal",
    ...options,
    verbosity: options.verbosity || "low",
    requestName: "akuso_chat",
  });

const sendWritingRequest = (options = {}) =>
  performRequest({
    reasoningEffort: "low",
    ...options,
    verbosity: options.verbosity || "medium",
    requestName: "akuso_writing",
  });

const sendReasoningRequest = (options = {}) =>
  performRequest({
    reasoningEffort: "medium",
    ...options,
    verbosity: options.verbosity || "medium",
    requestName: "akuso_reasoning",
  });

module.exports = {
  createClient,
  handleOpenAIError,
  normalizeResponseText,
  sendChatRequest,
  sendReasoningRequest,
  sendWritingRequest,
};
