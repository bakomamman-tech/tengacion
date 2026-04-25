const crypto = require("crypto");

const { config } = require("../config/env");
const { sanitizePlainObject } = require("../config/storage");
const {
  sanitizeCodeCapableText,
  sanitizeAssistantDetail,
  sanitizeAssistantSource,
  sanitizeMultilineText,
  sanitizePlainText,
  sanitizeRoute,
} = require("./assistant/outputSanitizer");

const normalizeList = (value = [], max = 6, maxLength = 160) =>
  [...new Set((Array.isArray(value) ? value : []).map((entry) => sanitizePlainText(entry, maxLength)).filter(Boolean))].slice(
    0,
    Math.max(0, Number(max) || 0)
  );

const normalizeActions = (actions = []) =>
  (Array.isArray(actions) ? actions : [])
    .map((action) => ({
      type: sanitizePlainText(action?.type || "", 40),
      label: sanitizePlainText(action?.label || "", 120),
      target: sanitizeRoute(action?.target || action?.route || ""),
    }))
    .filter((action) => {
      if (!action.type) {
        return false;
      }
      if (action.type === "navigate") {
        return Boolean(action.target && action.target.startsWith("/"));
      }
      return !action.target || action.target.startsWith("/");
    })
    .slice(0, 4);

const normalizeDrafts = (drafts = []) =>
  (Array.isArray(drafts) ? drafts : [])
    .map((entry) => sanitizeCodeCapableText(entry, 1200))
    .filter(Boolean)
    .slice(0, 3);

const normalizeDetails = (details = []) =>
  (Array.isArray(details) ? details : [])
    .map((entry) => sanitizeAssistantDetail(entry))
    .filter((entry) => entry.title && entry.body)
    .slice(0, 10);

const normalizeSources = (sources = []) =>
  (Array.isArray(sources) ? sources : [])
    .map((entry, index) => {
      if (typeof entry === "string") {
        const label = sanitizePlainText(entry, 120);
        if (!label) {
          return null;
        }
        return {
          id: `akuso-source-${index + 1}`,
          type: "akuso_source",
          label,
          summary: "",
        };
      }

      return sanitizeAssistantSource(entry);
    })
    .filter((entry) => entry?.id && entry?.type && entry?.label)
    .slice(0, 8);

const normalizeCards = (cards = []) =>
  (Array.isArray(cards) ? cards : [])
    .map((card) => {
      if (!card || typeof card !== "object" || Array.isArray(card)) {
        return null;
      }

      const title = sanitizePlainText(card?.title || "", 120);
      if (!title) {
        return null;
      }

      return {
        type: sanitizePlainText(card?.type || "card", 40) || "card",
        title,
        subtitle: sanitizePlainText(card?.subtitle || "", 200),
        description: sanitizeMultilineText(card?.description || "", 500),
        route: sanitizeRoute(card?.route || ""),
        payload:
          card?.payload && typeof card.payload === "object" && !Array.isArray(card.payload)
            ? sanitizePlainObject(card.payload, {
                maxDepth: 1,
                maxKeys: 8,
                maxStringLength: 200,
                maxArrayLength: 4,
              })
            : {},
      };
    })
    .filter(Boolean)
    .slice(0, 12);

const buildFeedbackToken = ({ traceId = "", conversationId = "" } = {}) => {
  const base = `${traceId}:${conversationId}`;
  const signature = crypto
    .createHmac("sha256", config.mediaSigningSecret || config.jwtSecret)
    .update(base)
    .digest("hex")
    .slice(0, 24);
  return `${traceId}.${signature}`;
};

const buildBaseResponse = ({
  ok = true,
  traceId = crypto.randomUUID(),
  mode = "knowledge_learning",
  category = "SAFE_ANSWER",
  answer = "",
  warnings = [],
  suggestions = [],
  actions = [],
  drafts = [],
  details = [],
  sources = [],
  cards = [],
  conversationId = "",
  meta = {},
} = {}) => ({
  ok: Boolean(ok),
  mode: sanitizePlainText(mode, 40) || "knowledge_learning",
  category: sanitizePlainText(category, 60) || "SAFE_ANSWER",
  answer:
    sanitizeCodeCapableText(answer, 6000) ||
    "Akuso can help with Tengacion app guidance, creator writing, and knowledge questions.",
  warnings: normalizeList(warnings, 4, 200),
  suggestions: normalizeList(suggestions, 6, 140),
  actions: normalizeActions(actions),
  drafts: normalizeDrafts(drafts),
  details: normalizeDetails(details),
  sources: normalizeSources(sources),
  cards: normalizeCards(cards),
  traceId: sanitizePlainText(traceId, 80),
  feedbackToken: buildFeedbackToken({ traceId, conversationId }),
  conversationId: sanitizePlainText(conversationId, 80),
  meta: {
    provider: sanitizePlainText(meta?.provider || "local_fallback", 40) || "local_fallback",
    model: sanitizePlainText(meta?.model || "", 80),
    task: sanitizePlainText(meta?.task || "", 40),
    grounded: meta?.grounded !== false,
    usedModel: Boolean(meta?.usedModel),
    safetyLevel: sanitizePlainText(meta?.safetyLevel || "safe", 20) || "safe",
    sources: normalizeList(meta?.sources || [], 8, 140),
  },
});

const formatAkusoChatResponse = (payload = {}) => buildBaseResponse(payload);

const formatAkusoHintsResponse = ({
  traceId,
  mode = "app_help",
  hints = [],
  currentRoute = "",
} = {}) => ({
  ok: true,
  mode,
  hints: normalizeList(hints, 8, 120),
  currentRoute: sanitizeRoute(currentRoute),
  traceId: sanitizePlainText(traceId, 80),
});

const formatAkusoFeedbackResponse = ({ traceId, feedbackId }) => ({
  ok: true,
  traceId: sanitizePlainText(traceId, 80),
  feedbackId: sanitizePlainText(feedbackId, 80),
});

const formatAkusoErrorResponse = ({
  traceId = crypto.randomUUID(),
  statusCode = 500,
  code = "AKUSO_ERROR",
  message = "Akuso could not complete that request right now.",
  suggestions = [],
} = {}) => ({
  statusCode,
  body: {
    ok: false,
    error: sanitizePlainText(code, 60) || "AKUSO_ERROR",
    message: sanitizePlainText(message, 240) || "Akuso could not complete that request right now.",
    suggestions: normalizeList(suggestions, 4, 140),
    traceId: sanitizePlainText(traceId, 80),
  },
});

module.exports = {
  buildFeedbackToken,
  formatAkusoChatResponse,
  formatAkusoErrorResponse,
  formatAkusoFeedbackResponse,
  formatAkusoHintsResponse,
};
