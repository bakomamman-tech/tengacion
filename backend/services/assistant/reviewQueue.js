const mongoose = require("mongoose");

const AssistantReviewItem = require("../../models/AssistantReviewItem");
const { sanitizePlainText, sanitizeAssistantTrust } = require("./outputSanitizer");

const REVIEW_STATUSES = new Set(["open", "under_review", "resolved", "dismissed"]);
const REVIEW_SEVERITIES = new Set(["low", "medium", "high"]);
const REVIEW_CATEGORIES = new Set(["quality", "safety", "feedback", "abuse"]);

const clamp = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const normalizeStatus = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return REVIEW_STATUSES.has(normalized) ? normalized : "open";
};

const normalizeSeverity = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return REVIEW_SEVERITIES.has(normalized) ? normalized : "medium";
};

const normalizeCategory = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return REVIEW_CATEGORIES.has(normalized) ? normalized : "feedback";
};

const deriveSeverity = ({ safetyLevel = "", reason = "", trust = {} } = {}) => {
  const normalizedSafety = String(safetyLevel || "").trim().toLowerCase();
  const normalizedReason = String(reason || "").trim().toLowerCase();
  if (normalizedSafety === "emergency" || normalizedSafety === "refusal") return "high";
  if (normalizedReason.includes("unsafe") || normalizedReason.includes("harm")) return "high";
  if (trust?.grounded === false || trust?.confidenceLabel === "low") return "medium";
  return "low";
};

const queueAssistantReview = async ({
  userId,
  feedbackId = null,
  conversationId = "",
  messageId = "",
  responseId = "",
  category = "feedback",
  severity = "",
  reason = "",
  mode = "",
  surface = "",
  responseMode = "",
  safetyLevel = "safe",
  requestSummary = "",
  responseSummary = "",
  trust = {},
  metadata = {},
} = {}) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("A valid userId is required to queue an assistant review item");
  }

  return AssistantReviewItem.create({
    userId,
    feedbackId: feedbackId && mongoose.Types.ObjectId.isValid(feedbackId) ? feedbackId : null,
    conversationId: sanitizePlainText(conversationId, 80),
    messageId: sanitizePlainText(messageId, 80),
    responseId: sanitizePlainText(responseId, 80),
    category: normalizeCategory(category),
    severity: String(severity || "").trim()
      ? normalizeSeverity(severity)
      : deriveSeverity({ safetyLevel, reason, trust }),
    status: "open",
    reason: sanitizePlainText(reason, 500),
    mode: sanitizePlainText(mode, 40),
    surface: sanitizePlainText(surface, 60),
    responseMode: sanitizePlainText(responseMode, 40),
    safetyLevel: sanitizePlainText(safetyLevel, 24) || "safe",
    requestSummary: sanitizePlainText(requestSummary, 800),
    responseSummary: sanitizePlainText(responseSummary, 1200),
    trust: sanitizeAssistantTrust(trust),
    metadata,
  });
};

const listAssistantReviews = async ({ status = "", category = "", page = 1, limit = 20 } = {}) => {
  const safePage = clamp(page, 1, 200, 1);
  const safeLimit = clamp(limit, 1, 100, 20);
  const filter = {};
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedCategory = String(category || "").trim().toLowerCase();

  if (REVIEW_STATUSES.has(normalizedStatus)) {
    filter.status = normalizedStatus;
  }

  if (REVIEW_CATEGORIES.has(normalizedCategory)) {
    filter.category = normalizedCategory;
  }

  const [items, total] = await Promise.all([
    AssistantReviewItem.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    AssistantReviewItem.countDocuments(filter),
  ]);

  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
    hasMore: safePage * safeLimit < total,
  };
};

const updateAssistantReview = async ({ reviewId, reviewerId, status = "", resolutionNote = "" } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new Error("Invalid review id");
  }

  const nextStatus = normalizeStatus(status);
  const update = {
    status: nextStatus,
    resolutionNote: sanitizePlainText(resolutionNote, 500),
  };

  if (nextStatus === "resolved" || nextStatus === "dismissed") {
    update.resolvedAt = new Date();
  } else {
    update.resolvedAt = null;
  }

  if (reviewerId && mongoose.Types.ObjectId.isValid(reviewerId)) {
    update.reviewerId = reviewerId;
  }

  const item = await AssistantReviewItem.findByIdAndUpdate(reviewId, { $set: update }, { new: true }).lean();
  if (!item) {
    throw new Error("Assistant review item not found");
  }
  return item;
};

module.exports = {
  deriveSeverity,
  listAssistantReviews,
  queueAssistantReview,
  updateAssistantReview,
};
