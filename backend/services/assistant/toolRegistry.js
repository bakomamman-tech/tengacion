const { assistantResponseSchema } = require("./schemas");
const { executeTool, toolByName, toolDefinitions } = require("./tools");

const normalizeAssistantResult = (result, conversationId = "") =>
  assistantResponseSchema.parse({
    message: String(result?.message || "").trim() || "I can help with safe navigation, discovery, uploads, purchases, notifications, and captions.",
    actions: Array.isArray(result?.actions) ? result.actions : [],
    cards: Array.isArray(result?.cards) ? result.cards : [],
    requiresConfirmation: Boolean(result?.requiresConfirmation),
    pendingAction: result?.pendingAction ?? null,
    conversationId: String(result?.conversationId || conversationId || "").trim(),
  });

module.exports = {
  executeTool,
  normalizeAssistantResult,
  toolByName,
  toolDefinitions,
};
