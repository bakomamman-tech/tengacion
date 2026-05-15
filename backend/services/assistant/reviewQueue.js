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

const buildReviewTriage = (item = {}) => {
  const category = normalizeCategory(item.category);
  const severity = normalizeSeverity(item.severity);
  const status = normalizeStatus(item.status);
  const surface = sanitizePlainText(item.surface || "general", 60) || "general";
  const mode = sanitizePlainText(item.mode || item.responseMode || "general", 40) || "general";
  const trust = item.trust && typeof item.trust === "object" ? item.trust : {};
  const safetyLevel = String(item.safetyLevel || "safe").trim().toLowerCase();
  const isResolved = status === "resolved" || status === "dismissed";
  const grounded = trust.grounded !== false;
  const confidenceLabel = String(trust.confidenceLabel || "").trim().toLowerCase();
  const usedModel = Boolean(trust.usedModel);

  let actionType = "assistant_fix";
  let owner = "AI and assistant";
  let title = "Review the assistant answer and decide whether an eval is needed";
  let nextStep = "Compare the request, response, trust signals, and user feedback before changing prompts or docs.";

  if (category === "safety" || safetyLevel === "refusal" || safetyLevel === "emergency") {
    actionType = "safety_review";
    owner = "AI and assistant";
    title = "Review safety and refusal quality";
    nextStep = "Check whether Akuso denied correctly, gave useful next steps, and needs a policy or eval fixture.";
  } else if (category === "abuse") {
    actionType = "abuse_review";
    owner = "Trust and safety";
    title = "Review abuse and rate-limit signals";
    nextStep = "Inspect whether the request should affect abuse guard thresholds, rate limits, or moderation guidance.";
  } else if (category === "quality" || !grounded || confidenceLabel === "low") {
    actionType = "eval_candidate";
    owner = "AI and assistant";
    title = `Create or update a ${surface} eval fixture`;
    nextStep = "Turn the failure into a labeled eval case before broad prompt or model changes.";
  } else if (!usedModel && mode === "app_help") {
    actionType = "grounding_review";
    owner = "AI and assistant";
    title = "Check app grounding coverage";
    nextStep = "Confirm the feature registry and help docs cover the route, action, and safe fallback copy.";
  }

  return {
    status,
    category,
    severity,
    actionType,
    owner,
    title,
    nextStep,
    priority: severity === "high" ? "high" : severity === "medium" ? "medium" : "low",
    evalCandidate: ["quality", "safety"].includes(category) || !grounded || confidenceLabel === "low",
    routeScope: surface,
    closed: isResolved,
  };
};

const buildQueueSummary = async ({ filter = {} } = {}) => {
  const unresolvedFilter = {
    ...filter,
    status: { $in: ["open", "under_review"] },
  };

  const [statusRows, categoryRows, severityRows, oldestOpen, newestHigh] = await Promise.all([
    AssistantReviewItem.aggregate([
      { $match: unresolvedFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).catch(() => []),
    AssistantReviewItem.aggregate([
      { $match: unresolvedFilter },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]).catch(() => []),
    AssistantReviewItem.aggregate([
      { $match: unresolvedFilter },
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]).catch(() => []),
    AssistantReviewItem.findOne(unresolvedFilter).sort({ createdAt: 1 }).lean(),
    AssistantReviewItem.findOne({ ...unresolvedFilter, severity: "high" }).sort({ createdAt: 1 }).lean(),
  ]);

  const countRows = (rows = []) =>
    rows.reduce((acc, row) => {
      const key = String(row?._id || "").trim();
      if (key) {
        acc[key] = Number(row?.count || 0);
      }
      return acc;
    }, {});
  const byStatus = countRows(statusRows);
  const byCategory = countRows(categoryRows);
  const bySeverity = countRows(severityRows);
  const unresolved = Number(byStatus.open || 0) + Number(byStatus.under_review || 0);
  const high = Number(bySeverity.high || 0);
  const quality = Number(byCategory.quality || 0);
  const safety = Number(byCategory.safety || 0);
  const nextReview = newestHigh || oldestOpen || null;

  return {
    unresolved,
    byStatus,
    byCategory,
    bySeverity,
    nextReviewId: nextReview?._id ? String(nextReview._id) : "",
    recommendation:
      high > 0
        ? "Start with the oldest high-severity Akuso review before shipping new assistant behavior."
        : safety > 0
          ? "Review safety-labeled feedback before broad prompt changes."
          : quality > 0
            ? "Convert quality failures into eval fixtures before tuning prompts."
            : unresolved > 0
              ? "Work the oldest open review and capture the decision note."
              : "No unresolved Akuso review backlog is currently blocking expansion.",
  };
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

  const [items, total, triageSummary] = await Promise.all([
    AssistantReviewItem.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    AssistantReviewItem.countDocuments(filter),
    buildQueueSummary({ filter: normalizedCategory && REVIEW_CATEGORIES.has(normalizedCategory) ? { category: normalizedCategory } : {} }),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      triage: buildReviewTriage(item),
    })),
    page: safePage,
    limit: safeLimit,
    total,
    hasMore: safePage * safeLimit < total,
    triageSummary,
  };
};

const updateAssistantReview = async ({
  reviewId,
  reviewerId,
  status = "",
  category = "",
  severity = "",
  resolutionNote = "",
} = {}) => {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new Error("Invalid review id");
  }

  const nextStatus = normalizeStatus(status);
  const update = {
    status: nextStatus,
    resolutionNote: sanitizePlainText(resolutionNote, 500),
  };

  if (String(category || "").trim()) {
    update.category = normalizeCategory(category);
  }

  if (String(severity || "").trim()) {
    update.severity = normalizeSeverity(severity);
  }

  if (nextStatus === "resolved" || nextStatus === "dismissed") {
    update.resolvedAt = new Date();
  } else {
    update.resolvedAt = null;
  }

  if (reviewerId && mongoose.Types.ObjectId.isValid(reviewerId)) {
    update.reviewerId = reviewerId;
  }

  const item = await AssistantReviewItem.findByIdAndUpdate(reviewId, { $set: update }, { returnDocument: "after" }).lean();
  if (!item) {
    throw new Error("Assistant review item not found");
  }
  return {
    ...item,
    triage: buildReviewTriage(item),
  };
};

module.exports = {
  buildReviewTriage,
  buildQueueSummary,
  deriveSeverity,
  listAssistantReviews,
  queueAssistantReview,
  updateAssistantReview,
};
