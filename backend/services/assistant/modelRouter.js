const { z } = require("zod");

const { config } = require("../../config/env");
const logger = require("../../utils/logger");
const { sanitizeMultilineText, sanitizePlainText } = require("./outputSanitizer");
const { buildRetrievedContextSummary } = require("./retrieval");
const { buildAssistantSystemPrompt } = require("./systemPrompt");
const { normalizeWritingPreferences } = require("./writingProfiles");

const MODEL_TIMEOUT_MS = Number(config.assistantModelTimeoutMs || 9000);
const ELIGIBLE_MODES = new Set(["knowledge", "writing", "copilot", "general"]);

const modelPayloadSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    details: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(120),
          body: z.string().trim().min(1).max(1200),
        })
      )
      .max(4)
      .optional()
      .default([]),
    followUps: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(120),
          prompt: z.string().trim().min(1).max(240),
        })
      )
      .max(4)
      .optional()
      .default([]),
    drafts: z.array(z.string().trim().min(1).max(500)).max(3).optional().default([]),
    confidence: z.number().min(0).max(1).optional().default(0.74),
  })
  .strict();

const extractJsonText = (payload = {}) => {
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

  const chatContent = payload?.choices?.[0]?.message?.content;
  if (typeof chatContent === "string" && chatContent.trim()) {
    return chatContent.trim();
  }

  return "";
};

const parseModelJson = (raw = "") => {
  const text = String(raw || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!text) return null;

  try {
    return modelPayloadSchema.parse(JSON.parse(text));
  } catch {
    return null;
  }
};

const buildUserPrompt = ({
  message = "",
  fallbackResponse = {},
  classification = {},
  retrieved = {},
  preferences = {},
} = {}) => {
  const trustedFacts = buildRetrievedContextSummary(retrieved).slice(0, 8);
  const normalizedPreferences = normalizeWritingPreferences(preferences);
  const writingHint =
    classification?.mode === "writing"
      ? `Writing preferences:
- Tone: ${normalizedPreferences.tone}
- Audience: ${normalizedPreferences.audience}
- Length: ${normalizedPreferences.length}
- Simplicity: ${normalizedPreferences.simplicity}
- Language: ${normalizedPreferences.language}`
      : "";

  const cards = Array.isArray(fallbackResponse?.cards)
    ? fallbackResponse.cards
        .slice(0, 3)
        .map((card, index) => `${index + 1}. ${sanitizePlainText(card?.title || "Draft", 120)} :: ${sanitizePlainText(card?.description || "", 500)}`)
        .join("\n")
    : "";

  return `
Revise the existing safe Akuso reply. Return JSON only.

Rules:
- Never invent Tengacion routes, buttons, permissions, or admin powers.
- Do not change or add actions, pending actions, or navigation routes.
- Use only the trusted facts below for app-specific claims.
- If the trusted facts are limited, keep the fallback meaning and state uncertainty briefly.
- Keep the tone clear, warm, professional, concise-first, and African-aware without stereotypes.
- If this is a writing request, produce up to 3 stronger draft options in "drafts".
- If this is not a writing request, return an empty drafts array.

User request (untrusted):
${sanitizeMultilineText(message, 1000)}

Fallback safe reply:
Message: ${sanitizeMultilineText(fallbackResponse?.message || "", 1000)}
Details:
${(fallbackResponse?.details || []).map((detail) => `- ${sanitizePlainText(detail?.title || "", 120)}: ${sanitizeMultilineText(detail?.body || "", 1200)}`).join("\n") || "- none"}
Follow ups:
${(fallbackResponse?.followUps || []).map((followUp) => `- ${sanitizePlainText(followUp?.label || "", 120)} => ${sanitizePlainText(followUp?.prompt || "", 240)}`).join("\n") || "- none"}
Fallback drafts:
${cards || "- none"}

Request mode: ${sanitizePlainText(classification?.mode || "general", 40)}
Request category: ${sanitizePlainText(classification?.category || "knowledge", 40)}
Trusted facts:
${trustedFacts.length > 0 ? trustedFacts.map((line) => `- ${sanitizeMultilineText(line, 400)}`).join("\n") : "- none"}

${writingHint}

Output JSON schema:
{
  "message": "string",
  "details": [{"title": "string", "body": "string"}],
  "followUps": [{"label": "string", "prompt": "string"}],
  "drafts": ["string"],
  "confidence": 0.0
}
`.trim();
};

const shouldUseModel = ({ classification = {}, retrieved = {} } = {}) => {
  if (!config.hasOpenAI || config.nodeEnv === "test") return false;
  const mode = String(classification?.mode || "general").trim().toLowerCase() || "general";
  if (!ELIGIBLE_MODES.has(mode)) return false;
  if (["prompt_injection", "disallowed", "emergency", "medical", "sensitive_action", "math"].includes(classification?.category)) {
    return false;
  }
  if (mode === "copilot") {
    return Boolean(retrieved?.feature || (retrieved?.helpArticles || []).length > 0);
  }
  if (mode === "general") {
    return Boolean(
      retrieved?.feature ||
      (retrieved?.helpArticles || []).length > 0 ||
      (retrieved?.knowledgeArticles || []).length > 0
    );
  }
  return true;
};

const callResponsesApi = async ({ systemPrompt, userPrompt, signal }) => {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openAiModel,
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
      text: {
        format: {
          type: "json_schema",
          name: "akuso_revision",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              message: { type: "string" },
              details: {
                type: "array",
                maxItems: 4,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    body: { type: "string" },
                  },
                  required: ["title", "body"],
                },
              },
              followUps: {
                type: "array",
                maxItems: 4,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    label: { type: "string" },
                    prompt: { type: "string" },
                  },
                  required: ["label", "prompt"],
                },
              },
              drafts: {
                type: "array",
                maxItems: 3,
                items: { type: "string" },
              },
              confidence: { type: "number" },
            },
            required: ["message", "details", "followUps", "drafts", "confidence"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI responses API failed with ${response.status}`);
  }

  return response.json();
};

const buildDraftCards = ({ drafts = [], fallbackCards = [], preferences = {} } = {}) => {
  const tone = sanitizePlainText(preferences?.tone || "warm", 40) || "warm";
  const audience = sanitizePlainText(preferences?.audience || "general public", 40) || "general public";
  const length = sanitizePlainText(preferences?.length || "short", 20) || "short";
  const simplicity = sanitizePlainText(preferences?.simplicity || "standard", 20) || "standard";
  const language = sanitizePlainText(preferences?.language || "English", 40) || "English";

  if (!Array.isArray(drafts) || drafts.length === 0) {
    return fallbackCards;
  }

  return drafts.slice(0, 3).map((draft, index) => ({
    type: "draft",
    title: `Draft ${index + 1}`,
    subtitle: `${tone} | ${audience}`,
    description: sanitizeMultilineText(draft, 500),
    route: "",
    payload: {
      text: sanitizeMultilineText(draft, 500),
      tone,
      audience,
      length,
      simplicity,
      language,
    },
  }));
};

const enhanceAssistantResponse = async ({
  user = null,
  message = "",
  assistantContext = {},
  classification = {},
  retrieved = {},
  preferences = {},
  memory = {},
  fallbackResponse = {},
} = {}) => {
  if (!shouldUseModel({ classification, retrieved })) {
    return null;
  }

  const systemPrompt = buildAssistantSystemPrompt({
    user,
    assistantContext,
    classification,
    retrieved,
    preferences,
    memory,
  });
  const userPrompt = buildUserPrompt({
    message,
    fallbackResponse,
    classification,
    retrieved,
    preferences,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Assistant model timeout")), MODEL_TIMEOUT_MS);

  try {
    const payload = await callResponsesApi({
      systemPrompt,
      userPrompt,
      signal: controller.signal,
    });
    const parsed = parseModelJson(extractJsonText(payload));

    if (!parsed) {
      return null;
    }

    return {
      provider: "openai",
      usedModel: true,
      response: {
        ...fallbackResponse,
        message: sanitizeMultilineText(parsed.message, 1000) || fallbackResponse.message,
        details:
          Array.isArray(parsed.details) && parsed.details.length > 0
            ? parsed.details.map((detail) => ({
                title: sanitizePlainText(detail.title, 120),
                body: sanitizeMultilineText(detail.body, 1200),
              }))
            : fallbackResponse.details,
        followUps:
          Array.isArray(parsed.followUps) && parsed.followUps.length > 0
            ? parsed.followUps.map((followUp) => ({
                label: sanitizePlainText(followUp.label, 120),
                prompt: sanitizePlainText(followUp.prompt, 240),
              }))
            : fallbackResponse.followUps,
        cards:
          classification?.mode === "writing"
            ? buildDraftCards({
                drafts: parsed.drafts,
                fallbackCards: fallbackResponse.cards,
                preferences,
              })
            : fallbackResponse.cards,
        confidence:
          Number.isFinite(parsed.confidence) && parsed.confidence > 0
            ? Math.min(0.97, Math.max(Number(fallbackResponse?.confidence || 0.6), parsed.confidence))
            : fallbackResponse.confidence,
      },
    };
  } catch (error) {
    logger.warn("assistant.model.enhance_failed", {
      userId: user?.id || "",
      category: classification?.category || "unknown",
      mode: classification?.mode || "general",
      message: error?.message || "Unknown model enhancement failure",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = {
  enhanceAssistantResponse,
};
