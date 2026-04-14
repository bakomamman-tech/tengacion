import { API_BASE, apiRequest } from "../api";
import { getSessionAccessToken } from "../authSession";

const AKUSO_GUEST_SESSION_STORAGE_KEY = "akuso_guest_session_key";

const normalizeString = (value = "", fallback = "") => {
  const text = String(value || "").trim();
  return text || fallback;
};

const normalizeAssistantMode = (value = "") => {
  const mode = normalizeString(value).toLowerCase();
  if (mode === "copilot") {
    return "app_help";
  }
  if (mode === "writing") {
    return "creator_writing";
  }
  if (["knowledge", "math", "health"].includes(mode)) {
    return "knowledge_learning";
  }
  return "auto";
};

const normalizeAkusoAnswerLength = (value = "") => {
  const length = normalizeString(value).toLowerCase();
  if (length === "short") {
    return "short";
  }
  if (length === "long") {
    return "detailed";
  }
  return "medium";
};

const makeGuestSessionKey = () => {
  if (typeof window === "undefined") {
    return "guest-session";
  }

  try {
    const stored = window.localStorage.getItem(AKUSO_GUEST_SESSION_STORAGE_KEY);
    if (stored) {
      return stored;
    }

    const next =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(AKUSO_GUEST_SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return "guest-session";
  }
};

const normalizeAkusoCategory = (value = "") => normalizeString(value, "SAFE_ANSWER");

const supportsAkusoStreaming =
  typeof fetch === "function" &&
  typeof TextDecoder !== "undefined" &&
  typeof ReadableStream !== "undefined";

const buildAkusoRequestBody = ({
  message,
  conversationId = "",
  context = null,
  assistantModeHint = "",
  preferences = null,
  stream = false,
}) => {
  const normalizedPreferredMode = normalizeString(assistantModeHint);
  const body = {
    message: normalizeString(message),
    mode: normalizeAssistantMode(assistantModeHint),
    sessionKey: makeGuestSessionKey(),
    stream: Boolean(stream),
  };

  if (conversationId) {
    body.conversationId = normalizeString(conversationId);
  }

  if (context && typeof context === "object" && !Array.isArray(context)) {
    body.currentRoute = normalizeString(context.currentPath);
    body.currentPage = normalizeString(context.pageTitle);
    body.contextHints = {
      surface: normalizeString(context.surface, "general"),
      pageTitle: normalizeString(context.pageTitle),
      section: normalizeString(context.currentSearch),
      selectedEntity:
        normalizeString(context.selectedChatId) || normalizeString(context.selectedContentId),
    };
  }

  if (preferences && typeof preferences === "object" && !Array.isArray(preferences)) {
    body.preferences = {
      answerLength: normalizeAkusoAnswerLength(preferences.length),
      tone: normalizeString(preferences.tone),
      preferredMode: normalizedPreferredMode,
      creatorStyle: normalizeString(preferences.simplicity),
      audience: normalizeString(preferences.audience),
      language: normalizeString(preferences.language),
    };
  } else if (normalizedPreferredMode) {
    body.preferences = {
      answerLength: "medium",
      tone: "",
      preferredMode: normalizedPreferredMode,
      creatorStyle: "",
      audience: "",
      language: "",
    };
  }

  return body;
};

const buildAkusoHintsQuery = ({
  context = null,
  assistantModeHint = "",
  query = "",
} = {}) => {
  const params = new URLSearchParams();
  const normalizedQuery = normalizeString(query);
  const normalizedMode = normalizeAssistantMode(assistantModeHint);

  if (normalizedQuery) {
    params.set("query", normalizedQuery);
  }

  if (context && typeof context === "object" && !Array.isArray(context)) {
    const currentRoute = normalizeString(context.currentPath);
    const currentPage = normalizeString(context.pageTitle);

    if (currentRoute) {
      params.set("currentRoute", currentRoute);
    }
    if (currentPage) {
      params.set("currentPage", currentPage);
    }
  }

  if (normalizedMode) {
    params.set("mode", normalizedMode);
  }

  return params;
};

const buildStreamingHeaders = () => {
  const headers = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  const token = getSessionAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const safeParseJson = (text = "") => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const parseSseFrame = (chunk = "") => {
  const raw = String(chunk || "").trim();
  if (!raw) {
    return null;
  }

  const lines = raw.split(/\r?\n/);
  const event = normalizeString(
    lines.find((line) => line.startsWith("event:"))?.slice(6)
  );
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  return {
    event: event || "message",
    data: safeParseJson(data) || {},
  };
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

const mapAkusoModeToAssistantMode = (mode = "", category = "", preferredMode = "") => {
  const normalizedMode = normalizeString(mode).toLowerCase();
  const normalizedCategory = normalizeAkusoCategory(category);
  const normalizedPreferredMode = normalizeString(preferredMode).toLowerCase();

  if (normalizedCategory === "EMERGENCY_ESCALATION") {
    return "emergency";
  }
  if (["DISALLOWED", "PROMPT_INJECTION_ATTEMPT"].includes(normalizedCategory)) {
    return "refusal";
  }
  if (normalizedMode === "app_help") {
    return "copilot";
  }
  if (normalizedMode === "creator_writing") {
    return "writing";
  }
  if (normalizedPreferredMode === "math") {
    return "math";
  }
  if (normalizedPreferredMode === "health") {
    return "health";
  }
  return "knowledge";
};

const buildAkusoSafety = (payload = {}) => {
  const category = normalizeAkusoCategory(payload.category);
  const warnings = Array.isArray(payload.warnings) ? payload.warnings.filter(Boolean) : [];
  const firstWarning = normalizeString(warnings[0]);

  if (category === "EMERGENCY_ESCALATION") {
    return {
      level: "emergency",
      notice: firstWarning || normalizeString(payload.answer) || "This request needs urgent real-world help.",
      escalation: "Contact emergency care or a licensed clinician immediately.",
    };
  }

  if (["DISALLOWED", "PROMPT_INJECTION_ATTEMPT"].includes(category)) {
    return {
      level: "refusal",
      notice: firstWarning || normalizeString(payload.answer) || "Akuso refused this request safely.",
      escalation: "",
    };
  }

  if (category === "SAFE_WITH_CAUTION" || category === "SENSITIVE_ACTION_REQUIRES_AUTH" || warnings.length > 0) {
    return {
      level: "caution",
      notice: firstWarning || "Akuso handled this request with caution.",
      escalation: "",
    };
  }

  return {
    level: "safe",
    notice: "",
    escalation: "",
  };
};

const buildAkusoTrust = (payload = {}) => {
  const meta = payload?.meta && typeof payload.meta === "object" && !Array.isArray(payload.meta) ? payload.meta : {};
  const provider = normalizeString(meta.provider, "local-fallback");
  const preferredMode = normalizeString(meta.preferredMode).toLowerCase();
  const mode = mapAkusoModeToAssistantMode(payload.mode, payload.category, preferredMode);
  const usedModel = Boolean(meta.usedModel);

  let trustMode = "general";
  if (mode === "copilot") {
    trustMode = "app-aware";
  } else if (mode === "writing") {
    trustMode = "creator-writing";
  } else if (mode === "health") {
    trustMode = "health-caution";
  } else if (mode === "knowledge" || mode === "math") {
    trustMode = "public-knowledge";
  }

  return {
    provider: provider.replace(/_/g, "-"),
    mode: trustMode,
    grounded: meta.grounded !== false,
    usedModel,
    confidenceLabel: usedModel ? "high" : "medium",
    note:
      provider === "policy_engine"
        ? "Akuso kept this reply inside a server-checked policy boundary."
        : usedModel
          ? "Akuso improved this reply with the guarded model layer and kept server-side safety checks in place."
          : "Akuso answered with a grounded local safety flow.",
  };
};

const buildAkusoSources = (payload = {}) => {
  if (Array.isArray(payload.sources) && payload.sources.length > 0) {
    return payload.sources.map(normalizeSource).filter(Boolean);
  }

  const metaSources = Array.isArray(payload?.meta?.sources) ? payload.meta.sources : [];
  return metaSources
    .map((source, index) => {
      const label = normalizeString(source);
      if (!label) {
        return null;
      }
      return {
        id: `akuso-source-${index + 1}`,
        type: "akuso_source",
        label,
        summary: "",
      };
    })
    .filter(Boolean);
};

const buildAkusoFollowUps = (payload = {}) => {
  const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
  return suggestions
    .map((suggestion) => {
      const prompt = normalizeString(suggestion);
      if (!prompt) {
        return null;
      }
      return {
        label: prompt,
        prompt,
        kind: "prompt",
        route: "",
      };
    })
    .filter(Boolean);
};

const buildAkusoCards = (payload = {}) => {
  if (Array.isArray(payload.cards) && payload.cards.length > 0) {
    return payload.cards.map(normalizeCard).filter(Boolean);
  }

  const drafts = Array.isArray(payload.drafts) ? payload.drafts : [];
  return drafts
    .map((draft, index) => {
      const text = normalizeString(draft);
      if (!text) {
        return null;
      }
      return {
        type: "draft",
        title: `Draft ${index + 1}`,
        subtitle: "Akuso draft",
        description: text,
        route: "",
        payload: {
          text,
        },
      };
    })
    .filter(Boolean);
};

const normalizeAkusoResponse = (payload = {}, { preferredMode = "" } = {}) => ({
  responseId: normalizeString(payload.traceId),
  message:
    normalizeString(payload.answer) ||
    "Akuso can help with Tengacion guidance, creator writing, and safe general knowledge questions.",
  mode: mapAkusoModeToAssistantMode(payload.mode, payload.category, preferredMode),
  safety: buildAkusoSafety(payload),
  trust: buildAkusoTrust({
    ...payload,
    meta: {
      ...(payload?.meta && typeof payload.meta === "object" && !Array.isArray(payload.meta) ? payload.meta : {}),
      preferredMode: normalizeString(preferredMode),
    },
  }),
  sources: buildAkusoSources(payload),
  details: normalizeDetails(payload.details),
  followUps: buildAkusoFollowUps(payload),
  actions: Array.isArray(payload.actions) ? payload.actions.map(normalizeAction).filter(Boolean) : [],
  cards: buildAkusoCards(payload),
  requiresConfirmation: false,
  pendingAction: null,
  conversationId: normalizeString(payload.conversationId),
  confidence: payload?.meta?.usedModel ? 0.86 : 0.72,
  feedbackToken: normalizeString(payload.feedbackToken),
  category: normalizeAkusoCategory(payload.category),
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
  feedbackToken: normalizeString(payload.feedbackToken),
  category: normalizeString(payload.category),
});

export const sendAssistantMessage = async ({
  message,
  conversationId = "",
  context = null,
  assistantModeHint = "",
  preferences = null,
}) => {
  const body = buildAkusoRequestBody({
    message,
    conversationId,
    context,
    assistantModeHint,
    preferences,
    stream: false,
  });

  try {
    const response = await apiRequest(`${API_BASE}/akuso/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      suppressAuthFailure: true,
    });

    return normalizeAkusoResponse(response, { preferredMode: assistantModeHint });
  } catch (error) {
    if (error?.payload && typeof error.payload === "object" && error.payload.answer) {
      return normalizeAkusoResponse(error.payload, { preferredMode: assistantModeHint });
    }
    throw error;
  }
};

export const fetchAssistantHints = async ({
  context = null,
  assistantModeHint = "",
  query = "",
} = {}) => {
  const params = buildAkusoHintsQuery({
    context,
    assistantModeHint,
    query,
  });
  const queryString = params.toString();
  const payload = await apiRequest(
    `${API_BASE}/akuso/hints${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
      suppressAuthFailure: true,
    }
  );

  return {
    mode: mapAkusoModeToAssistantMode(payload?.mode),
    currentRoute: normalizeString(payload?.currentRoute),
    traceId: normalizeString(payload?.traceId),
    hints: Array.isArray(payload?.hints)
      ? payload.hints.map((hint) => normalizeString(hint)).filter(Boolean)
      : [],
  };
};

export const streamAssistantMessage = async ({
  message,
  conversationId = "",
  context = null,
  assistantModeHint = "",
  preferences = null,
  onStatus,
  onStart,
  onDelta,
  onComplete,
}) => {
  if (!supportsAkusoStreaming) {
    const fallback = await sendAssistantMessage({
      message,
      conversationId,
      context,
      assistantModeHint,
      preferences,
    });
    onComplete?.(fallback);
    return fallback;
  }

  const response = await fetch(`${API_BASE}/akuso/chat`, {
    method: "POST",
    credentials: "same-origin",
    headers: buildStreamingHeaders(),
    body: JSON.stringify(
      buildAkusoRequestBody({
        message,
        conversationId,
        context,
        assistantModeHint,
        preferences,
        stream: true,
      })
    ),
  });

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!response.ok) {
    const raw = await response.text();
    const payload = safeParseJson(raw);
    const error = new Error(
      payload?.message || payload?.error || `Request failed (${response.status})`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (!contentType.includes("text/event-stream") || !response.body) {
    const payload = await response.json();
    const normalized = normalizeAkusoResponse(payload, { preferredMode: assistantModeHint });
    onComplete?.(normalized);
    return normalized;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let activeMeta = null;
  let accumulated = "";
  let finalResponse = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let separatorIndex = buffer.indexOf("\n\n");

    while (separatorIndex >= 0) {
      const frame = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      separatorIndex = buffer.indexOf("\n\n");

      const parsedFrame = parseSseFrame(frame);
      if (!parsedFrame) {
        continue;
      }

      const { event, data } = parsedFrame;
      if (event === "status") {
        onStatus?.(data);
        continue;
      }

      if (event === "message_start") {
        activeMeta = {
          responseId: normalizeString(data.responseId),
          conversationId: normalizeString(data.conversationId),
          mode: normalizeString(data.mode),
          category: normalizeString(data.category),
        };
        onStart?.(activeMeta);
        continue;
      }

      if (event === "message_delta") {
        const delta = typeof data.delta === "string" ? data.delta : "";
        accumulated = `${accumulated}${delta}`;
        onDelta?.({
          delta,
          content: accumulated,
          meta: activeMeta || {},
        });
        continue;
      }

      if (event === "complete") {
        finalResponse = normalizeAkusoResponse(data.response || {}, {
          preferredMode: assistantModeHint,
        });
        onComplete?.(finalResponse);
      }
    }
  }

  if (finalResponse) {
    return finalResponse;
  }

  const synthesized = normalizeAkusoResponse(
    {
      traceId: activeMeta?.responseId || "",
      conversationId: activeMeta?.conversationId || "",
      mode: activeMeta?.mode || "",
      category: activeMeta?.category || "",
      answer: accumulated,
      suggestions: [],
      actions: [],
      drafts: [],
      meta: {
        provider: "local_fallback",
        usedModel: false,
        grounded: true,
      },
    },
    { preferredMode: assistantModeHint }
  );
  onComplete?.(synthesized);
  return synthesized;
};

export const sendAssistantFeedback = async ({
  conversationId = "",
  responseId = "",
  feedbackToken = "",
  rating,
  reason = "",
  mode = "",
  category = "",
}) => {
  const body = {
    rating: rating === "not_helpful" ? "not_helpful" : rating === "report" ? "report" : "helpful",
  };

  if (conversationId) {body.conversationId = normalizeString(conversationId);}
  if (responseId) {body.traceId = normalizeString(responseId);}
  if (feedbackToken) {body.feedbackToken = normalizeString(feedbackToken);}
  if (reason) {body.comment = normalizeString(reason, "");}
  if (mode) {body.mode = normalizeAssistantMode(mode);}
  if (category) {body.category = normalizeString(category, "");}

  return apiRequest(`${API_BASE}/akuso/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    suppressAuthFailure: true,
  });
};
