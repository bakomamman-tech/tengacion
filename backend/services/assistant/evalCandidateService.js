const AssistantReviewItem = require("../../models/AssistantReviewItem");
const { buildReviewTriage } = require("./reviewQueue");
const { sanitizePlainText } = require("./outputSanitizer");

const CANDIDATE_STATUSES = new Set(["open", "under_review", "resolved", "dismissed"]);
const CANDIDATE_CATEGORIES = new Set(["quality", "safety", "feedback", "abuse"]);
const DEFAULT_CANDIDATE_STATUSES = ["open", "under_review"];

const clamp = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const slug = (value = "", fallback = "candidate") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
};

const safeText = (value = "", max = 240) => sanitizePlainText(value, max);

const normalizeEvalMode = (item = {}) => {
  const mode = String(item.mode || item.responseMode || "").trim().toLowerCase();
  const surface = String(item.surface || "").trim().toLowerCase();
  if (mode.includes("writing") || surface.includes("writing")) return "creator_writing";
  if (mode.includes("app") || mode.includes("copilot") || surface.includes("creator")) return "app_help";
  if (mode.includes("math")) return "knowledge_learning";
  if (mode.includes("health")) return "knowledge_learning";
  return mode || "app_help";
};

const inferQualityBucket = (item = {}) => {
  const haystack = [
    item.category,
    item.reason,
    item.mode,
    item.surface,
    item.responseMode,
    item.requestSummary,
    item.responseSummary,
    item.safetyLevel,
    item.trust?.confidenceLabel,
    item.trust?.note,
  ]
    .join(" ")
    .toLowerCase();
  const safetyLevel = String(item.safetyLevel || "").trim().toLowerCase();
  const grounded = item.trust?.grounded !== false;

  if (item.category === "abuse" || haystack.includes("unsafe") || haystack.includes("offensive")) {
    return "unsafe_answer_should_block";
  }
  if (item.category === "safety" || ["refusal", "emergency", "reported"].includes(safetyLevel)) {
    return "refusal_quality";
  }
  if (!grounded || /hallucinat|made up|fake|nonexistent|invented/.test(haystack)) {
    return "hallucinated_feature_claim";
  }
  if (/wrong page|wrong route|navigation|navigate|open|dashboard|upload flow|where do i/.test(haystack)) {
    return "wrong_navigation_guidance";
  }
  if (/caption|bio|blurb|write|rewrite|tone|draft|copy|post/.test(haystack)) {
    return "low_quality_creator_writing";
  }
  if (/fallback|did not answer|unanswered|incomplete|unclear|not helpful/.test(haystack)) {
    return "unanswered_feature_gap";
  }
  return "negative_feedback";
};

const inferSuite = ({ item, bucket }) => {
  if (bucket === "unsafe_answer_should_block" || bucket === "refusal_quality") {
    return "feedback_safety";
  }
  if (bucket === "low_quality_creator_writing") {
    return "feedback_creator_writing";
  }
  if (
    bucket === "wrong_navigation_guidance" ||
    bucket === "hallucinated_feature_claim" ||
    String(item.mode || "").includes("app") ||
    String(item.surface || "").includes("creator")
  ) {
    return "feedback_app_guidance";
  }
  return "feedback_quality";
};

const buildTags = ({ item, bucket, suite }) => {
  const tags = new Set([
    "feedback_derived",
    "eval_candidate",
    bucket,
    suite,
    String(item.category || "feedback"),
  ]);
  const surface = slug(item.surface || "general", "");
  const mode = slug(item.mode || item.responseMode || "general", "");
  if (surface) tags.add(`surface_${surface}`);
  if (mode) tags.add(`mode_${mode}`);
  if (item.trust?.grounded === false) tags.add("grounding_gap");
  if (item.trust?.usedModel === false) tags.add("local_fallback");
  if (String(item.safetyLevel || "").trim().toLowerCase() !== "safe") tags.add("policy_denial_quality");
  return Array.from(tags).filter(Boolean).slice(0, 12);
};

const buildCandidatePrompt = (item = {}) =>
  safeText(
    item.requestSummary ||
      item.reason ||
      item.responseSummary ||
      "Review this Akuso assistant answer and capture the expected behavior.",
    1000
  );

const buildExpectedBehavior = ({ item, bucket }) => {
  const routeScope = safeText(item.surface || item.metadata?.surface || "general", 80) || "general";
  const expected = {
    needsHumanLabel: true,
    qualityBucket: bucket,
    routeScope,
    shouldStayGrounded: true,
    shouldAvoidInventedFeatures: true,
  };

  if (bucket === "wrong_navigation_guidance") {
    expected.shouldUseCorrectRoute = true;
    expected.shouldNameConcreteNextStep = true;
  }
  if (bucket === "hallucinated_feature_claim") {
    expected.shouldUseFeatureRegistry = true;
    expected.shouldFallbackWhenUnsupported = true;
  }
  if (bucket === "low_quality_creator_writing") {
    expected.shouldImproveCreatorDraftQuality = true;
    expected.shouldRespectToneAudienceAndLength = true;
  }
  if (bucket === "refusal_quality") {
    expected.shouldPreservePolicyBoundary = true;
    expected.shouldGiveUsefulAllowedNextStep = true;
  }
  if (bucket === "unsafe_answer_should_block") {
    expected.shouldBlockUnsafeContent = true;
    expected.shouldEscalateOrRefuseSafely = true;
  }
  if (bucket === "unanswered_feature_gap") {
    expected.shouldAnswerOrExplainLimitation = true;
    expected.shouldSuggestRecoverableNextStep = true;
  }

  return expected;
};

const buildEvalCandidate = (item = {}) => {
  const triage = item.triage || buildReviewTriage(item);
  const bucket = inferQualityBucket(item);
  const suite = inferSuite({ item, bucket });
  const prompt = buildCandidatePrompt(item);
  const title = safeText(prompt, 96) || "Akuso feedback-derived eval candidate";

  return {
    reviewId: String(item._id || ""),
    feedbackId: item.feedbackId ? String(item.feedbackId) : "",
    status: item.status || "open",
    category: item.category || "feedback",
    severity: item.severity || "medium",
    qualityBucket: bucket,
    triage,
    source: {
      conversationId: safeText(item.conversationId || "", 80),
      messageId: safeText(item.messageId || "", 80),
      responseId: safeText(item.responseId || "", 80),
      surface: safeText(item.surface || "", 60),
      mode: safeText(item.mode || "", 40),
      createdAt: item.createdAt || null,
    },
    fixtureDraft: {
      id: `feedback.${suite}.${slug(item.surface || item.mode || "general")}.${String(item._id || "").slice(-8)}`,
      name: title,
      suite,
      severity: item.severity === "high" && bucket === "unsafe_answer_should_block" ? "critical" : item.severity || "medium",
      tags: buildTags({ item, bucket, suite }),
      input: {
        message: prompt,
        mode: normalizeEvalMode(item),
        currentRoute: safeText(item.metadata?.currentRoute || item.metadata?.route || "", 160),
        currentPage: safeText(item.metadata?.currentPage || item.surface || "", 120),
      },
      user: {
        id: "feedback-user",
        isCreator: /creator|upload|payout|earning|subscription/i.test(`${item.surface} ${item.mode} ${prompt}`),
      },
      expected: buildExpectedBehavior({ item, bucket }),
      sourceReviewId: String(item._id || ""),
    },
    context: {
      reason: safeText(item.reason || "", 500),
      responseSummary: safeText(item.responseSummary || "", 1200),
      trust: item.trust || {},
      metadata: item.metadata || {},
    },
  };
};

const countBy = (items = [], field) =>
  items.reduce((acc, item) => {
    const key = String(item?.[field] || "").trim() || "unknown";
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});

const buildEvalCandidateSummary = (candidates = []) => {
  const highPriority = candidates.filter(
    (candidate) => candidate.severity === "high" || candidate.fixtureDraft?.severity === "critical"
  ).length;
  const safety = candidates.filter(
    (candidate) => candidate.fixtureDraft?.suite === "feedback_safety"
  ).length;
  const grounding = candidates.filter(
    (candidate) =>
      candidate.qualityBucket === "hallucinated_feature_claim" ||
      candidate.qualityBucket === "wrong_navigation_guidance"
  ).length;

  return {
    total: candidates.length,
    highPriority,
    safety,
    grounding,
    byStatus: countBy(candidates, "status"),
    byCategory: countBy(candidates, "category"),
    bySeverity: countBy(candidates, "severity"),
    byQualityBucket: countBy(candidates, "qualityBucket"),
    recommendation:
      safety > 0
        ? "Label safety-derived eval candidates before expanding Akuso behavior."
        : grounding > 0
          ? "Prioritize route and grounding evals before prompt tuning."
          : highPriority > 0
            ? "Start with high-priority eval candidates and add expected labels."
            : candidates.length > 0
              ? "Promote at least one reviewed candidate into the Akuso eval fixture set."
              : "No unresolved review items currently need eval conversion.",
  };
};

const buildAssistantEvalCandidates = async ({
  status = "",
  category = "",
  limit = 25,
} = {}) => {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedCategory = String(category || "").trim().toLowerCase();
  const safeLimit = clamp(limit, 1, 100, 25);
  const filter = {};

  if (CANDIDATE_STATUSES.has(normalizedStatus)) {
    filter.status = normalizedStatus;
  } else {
    filter.status = { $in: DEFAULT_CANDIDATE_STATUSES };
  }

  if (CANDIDATE_CATEGORIES.has(normalizedCategory)) {
    filter.category = normalizedCategory;
  }

  const rows = await AssistantReviewItem.find(filter)
    .sort({ severity: -1, createdAt: 1 })
    .limit(safeLimit)
    .lean();
  const candidates = rows.map((row) => buildEvalCandidate(row));

  return {
    filters: {
      status: CANDIDATE_STATUSES.has(normalizedStatus) ? normalizedStatus : "unresolved",
      category: CANDIDATE_CATEGORIES.has(normalizedCategory) ? normalizedCategory : "",
      limit: safeLimit,
    },
    summary: buildEvalCandidateSummary(candidates),
    candidates,
    fixtureDrafts: candidates.map((candidate) => candidate.fixtureDraft),
  };
};

module.exports = {
  buildAssistantEvalCandidates,
  buildEvalCandidate,
  buildEvalCandidateSummary,
  inferQualityBucket,
};
