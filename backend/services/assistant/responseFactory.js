const {
  sanitizeAssistantDetail,
  sanitizeAssistantFollowUp,
  sanitizeAssistantSafety,
  sanitizeMultilineText,
  sanitizePlainText,
  sanitizeRoute,
} = require("./outputSanitizer");

const normalizeCards = (cards = []) => (Array.isArray(cards) ? cards.filter(Boolean) : []);
const normalizeActions = (actions = []) => (Array.isArray(actions) ? actions.filter(Boolean) : []);
const normalizeDetails = (details = []) => (Array.isArray(details) ? details.map(sanitizeAssistantDetail).filter((entry) => entry.title || entry.body) : []);
const normalizeFollowUps = (followUps = []) =>
  (Array.isArray(followUps) ? followUps.map(sanitizeAssistantFollowUp).filter((entry) => entry.label || entry.prompt) : []);

const makeAssistantResponse = ({
  message = "",
  mode = "general",
  safety = {},
  details = [],
  followUps = [],
  actions = [],
  cards = [],
  requiresConfirmation = false,
  pendingAction = null,
  conversationId = "",
  confidence = 0.6,
} = {}) => ({
  message: sanitizeMultilineText(message, 1000) || "I can help with Tengacion, writing, learning, and safe navigation.",
  mode: sanitizePlainText(mode, 40) || "general",
  safety: sanitizeAssistantSafety(safety),
  details: normalizeDetails(details),
  followUps: normalizeFollowUps(followUps),
  actions: normalizeActions(actions).map((action) => ({
    ...action,
    target: sanitizeRoute(action?.target || ""),
    label: sanitizePlainText(action?.label || "", 120),
  })),
  cards: normalizeCards(cards),
  requiresConfirmation: Boolean(requiresConfirmation),
  pendingAction:
    pendingAction && typeof pendingAction === "object"
      ? {
          ...pendingAction,
          route: sanitizeRoute(pendingAction?.route || ""),
          label: sanitizePlainText(pendingAction?.label || "", 120),
          description: sanitizePlainText(pendingAction?.description || "", 400),
        }
      : null,
  conversationId: sanitizePlainText(conversationId, 80),
  confidence: Number.isFinite(Number(confidence)) ? Math.max(0, Math.min(1, Number(confidence))) : 0.6,
});

const makeSafeNavigationResponse = ({
  message = "",
  route = "",
  label = "",
  state = {},
  mode = "copilot",
  followUps = [],
  details = [],
  cards = [],
  safety = { level: "safe", notice: "", escalation: "" },
  conversationId = "",
  confidence = 0.82,
} = {}) =>
  makeAssistantResponse({
    message,
    mode,
    safety,
    details,
    followUps,
    actions: [
      {
        type: "navigate",
        target: route,
        label,
        state: state && typeof state === "object" && !Array.isArray(state) ? state : {},
      },
    ],
    cards,
    requiresConfirmation: false,
    pendingAction: null,
    conversationId,
    confidence,
  });

const makeRefusalResponse = ({
  message,
  safety = { level: "refusal", notice: "", escalation: "" },
  details = [],
  followUps = [],
  conversationId = "",
  confidence = 0.95,
} = {}) =>
  makeAssistantResponse({
    message,
    mode: "refusal",
    safety,
    details,
    followUps,
    actions: [],
    cards: [],
    requiresConfirmation: false,
    pendingAction: null,
    conversationId,
    confidence,
  });

const makeKnowledgeResponse = ({
  message,
  details = [],
  followUps = [],
  cards = [],
  conversationId = "",
  safety = { level: "safe", notice: "", escalation: "" },
  confidence = 0.72,
  mode = "knowledge",
} = {}) =>
  makeAssistantResponse({
    message,
    mode,
    safety,
    details,
    followUps,
    actions: [],
    cards,
    requiresConfirmation: false,
    pendingAction: null,
    conversationId,
    confidence,
  });

const makeWritingResponse = ({
  message,
  details = [],
  followUps = [],
  cards = [],
  conversationId = "",
  safety = { level: "safe", notice: "", escalation: "" },
  confidence = 0.8,
  mode = "writing",
} = {}) =>
  makeAssistantResponse({
    message,
    mode,
    safety,
    details,
    followUps,
    actions: [],
    cards,
    requiresConfirmation: false,
    pendingAction: null,
    conversationId,
    confidence,
  });

const makeMathResponse = ({
  message,
  details = [],
  followUps = [],
  cards = [],
  conversationId = "",
  safety = { level: "safe", notice: "", escalation: "" },
  confidence = 0.86,
} = {}) =>
  makeAssistantResponse({
    message,
    mode: "math",
    safety,
    details,
    followUps,
    actions: [],
    cards,
    requiresConfirmation: false,
    pendingAction: null,
    conversationId,
    confidence,
  });

const makeHealthResponse = ({
  message,
  details = [],
  followUps = [],
  cards = [],
  conversationId = "",
  safety = { level: "caution", notice: "", escalation: "" },
  confidence = 0.84,
  mode = "health",
} = {}) =>
  makeAssistantResponse({
    message,
    mode,
    safety,
    details,
    followUps,
    actions: [],
    cards,
    requiresConfirmation: false,
    pendingAction: null,
    conversationId,
    confidence,
  });

module.exports = {
  makeAssistantResponse,
  makeHealthResponse,
  makeKnowledgeResponse,
  makeMathResponse,
  makeRefusalResponse,
  makeSafeNavigationResponse,
  makeWritingResponse,
};
