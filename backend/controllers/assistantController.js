const AssistantFeedback = require("../models/AssistantFeedback");
const { assistantFeedbackSchema, assistantRequestSchema } = require("../services/assistant/schemas");
const { chat } = require("../services/assistant/assistantService");
const { logAssistantEvent } = require("../services/assistant/audit");
const { queueAssistantReview } = require("../services/assistant/reviewQueue");

exports.chat = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = assistantRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid assistant request",
      });
    }

    const response = await chat({
      req,
      user: req.user,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
      pendingAction: parsed.data.pendingAction,
      context: parsed.data.context,
      assistantModeHint: parsed.data.assistantModeHint,
      preferences: parsed.data.preferences,
    });

    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

exports.feedback = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = assistantFeedbackSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid assistant feedback" });
    }

    const doc = await AssistantFeedback.create({
      userId: req.user.id,
      conversationId: parsed.data.conversationId,
      messageId: parsed.data.messageId,
      responseId: parsed.data.responseId,
      rating: parsed.data.rating,
      reason: parsed.data.reason,
      mode: parsed.data.mode,
      surface: parsed.data.surface,
      responseMode: parsed.data.responseMode,
      responseSummary: parsed.data.responseSummary,
      metadata: parsed.data.metadata,
    });

    await logAssistantEvent({
      req,
      userId: req.user.id,
      action: "feedback",
      category: parsed.data.rating === "helpful" ? "feedback" : "feedback_negative",
      severity: parsed.data.rating === "helpful" ? "info" : "warn",
      conversationId: parsed.data.conversationId,
      metadata: {
        messageId: parsed.data.messageId,
        responseId: parsed.data.responseId,
        rating: parsed.data.rating,
        mode: parsed.data.mode,
        surface: parsed.data.surface,
        responseMode: parsed.data.responseMode,
      },
    }).catch(() => null);

    if (parsed.data.rating === "not_helpful") {
      await queueAssistantReview({
        userId: req.user.id,
        feedbackId: doc._id,
        conversationId: parsed.data.conversationId,
        messageId: parsed.data.messageId,
        responseId: parsed.data.responseId,
        category: parsed.data.metadata?.safetyLevel && parsed.data.metadata.safetyLevel !== "safe" ? "safety" : "feedback",
        reason: parsed.data.reason || "User marked this assistant reply as not helpful.",
        mode: parsed.data.mode,
        surface: parsed.data.surface,
        responseMode: parsed.data.responseMode,
        safetyLevel: parsed.data.metadata?.safetyLevel || "safe",
        requestSummary: parsed.data.metadata?.requestSummary || "",
        responseSummary: parsed.data.responseSummary,
        trust: parsed.data.metadata?.trust || {},
        metadata: parsed.data.metadata || {},
      }).catch(() => null);
    }

    return res.status(201).json({
      ok: true,
      feedbackId: doc._id,
    });
  } catch (error) {
    return next(error);
  }
};
