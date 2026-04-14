const crypto = require("crypto");

const AssistantMemory = require("../models/AssistantMemory");
const { sanitizePlainText } = require("./assistant/outputSanitizer");

const transientMemory = new Map();
const ANSWER_LENGTHS = new Set(["short", "medium", "detailed"]);

const normalizeConversationId = (conversationId = "", sessionKey = "") => {
  const raw = String(conversationId || sessionKey || "").trim().slice(0, 80);
  return raw ? `akuso:${raw}` : `akuso:${crypto.randomUUID()}`;
};

const sanitizeAkusoPreferences = (value = {}) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const answerLength = String(source.answerLength || source.length || "").trim().toLowerCase();

  return {
    answerLength: ANSWER_LENGTHS.has(answerLength) ? answerLength : "medium",
    tone: sanitizePlainText(source.tone || "", 40),
    preferredMode: sanitizePlainText(source.preferredMode || source.mode || "", 40),
    creatorStyle: sanitizePlainText(source.creatorStyle || "", 80),
    audience: sanitizePlainText(source.audience || "", 40),
    language: sanitizePlainText(source.language || "", 40),
  };
};

const sanitizeAkusoState = (value = {}) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    recentSummary: sanitizePlainText(source.recentSummary || source.summary || "", 800),
    lastTopic: sanitizePlainText(source.lastTopic || "", 160),
    lastMode: sanitizePlainText(source.lastMode || "", 40),
    lastSurface: sanitizePlainText(source.lastSurface || "", 60),
    lastRoute: sanitizePlainText(source.lastRoute || "", 160),
    lastFeatureKey: sanitizePlainText(source.lastFeatureKey || source.lastFeatureId || "", 80),
    preferredAnswerLength: sanitizePlainText(
      source.preferredAnswerLength || source.answerLength || "",
      20
    ),
    preferredTone: sanitizePlainText(source.preferredTone || source.tone || "", 40),
    preferredMode: sanitizePlainText(source.preferredMode || source.mode || "", 40),
    creatorStyle: sanitizePlainText(source.creatorStyle || "", 80),
  };
};

const loadAkusoMemory = async ({ userId = "", conversationId = "", sessionKey = "" } = {}) => {
  const memoryKey = normalizeConversationId(conversationId, sessionKey);
  const transient = transientMemory.get(memoryKey);

  if (!userId) {
    return {
      conversationId: memoryKey.replace(/^akuso:/, ""),
      ...sanitizeAkusoState(transient || {}),
    };
  }

  const doc = await AssistantMemory.findOne({
    userId,
    kind: "conversation",
    conversationId: memoryKey,
  }).lean();

  return {
    conversationId: memoryKey.replace(/^akuso:/, ""),
    recentSummary: sanitizePlainText(doc?.summary || "", 800),
    lastTopic: sanitizePlainText(doc?.lastTopic || "", 160),
    lastMode: sanitizePlainText(doc?.lastMode || "", 40),
    lastSurface: sanitizePlainText(doc?.lastSurface || "", 60),
    lastRoute: sanitizePlainText(doc?.lastRoute || "", 160),
    lastFeatureKey: sanitizePlainText(doc?.lastFeatureId || "", 80),
    preferredAnswerLength: sanitizePlainText(doc?.metadata?.akusoAnswerLength || "", 20),
    preferredTone: sanitizePlainText(doc?.metadata?.akusoTone || "", 40),
    preferredMode: sanitizePlainText(doc?.metadata?.akusoPreferredMode || "", 40),
    creatorStyle: sanitizePlainText(doc?.metadata?.akusoCreatorStyle || "", 80),
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
} = {}) => {
  const memoryKey = normalizeConversationId(conversationId, sessionKey);
  const safeState = sanitizeAkusoState(state);
  const safePreferences = sanitizeAkusoPreferences(preferences);

  if (!userId) {
    transientMemory.set(memoryKey, {
      ...safeState,
      updatedAt: Date.now(),
    });
    return {
      conversationId: memoryKey.replace(/^akuso:/, ""),
      ...safeState,
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
        },
      },
      $setOnInsert: {
        userId,
        kind: "conversation",
        conversationId: memoryKey,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
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
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = {
  loadAkusoMemory,
  loadAkusoPreferences,
  normalizeConversationId,
  sanitizeAkusoPreferences,
  saveAkusoMemory,
  saveAkusoPreferences,
};
