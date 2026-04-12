import { API_BASE, apiRequest } from "../api";

const normalizeString = (value = "", fallback = "") => {
  const text = String(value || "").trim();
  return text || fallback;
};

const normalizeAction = (action) => {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    return null;
  }

  const type = normalizeString(action.type);
  const target = normalizeString(action.target);
  const label = normalizeString(action.label);
  const state =
    action.state && typeof action.state === "object" && !Array.isArray(action.state)
      ? action.state
      : {};

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
    payload:
      card.payload && typeof card.payload === "object" && !Array.isArray(card.payload)
        ? card.payload
        : {},
  };
};

const normalizePendingAction = (pendingAction) => {
  if (!pendingAction || typeof pendingAction !== "object" || Array.isArray(pendingAction)) {
    return null;
  }

  return {
    type: normalizeString(pendingAction.type, "unsupported"),
    label: normalizeString(pendingAction.label, "Action"),
    description: normalizeString(pendingAction.description),
    route: normalizeString(pendingAction.route),
    payload:
      pendingAction.payload && typeof pendingAction.payload === "object" && !Array.isArray(pendingAction.payload)
        ? pendingAction.payload
        : {},
  };
};

export const normalizeAssistantResponse = (payload = {}) => ({
  message:
    normalizeString(payload.message) ||
    "I can help with safe navigation, discovery, uploads, purchases, notifications, and captions.",
  actions: Array.isArray(payload.actions)
    ? payload.actions.map(normalizeAction).filter(Boolean)
    : [],
  cards: Array.isArray(payload.cards)
    ? payload.cards.map(normalizeCard).filter(Boolean)
    : [],
  requiresConfirmation: Boolean(payload.requiresConfirmation),
  pendingAction: normalizePendingAction(payload.pendingAction),
  conversationId: normalizeString(payload.conversationId),
});

export const sendAssistantMessage = async ({
  message,
  conversationId = "",
  pendingAction = null,
  context = null,
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

  const response = await apiRequest(`${API_BASE}/assistant/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return normalizeAssistantResponse(response);
};
