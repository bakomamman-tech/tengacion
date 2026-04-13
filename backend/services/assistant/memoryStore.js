const AssistantMemory = require("../../models/AssistantMemory");
const { sanitizeAssistantPreferences, sanitizePlainText } = require("./outputSanitizer");

const normalizeKey = (value = "") => String(value || "").trim().slice(0, 80);

const buildConversationMemoryKey = ({ userId, conversationId }) => ({
  userId,
  kind: "conversation",
  conversationId: normalizeKey(conversationId),
});

const buildPreferenceMemoryKey = ({ userId }) => ({
  userId,
  kind: "preferences",
  conversationId: "",
});

const sanitizeMemorySummary = (value = "") => sanitizePlainText(value, 800);

const loadConversationMemory = async ({ userId, conversationId = "" } = {}) => {
  if (!userId) {
    return null;
  }

  return AssistantMemory.findOne(buildConversationMemoryKey({ userId, conversationId })).lean();
};

const loadUserPreferences = async ({ userId } = {}) => {
  if (!userId) {
    return {};
  }

  const doc = await AssistantMemory.findOne(buildPreferenceMemoryKey({ userId })).lean();
  return sanitizeAssistantPreferences(doc?.preferences || {});
};

const saveConversationMemory = async ({
  userId,
  conversationId = "",
  summary = "",
  lastTopic = "",
  lastMode = "",
  lastSurface = "",
  lastRoute = "",
  lastFeatureId = "",
  preferences = {},
  metadata = {},
} = {}) => {
  if (!userId || !conversationId) {
    return null;
  }

  return AssistantMemory.findOneAndUpdate(
    buildConversationMemoryKey({ userId, conversationId }),
    {
      $set: {
        summary: sanitizeMemorySummary(summary),
        lastTopic: sanitizePlainText(lastTopic, 160),
        lastMode: sanitizePlainText(lastMode, 40),
        lastSurface: sanitizePlainText(lastSurface, 60),
        lastRoute: sanitizePlainText(lastRoute, 160),
        lastFeatureId: sanitizePlainText(lastFeatureId, 80),
        preferences: sanitizeAssistantPreferences(preferences),
        metadata: metadata && typeof metadata === "object" ? metadata : {},
      },
      $setOnInsert: {
        userId,
        kind: "conversation",
        conversationId: normalizeKey(conversationId),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const saveUserPreferences = async ({ userId, preferences = {}, metadata = {} } = {}) => {
  if (!userId) {
    return null;
  }

  return AssistantMemory.findOneAndUpdate(
    buildPreferenceMemoryKey({ userId }),
    {
      $set: {
        preferences: sanitizeAssistantPreferences(preferences),
        metadata: metadata && typeof metadata === "object" ? metadata : {},
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
  loadConversationMemory,
  loadUserPreferences,
  saveConversationMemory,
  saveUserPreferences,
};
