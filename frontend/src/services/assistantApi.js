import { API_BASE, apiRequest } from "../api";

const normalizeString = (value = "", fallback = "") => {
  const text = String(value || "").trim();
  return text || fallback;
};

const normalizeDetails = (details = []) =>
  Array.isArray(details)
    ? details
        .map((detail) => {
          if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
            return null;
          }

          return {
            title: normalizeString(detail.title),
            body: normalizeString(detail.body),
          };
        })
        .filter(Boolean)
    : [];

const normalizeFollowUps = (followUps = []) =>
  Array.isArray(followUps)
    ? followUps
        .map((followUp) => {
          if (!followUp || typeof followUp !== "object" || Array.isArray(followUp)) {
            return null;
          }

          return {
            label: normalizeString(followUp.label),
            prompt: normalizeString(followUp.prompt),
            kind: normalizeString(followUp.kind, "prompt"),
            route: normalizeString(followUp.route),
          };
        })
        .filter(Boolean)
    : [];

const normalizeAction = (action) => {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    return null;
  }

  const type = normalizeString(action.type);
  const target = normalizeString(action.target);
  const label = normalizeString(action.label);
  const state = action.state && typeof action.state === "object" && !Array.isArray(action.state) ? action.state : {};

  if (!type) {
    return null;
  }

  return {
    type,
    target,
    label,
    state,
  };
};

const normalizeCard = (card) => {
  if (!card || typeof card !== "object" || Array.isArray(card)) {
    return null;
  }

  return {
    type: normalizeString(card.type, "card"),
    title: normalizeString(card.title, "Untitled"),
    subtitle: normalizeString(card.subtitle),
    description: normalizeString(card.description),
    route: normalizeString(card.route),
    payload: card.payload && typeof card.payload === "object" && !Array.isArray(card.payload) ? card.payload : {},
  };
};

const normalizeSafety = (safety = {}) => ({
  level: ["safe", "caution", "refusal", "emergency"].includes(normalizeString(safety.level, "safe").toLowerCase())
    ? normalizeString(safety.level, "safe").toLowerCase()
    : "safe",
  notice: normalizeString(safety.notice),
  escalation: normalizeString(safety.escalation),
});

const normalizeSource = (source) => {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  return {
    id: normalizeString(source.id),
    type: normalizeString(source.type),
    label: normalizeString(source.label),
    summary: normalizeString(source.summary),
  };
};

const normalizeTrust = (trust = {}) => ({
  provider: normalizeString(trust.provider, "local-fallback"),
  mode: normalizeString(trust.mode, "general"),
  grounded: trust?.grounded !== false,
  usedModel: Boolean(trust?.usedModel),
  confidenceLabel: normalizeString(trust.confidenceLabel, "medium"),
  note: normalizeString(trust.note),
});

export const normalizeAssistantResponse = (payload = {}) => ({
  responseId: normalizeString(payload.responseId),
  message:
    normalizeString(payload.message) ||
    "I can help with safe navigation, discovery, uploads, purchases, notifications, writing, math, and learning.",
  mode: normalizeString(payload.mode, "general"),
  safety: normalizeSafety(payload.safety),
  trust: normalizeTrust(payload.trust),
  sources: Array.isArray(payload.sources) ? payload.sources.map(normalizeSource).filter(Boolean) : [],
  details: normalizeDetails(payload.details),
  followUps: normalizeFollowUps(payload.followUps),
  actions: Array.isArray(payload.actions) ? payload.actions.map(normalizeAction).filter(Boolean) : [],
  cards: Array.isArray(payload.cards) ? payload.cards.map(normalizeCard).filter(Boolean) : [],
  requiresConfirmation: Boolean(payload.requiresConfirmation),
  pendingAction:
    payload.pendingAction && typeof payload.pendingAction === "object" && !Array.isArray(payload.pendingAction)
      ? {
          type: normalizeString(payload.pendingAction.type, "unsupported"),
          label: normalizeString(payload.pendingAction.label, "Action"),
          description: normalizeString(payload.pendingAction.description),
          route: normalizeString(payload.pendingAction.route),
          payload:
            payload.pendingAction.payload && typeof payload.pendingAction.payload === "object" && !Array.isArray(payload.pendingAction.payload)
              ? payload.pendingAction.payload
              : {},
        }
      : null,
  conversationId: normalizeString(payload.conversationId),
  confidence: Number.isFinite(Number(payload.confidence)) ? Number(payload.confidence) : 0.6,
});

export const sendAssistantMessage = async ({
  message,
  conversationId = "",
  pendingAction = null,
  context = null,
  assistantModeHint = "",
  preferences = null,
}) => {
  const body = {
    message: normalizeString(message),
  };

  if (conversationId) {
    body.conversationId = normalizeString(conversationId);
  }

  if (pendingAction) {
    body.pendingAction = pendingAction;
  }

  if (assistantModeHint) {
    body.assistantModeHint = normalizeString(assistantModeHint);
  }

  if (context && typeof context === "object" && !Array.isArray(context)) {
    body.context = {
      currentPath: normalizeString(context.currentPath),
      currentSearch: normalizeString(context.currentSearch),
      surface: normalizeString(context.surface, "general"),
      pageTitle: normalizeString(context.pageTitle),
      selectedChatId: normalizeString(context.selectedChatId),
      selectedContentId: normalizeString(context.selectedContentId),
    };
  }

  if (preferences && typeof preferences === "object" && !Array.isArray(preferences)) {
    body.preferences = {
      tone: normalizeString(preferences.tone),
      audience: normalizeString(preferences.audience),
      length: normalizeString(preferences.length),
      simplicity: normalizeString(preferences.simplicity),
      language: normalizeString(preferences.language),
    };
  }

  const response = await apiRequest(`${API_BASE}/assistant/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return normalizeAssistantResponse(response);
};

export const sendAssistantFeedback = async ({
  conversationId = "",
  messageId = "",
  responseId = "",
  rating,
  reason = "",
  mode = "",
  surface = "",
  responseMode = "",
  responseSummary = "",
  metadata = null,
}) => {
  const body = {
    rating,
  };

  if (conversationId) {body.conversationId = normalizeString(conversationId);}
  if (messageId) {body.messageId = normalizeString(messageId);}
  if (responseId) {body.responseId = normalizeString(responseId);}
  if (reason) {body.reason = normalizeString(reason, "");}
  if (mode) {body.mode = normalizeString(mode, "");}
  if (surface) {body.surface = normalizeString(surface, "");}
  if (responseMode) {body.responseMode = normalizeString(responseMode, "");}
  if (responseSummary) {body.responseSummary = normalizeString(responseSummary, "");}
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    body.metadata = metadata;
  }

  return apiRequest(`${API_BASE}/assistant/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
};
