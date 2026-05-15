const crypto = require("crypto");

const AssistantMemory = require("../models/AssistantMemory");
const { sanitizePlainText, sanitizeRoute } = require("./assistant/outputSanitizer");

const transientMemory = new Map();
const ANSWER_LENGTHS = new Set(["short", "medium", "detailed"]);
const ADMIN_ROLES = new Set(["admin", "super_admin", "moderator", "trust_safety_admin"]);
const ROLE_SCOPE_RANK = {
  guest: 0,
  authenticated: 1,
  creator: 2,
  admin: 3,
};
const MEMORY_VERSION = "low_risk_v1";

const SENSITIVE_VALUE_PATTERNS = [
  /\b(?:sk|pk)-[A-Za-z0-9_-]{8,}\b/g,
  /\b(?:\d[ -]?){9,19}\b/g,
  /\b((?:password|passcode|otp|one[-\s]?time code|verification code|api key|secret|token|jwt|session token|refresh token|card number|cvv|pin|bvn|nin|bank account|account number)\s*(?:is|=|:)?\s*)[^\s,.;!?]{2,}/gi,
];

const normalizeConversationId = (conversationId = "", sessionKey = "") => {
  const raw = String(conversationId || sessionKey || "").trim().slice(0, 80);
  return raw ? `akuso:${raw}` : `akuso:${crypto.randomUUID()}`;
};

const resolveAkusoMemoryRoleScope = (user = {}, fallback = "authenticated") => {
  const role = String(user?.role || "").trim().toLowerCase();
  if (user?.isAdmin || ADMIN_ROLES.has(role)) {
    return "admin";
  }
  if (user?.isCreator) {
    return "creator";
  }
  if (user?.id || user?.userId || user?._id) {
    return "authenticated";
  }
  return ROLE_SCOPE_RANK[fallback] !== undefined ? fallback : "guest";
};

const canReadAkusoMemoryScope = (storedScope = "authenticated", currentScope = "authenticated") => {
  const storedRank = ROLE_SCOPE_RANK[storedScope] ?? ROLE_SCOPE_RANK.authenticated;
  const currentRank = ROLE_SCOPE_RANK[currentScope] ?? ROLE_SCOPE_RANK.authenticated;
  return currentRank >= storedRank;
};

const redactLowRiskMemoryText = (value = "", maxLength = 800) => {
  let text = sanitizePlainText(value, maxLength);
  if (!text) {
    return "";
  }

  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    text = text.replace(pattern, (match, prefix = "") =>
      prefix ? `${prefix}[redacted]` : "[redacted]"
    );
  }

  return sanitizePlainText(text, maxLength);
};

const sanitizeAkusoPreferences = (value = {}) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const answerLength = String(source.answerLength || source.length || "").trim().toLowerCase();

  return {
    answerLength: ANSWER_LENGTHS.has(answerLength) ? answerLength : "medium",
    tone: redactLowRiskMemoryText(source.tone || "", 40),
    preferredMode: redactLowRiskMemoryText(source.preferredMode || source.mode || "", 40),
    creatorStyle: redactLowRiskMemoryText(source.creatorStyle || "", 80),
    audience: redactLowRiskMemoryText(source.audience || "", 40),
    language: redactLowRiskMemoryText(source.language || "", 40),
  };
};

const sanitizeAkusoState = (value = {}) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    recentSummary: redactLowRiskMemoryText(source.recentSummary || source.summary || "", 800),
    lastTopic: redactLowRiskMemoryText(source.lastTopic || "", 160),
    lastMode: redactLowRiskMemoryText(source.lastMode || "", 40),
    lastSurface: redactLowRiskMemoryText(source.lastSurface || "", 60),
    lastRoute: sanitizeRoute(source.lastRoute || ""),
    lastFeatureKey: redactLowRiskMemoryText(source.lastFeatureKey || source.lastFeatureId || "", 80),
    preferredAnswerLength: redactLowRiskMemoryText(
      source.preferredAnswerLength || source.answerLength || "",
      20
    ),
    preferredTone: redactLowRiskMemoryText(source.preferredTone || source.tone || "", 40),
    preferredMode: redactLowRiskMemoryText(source.preferredMode || source.mode || "", 40),
    creatorStyle: redactLowRiskMemoryText(source.creatorStyle || "", 80),
  };
};

const emptyAkusoMemoryState = ({ memoryKey = "", roleScope = "authenticated", memorySuppressed = false } = {}) => ({
  conversationId: memoryKey.replace(/^akuso:/, ""),
  ...sanitizeAkusoState({}),
  roleScope,
  memoryVersion: MEMORY_VERSION,
  memorySuppressed,
});

const loadAkusoMemory = async ({ userId = "", conversationId = "", sessionKey = "", user = {} } = {}) => {
  const memoryKey = normalizeConversationId(conversationId, sessionKey);
  const transient = transientMemory.get(memoryKey);
  const currentScope = resolveAkusoMemoryRoleScope(user, userId ? "authenticated" : "guest");

  if (!userId) {
    return {
      conversationId: memoryKey.replace(/^akuso:/, ""),
      ...sanitizeAkusoState(transient || {}),
      roleScope: currentScope,
      memoryVersion: MEMORY_VERSION,
      memorySuppressed: false,
    };
  }

  const doc = await AssistantMemory.findOne({
    userId,
    kind: "conversation",
    conversationId: memoryKey,
  }).lean();
  const storedScope = sanitizePlainText(doc?.metadata?.akusoRoleScope || "authenticated", 40) || "authenticated";

  if (doc && !canReadAkusoMemoryScope(storedScope, currentScope)) {
    return emptyAkusoMemoryState({
      memoryKey,
      roleScope: currentScope,
      memorySuppressed: true,
    });
  }

  return {
    conversationId: memoryKey.replace(/^akuso:/, ""),
    recentSummary: redactLowRiskMemoryText(doc?.summary || "", 800),
    lastTopic: redactLowRiskMemoryText(doc?.lastTopic || "", 160),
    lastMode: redactLowRiskMemoryText(doc?.lastMode || "", 40),
    lastSurface: redactLowRiskMemoryText(doc?.lastSurface || "", 60),
    lastRoute: sanitizeRoute(doc?.lastRoute || ""),
    lastFeatureKey: redactLowRiskMemoryText(doc?.lastFeatureId || "", 80),
    preferredAnswerLength: redactLowRiskMemoryText(doc?.metadata?.akusoAnswerLength || "", 20),
    preferredTone: redactLowRiskMemoryText(doc?.metadata?.akusoTone || "", 40),
    preferredMode: redactLowRiskMemoryText(doc?.metadata?.akusoPreferredMode || "", 40),
    creatorStyle: redactLowRiskMemoryText(doc?.metadata?.akusoCreatorStyle || "", 80),
    roleScope: storedScope,
    memoryVersion: sanitizePlainText(doc?.metadata?.akusoMemoryVersion || MEMORY_VERSION, 40),
    memorySuppressed: false,
  };
};

const loadAkusoPreferences = async ({ userId = "" } = {}) => {
  if (!userId) {
    return sanitizeAkusoPreferences({});
  }

  const doc = await AssistantMemory.findOne({
    userId,
    kind: "preferences",
    conversationId: "",
  }).lean();

  return sanitizeAkusoPreferences(doc?.preferences || {});
};

const saveAkusoMemory = async ({
  userId = "",
  conversationId = "",
  sessionKey = "",
  state = {},
  preferences = {},
  user = {},
} = {}) => {
  const memoryKey = normalizeConversationId(conversationId, sessionKey);
  const safeState = sanitizeAkusoState(state);
  const safePreferences = sanitizeAkusoPreferences(preferences);
  const roleScope = resolveAkusoMemoryRoleScope(user, userId ? "authenticated" : "guest");

  if (!userId) {
    transientMemory.set(memoryKey, {
      ...safeState,
      roleScope,
      memoryVersion: MEMORY_VERSION,
      updatedAt: Date.now(),
    });
    return {
      conversationId: memoryKey.replace(/^akuso:/, ""),
      ...safeState,
      roleScope,
      memoryVersion: MEMORY_VERSION,
    };
  }

  return AssistantMemory.findOneAndUpdate(
    {
      userId,
      kind: "conversation",
      conversationId: memoryKey,
    },
    {
      $set: {
        summary: safeState.recentSummary,
        lastTopic: safeState.lastTopic,
        lastMode: safeState.lastMode,
        lastSurface: safeState.lastSurface,
        lastRoute: safeState.lastRoute,
        lastFeatureId: safeState.lastFeatureKey,
        preferences: safePreferences,
        metadata: {
          akusoAnswerLength: safeState.preferredAnswerLength || safePreferences.answerLength,
          akusoTone: safeState.preferredTone || safePreferences.tone,
          akusoPreferredMode: safeState.preferredMode || safePreferences.preferredMode,
          akusoCreatorStyle: safeState.creatorStyle || safePreferences.creatorStyle,
          akusoRoleScope: roleScope,
          akusoMemoryVersion: MEMORY_VERSION,
        },
      },
      $setOnInsert: {
        userId,
        kind: "conversation",
        conversationId: memoryKey,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
};

const saveAkusoPreferences = async ({ userId = "", preferences = {} } = {}) => {
  if (!userId) {
    return null;
  }

  const safePreferences = sanitizeAkusoPreferences(preferences);

  return AssistantMemory.findOneAndUpdate(
    {
      userId,
      kind: "preferences",
      conversationId: "",
    },
    {
      $set: {
        preferences: safePreferences,
        metadata: {
          source: "akuso",
        },
      },
      $setOnInsert: {
        userId,
        kind: "preferences",
        conversationId: "",
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
};

module.exports = {
  canReadAkusoMemoryScope,
  loadAkusoMemory,
  loadAkusoPreferences,
  normalizeConversationId,
  redactLowRiskMemoryText,
  resolveAkusoMemoryRoleScope,
  sanitizeAkusoPreferences,
  sanitizeAkusoState,
  saveAkusoMemory,
  saveAkusoPreferences,
};
