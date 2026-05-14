const AnalyticsEvent = require("../../models/AnalyticsEvent");
const AssistantReviewItem = require("../../models/AssistantReviewItem");
const CreatorProfile = require("../../models/CreatorProfile");
const PaymentWebhookEvent = require("../../models/PaymentWebhookEvent");
const Purchase = require("../../models/Purchase");
const { buildDateRange } = require("../analyticsService");
const { getAkusoMetricsSnapshot } = require("../akusoMetricsService");
const { POLICY_BUCKETS } = require("../akusoPolicyService");

const roundRate = (value = 0) =>
  Number.isFinite(value) ? Number(value.toFixed(4)) : 0;

const toCounterMap = (entries = []) =>
  entries.reduce((acc, entry) => {
    const key = String(entry?._id || "").trim();
    if (!key || key === "null" || key === "undefined") {
      return acc;
    }
    acc[key] = Number(entry?.count || 0);
    return acc;
  }, {});

const countByField = async ({
  dates,
  type,
  fieldPath,
} = {}) => {
  const rows = await AnalyticsEvent.aggregate([
    {
      $match: {
        type,
        createdAt: { $gte: dates.start, $lte: dates.end },
      },
    },
    {
      $group: {
        _id: `$${fieldPath}`,
        count: { $sum: 1 },
      },
    },
  ]).catch(() => []);

  return toCounterMap(rows);
};

const countModelByField = async ({
  model,
  dates,
  fieldPath,
  dateField = "createdAt",
  filter = {},
} = {}) => {
  const rows = await model.aggregate([
    {
      $match: {
        ...filter,
        [dateField]: { $gte: dates.start, $lte: dates.end },
      },
    },
    {
      $group: {
        _id: `$${fieldPath}`,
        count: { $sum: 1 },
      },
    },
  ]).catch(() => []);

  return toCounterMap(rows);
};

const countDocumentsSafe = (model, filter = {}) =>
  model.countDocuments(filter).catch(() => 0);

const buildLane = ({
  key,
  title,
  severity = "low",
  summary = "",
  metrics = [],
  actionLabel = "",
  actionPath = "",
} = {}) => ({
  key,
  title,
  severity,
  summary,
  metrics,
  actionLabel,
  actionPath,
});

const buildQualityOperationsReview = async ({ dates, historical = {} } = {}) => {
  const [
    purchaseStatusCounts,
    purchaseEventCounts,
    webhookStatusCounts,
    onboardingStepCounts,
    creatorsStarted,
    creatorsCompleted,
    unresolvedReviewSeverityCounts,
    unresolvedReviewCategoryCounts,
    unresolvedReviewStatusCounts,
    newReviewItems,
  ] = await Promise.all([
    countModelByField({ model: Purchase, dates, fieldPath: "status" }),
    AnalyticsEvent.aggregate([
      {
        $match: {
          type: {
            $in: [
              "purchase_failed",
              "purchase_success",
              "purchase_checkout_failed",
              "purchase_webhook_failed",
              "purchase_webhook_duplicate",
              "purchase_access_granted",
              "purchase_entitlement_granted",
            ],
          },
          createdAt: { $gte: dates.start, $lte: dates.end },
        },
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]).then(toCounterMap).catch(() => ({})),
    countModelByField({ model: PaymentWebhookEvent, dates, fieldPath: "status" }),
    countByField({
      dates,
      type: "creator_onboarding_step_completed",
      fieldPath: "contentType",
    }),
    countDocumentsSafe(CreatorProfile, {
      createdAt: { $gte: dates.start, $lte: dates.end },
    }),
    countDocumentsSafe(CreatorProfile, {
      createdAt: { $gte: dates.start, $lte: dates.end },
      $or: [{ onboardingCompleted: true }, { onboardingComplete: true }],
    }),
    AssistantReviewItem.aggregate([
      { $match: { status: { $in: ["open", "under_review"] } } },
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]).then(toCounterMap).catch(() => ({})),
    AssistantReviewItem.aggregate([
      { $match: { status: { $in: ["open", "under_review"] } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]).then(toCounterMap).catch(() => ({})),
    AssistantReviewItem.aggregate([
      { $match: { status: { $in: ["open", "under_review"] } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).then(toCounterMap).catch(() => ({})),
    countDocumentsSafe(AssistantReviewItem, {
      createdAt: { $gte: dates.start, $lte: dates.end },
    }),
  ]);

  const purchaseAttemptsFromRecords = Object.values(purchaseStatusCounts)
    .reduce((total, value) => total + Number(value || 0), 0);
  const purchaseAttempts = purchaseAttemptsFromRecords ||
    Number(purchaseEventCounts.purchase_success || 0) +
    Number(purchaseEventCounts.purchase_failed || 0);
  const successfulPurchases = Math.max(
    Number(purchaseStatusCounts.paid || 0),
    Number(purchaseEventCounts.purchase_success || 0)
  );
  const failedPurchases = Math.max(
    Number(purchaseStatusCounts.failed || 0),
    Number(purchaseEventCounts.purchase_failed || 0)
  );
  const checkoutFailures = Number(purchaseEventCounts.purchase_checkout_failed || 0);
  const webhookFailures = Math.max(
    Number(webhookStatusCounts.failed || 0),
    Number(purchaseEventCounts.purchase_webhook_failed || 0)
  );
  const webhookReplays = Number(purchaseEventCounts.purchase_webhook_duplicate || 0);
  const purchaseFailureRate = roundRate(
    purchaseAttempts > 0 ? failedPurchases / purchaseAttempts : 0
  );

  const accountCreatedSteps = Number(onboardingStepCounts.account_created || 0);
  const profileReadySteps = Number(onboardingStepCounts.profile_ready || 0);
  const firstUploadStarted = Number(onboardingStepCounts.first_upload_started || 0);
  const firstUploadCompleted = Number(onboardingStepCounts.first_upload_completed || 0);
  const onboardingStarts = Math.max(Number(creatorsStarted || 0), accountCreatedSteps);
  const onboardingCompletions = Math.max(Number(creatorsCompleted || 0), profileReadySteps);
  const onboardingCompletionRate = roundRate(
    onboardingStarts > 0 ? onboardingCompletions / onboardingStarts : 0
  );
  const firstUploadCompletionRate = roundRate(
    firstUploadStarted > 0 ? firstUploadCompleted / firstUploadStarted : 0
  );

  const openAssistantBacklog =
    Number(unresolvedReviewStatusCounts.open || 0) +
    Number(unresolvedReviewStatusCounts.under_review || 0);
  const highSeverityBacklog = Number(unresolvedReviewSeverityCounts.high || 0);
  const fallbackRate = Number(historical?.rates?.localFallbackRate || 0);
  const negativeFeedbackRate = Number(historical?.feedback?.quality?.negativeRate || 0);
  const feedbackTotal = Number(historical?.feedback?.total || 0);
  const responseTotal = Number(historical?.responses?.total || 0);

  const commerceSeverity =
    webhookFailures > 0 || (purchaseAttempts >= 3 && purchaseFailureRate >= 0.25)
      ? "high"
      : checkoutFailures > 0 || failedPurchases > 0 || webhookReplays >= 3
        ? "medium"
        : "low";
  const onboardingSeverity =
    onboardingStarts >= 3 && onboardingCompletionRate < 0.5
      ? "high"
      : onboardingStarts >= 3 && onboardingCompletionRate < 0.75
        ? "medium"
        : "low";
  const assistantSeverity =
    highSeverityBacklog > 0 ||
    openAssistantBacklog >= 10 ||
    (responseTotal >= 4 && fallbackRate >= 0.75) ||
    (feedbackTotal >= 3 && negativeFeedbackRate >= 0.7)
      ? "high"
      : openAssistantBacklog >= 5 ||
        (responseTotal >= 4 && fallbackRate >= 0.5) ||
        (feedbackTotal >= 3 && negativeFeedbackRate >= 0.4)
        ? "medium"
        : "low";

  const lanes = [
    buildLane({
      key: "commerce_failures",
      title: "Commerce failures",
      severity: commerceSeverity,
      summary:
        commerceSeverity === "low"
          ? "Payment, checkout, and webhook failure signals are within the review threshold."
          : "Payment or webhook failures need product and operations triage before new commerce expansion.",
      metrics: [
        { label: "Purchase attempts", value: purchaseAttempts },
        { label: "Successful purchases", value: successfulPurchases },
        { label: "Failed purchases", value: failedPurchases },
        { label: "Purchase failure rate", value: purchaseFailureRate, format: "percent" },
        { label: "Checkout failures", value: checkoutFailures },
        { label: "Webhook failures", value: webhookFailures },
      ],
      actionLabel: "Review transactions",
      actionPath: "/admin/transactions",
    }),
    buildLane({
      key: "onboarding_dropoff",
      title: "Onboarding drop-off",
      severity: onboardingSeverity,
      summary:
        onboardingSeverity === "low"
          ? "Creator onboarding completion is holding inside the selected window."
          : "Creator setup is losing users before profile readiness or first publish.",
      metrics: [
        { label: "Creators started", value: onboardingStarts },
        { label: "Profile ready", value: onboardingCompletions },
        { label: "Completion rate", value: onboardingCompletionRate, format: "percent" },
        { label: "First upload started", value: firstUploadStarted },
        { label: "First upload completed", value: firstUploadCompleted },
        { label: "Upload completion rate", value: firstUploadCompletionRate, format: "percent" },
      ],
      actionLabel: "Open analytics",
      actionPath: "/admin/analytics",
    }),
    buildLane({
      key: "akuso_quality",
      title: "Akuso quality backlog",
      severity: assistantSeverity,
      summary:
        assistantSeverity === "low"
          ? "Assistant fallback, feedback, and review queue signals are under the action threshold."
          : "Akuso needs review attention before expanding assistant behavior.",
      metrics: [
        { label: "Open review backlog", value: openAssistantBacklog },
        { label: "High-severity backlog", value: highSeverityBacklog },
        { label: "New review items", value: newReviewItems },
        { label: "Negative feedback rate", value: negativeFeedbackRate, format: "percent" },
        { label: "Local fallback rate", value: fallbackRate, format: "percent" },
        { label: "Quality category backlog", value: Number(unresolvedReviewCategoryCounts.quality || 0) },
      ],
      actionLabel: "Open reviews",
      actionPath: "/admin/assistant/reviews",
    }),
  ];

  const productFixTitle =
    commerceSeverity === "low" && onboardingSeverity !== "low"
      ? "Inspect creator onboarding exits before the next weekly demo"
      : commerceSeverity === "low"
        ? "Sample recent paid purchases and confirm entitlement continuity"
        : "Audit failed checkouts and webhook failures";
  const assistantFixTitle =
    assistantSeverity === "low"
      ? "Promote one reviewed Akuso answer into an eval fixture"
      : "Triage high-priority Akuso feedback and fallback causes";
  const instrumentationFixTitle =
    firstUploadStarted === 0 && onboardingStarts > 0
      ? "Verify first-upload analytics are emitted from creator upload flows"
      : webhookFailures > 0
        ? "Check webhook failure metadata and replay diagnostics"
        : "Confirm weekly review metrics match admin analytics snapshots";

  return {
    window: historical.window || {
      range: dates.range,
      startDate: dates.start.toISOString(),
      endDate: dates.end.toISOString(),
    },
    summary: {
      purchaseAttempts,
      successfulPurchases,
      failedPurchases,
      purchaseFailureRate,
      webhookFailures,
      onboardingStarts,
      onboardingCompletions,
      onboardingCompletionRate,
      openAssistantBacklog,
      highSeverityBacklog,
      negativeFeedbackRate,
      fallbackRate,
    },
    lanes,
    actions: [
      {
        type: "product_fix",
        title: productFixTitle,
        priority: commerceSeverity === "high" || onboardingSeverity === "high" ? "high" : "medium",
        owner: "Product and marketplace",
        sourceKey: commerceSeverity === "low" && onboardingSeverity !== "low"
          ? "onboarding_dropoff"
          : "commerce_failures",
        actionPath: commerceSeverity === "low" && onboardingSeverity !== "low"
          ? "/admin/analytics"
          : "/admin/transactions",
      },
      {
        type: "assistant_fix",
        title: assistantFixTitle,
        priority: assistantSeverity,
        owner: "AI and assistant",
        sourceKey: "akuso_quality",
        actionPath: assistantSeverity === "low"
          ? "/admin/assistant/metrics"
          : "/admin/assistant/reviews",
      },
      {
        type: "instrumentation_fix",
        title: instrumentationFixTitle,
        priority: webhookFailures > 0 || (firstUploadStarted === 0 && onboardingStarts > 0)
          ? "medium"
          : "low",
        owner: "Infrastructure and backend",
        sourceKey: webhookFailures > 0 ? "commerce_failures" : "onboarding_dropoff",
        actionPath: webhookFailures > 0 ? "/admin/transactions" : "/admin/analytics",
      },
    ],
    thresholds: {
      commerceFailureRateWatch: 0.25,
      onboardingCompletionWatch: 0.75,
      onboardingCompletionCritical: 0.5,
      assistantBacklogWatch: 5,
      assistantBacklogCritical: 10,
      assistantFallbackRateWatch: 0.5,
      assistantNegativeFeedbackRateWatch: 0.4,
    },
  };
};

const buildHistoricalAlerts = ({
  promptInjectionAttempts = 0,
  openAIFailureRate = 0,
  localFallbackRate = 0,
  negativeFeedbackRate = 0,
  feedbackTotal = 0,
  responseTotal = 0,
} = {}) => {
  const alerts = [];

  if (promptInjectionAttempts > 0) {
    alerts.push({
      key: "akuso_prompt_injection_attempts",
      severity: promptInjectionAttempts >= 5 ? "high" : "medium",
      title: "Akuso prompt injection attempts detected",
      value: promptInjectionAttempts,
      actionPath: "/admin/assistant/metrics",
    });
  }

  if (openAIFailureRate >= 0.25 && responseTotal >= 4) {
    alerts.push({
      key: "akuso_openai_failures",
      severity: openAIFailureRate >= 0.5 ? "high" : "medium",
      title: "Akuso OpenAI failure rate elevated",
      value: roundRate(openAIFailureRate),
      actionPath: "/admin/assistant/metrics",
    });
  }

  if (localFallbackRate >= 0.5 && responseTotal >= 4) {
    alerts.push({
      key: "akuso_local_fallback_rate",
      severity: localFallbackRate >= 0.75 ? "high" : "medium",
      title: "Akuso local fallback rate elevated",
      value: roundRate(localFallbackRate),
      actionPath: "/admin/assistant/metrics",
    });
  }

  if (negativeFeedbackRate >= 0.4 && feedbackTotal >= 3) {
    alerts.push({
      key: "akuso_feedback_quality",
      severity: negativeFeedbackRate >= 0.7 ? "high" : "medium",
      title: "Akuso negative feedback rate elevated",
      value: roundRate(negativeFeedbackRate),
      actionPath: "/admin/assistant/metrics",
    });
  }

  return alerts;
};

const buildAkusoAdminMetrics = async ({
  range = "30d",
  startDate = "",
  endDate = "",
} = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });

  const [
    typeCountsRows,
    policyBucketCounts,
    responseProviderCounts,
    responseFallbackCounts,
    responseRoutePurposeCounts,
    feedbackRatingCounts,
  ] = await Promise.all([
    AnalyticsEvent.aggregate([
      {
        $match: {
          type: { $regex: /^akuso_/i },
          createdAt: { $gte: dates.start, $lte: dates.end },
        },
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]).catch(() => []),
    countByField({
      dates,
      type: "akuso_policy_decision",
      fieldPath: "metadata.categoryBucket",
    }),
    countByField({
      dates,
      type: "akuso_response",
      fieldPath: "metadata.provider",
    }),
    countByField({
      dates,
      type: "akuso_response",
      fieldPath: "metadata.fallbackReason",
    }),
    countByField({
      dates,
      type: "akuso_response",
      fieldPath: "metadata.routePurpose",
    }),
    countByField({
      dates,
      type: "akuso_feedback",
      fieldPath: "metadata.rating",
    }),
  ]);

  const typeCounts = toCounterMap(typeCountsRows);
  const live = getAkusoMetricsSnapshot();

  const promptInjectionAttempts = Number(typeCounts.akuso_prompt_injection || 0);
  const policyTotal = Number(typeCounts.akuso_policy_decision || 0) + promptInjectionAttempts;
  const responsesTotal = Number(typeCounts.akuso_response || 0);
  const feedbackTotal = Number(typeCounts.akuso_feedback || 0);
  const modelAttempts = Number(typeCounts.akuso_model_attempt || 0);
  const openAIFailures = Number(typeCounts.akuso_openai_failure || 0);
  const rateLimitHits = Number(typeCounts.akuso_rate_limit || 0);

  const denials = {
    total:
      promptInjectionAttempts +
      Number(policyBucketCounts[POLICY_BUCKETS.DISALLOWED] || 0) +
      Number(policyBucketCounts[POLICY_BUCKETS.EMERGENCY_ESCALATION] || 0) +
      Number(policyBucketCounts[POLICY_BUCKETS.SENSITIVE_ACTION_REQUIRES_AUTH] || 0),
    promptInjection: promptInjectionAttempts,
    disallowed: Number(policyBucketCounts[POLICY_BUCKETS.DISALLOWED] || 0),
    emergencyEscalation: Number(policyBucketCounts[POLICY_BUCKETS.EMERGENCY_ESCALATION] || 0),
    sensitiveAction: Number(
      policyBucketCounts[POLICY_BUCKETS.SENSITIVE_ACTION_REQUIRES_AUTH] || 0
    ),
  };

  const helpful = Number(feedbackRatingCounts.helpful || 0);
  const notHelpful = Number(feedbackRatingCounts.not_helpful || 0);
  const report = Number(feedbackRatingCounts.report || 0);
  const localFallbackCount = Number(responseProviderCounts.local_fallback || 0);

  const historical = {
    window: {
      range: dates.range,
      startDate: dates.start.toISOString(),
      endDate: dates.end.toISOString(),
    },
    requests: {
      policyDecisions: policyTotal,
      responses: responsesTotal,
      feedback: feedbackTotal,
      modelAttempts,
    },
    policy: {
      total: policyTotal,
      buckets: {
        [POLICY_BUCKETS.SAFE_ANSWER]: Number(policyBucketCounts[POLICY_BUCKETS.SAFE_ANSWER] || 0),
        [POLICY_BUCKETS.SAFE_WITH_CAUTION]: Number(
          policyBucketCounts[POLICY_BUCKETS.SAFE_WITH_CAUTION] || 0
        ),
        [POLICY_BUCKETS.APP_GUIDANCE]: Number(policyBucketCounts[POLICY_BUCKETS.APP_GUIDANCE] || 0),
        [POLICY_BUCKETS.SENSITIVE_ACTION_REQUIRES_AUTH]: Number(
          policyBucketCounts[POLICY_BUCKETS.SENSITIVE_ACTION_REQUIRES_AUTH] || 0
        ),
        [POLICY_BUCKETS.DISALLOWED]: Number(policyBucketCounts[POLICY_BUCKETS.DISALLOWED] || 0),
        [POLICY_BUCKETS.EMERGENCY_ESCALATION]: Number(
          policyBucketCounts[POLICY_BUCKETS.EMERGENCY_ESCALATION] || 0
        ),
        [POLICY_BUCKETS.PROMPT_INJECTION_ATTEMPT]: promptInjectionAttempts,
      },
      denials,
    },
    responses: {
      total: responsesTotal,
      providers: {
        openai: Number(responseProviderCounts.openai || 0),
        local_fallback: localFallbackCount,
        policy_engine: Number(responseProviderCounts.policy_engine || 0),
      },
      localFallbackReasons: {
        model_router_local: Number(responseFallbackCounts.model_router_local || 0),
        invalid_model_payload: Number(responseFallbackCounts.invalid_model_payload || 0),
        openai_error: Number(responseFallbackCounts.openai_error || 0),
      },
      routeBreakdown: {
        chat: Number(responseRoutePurposeCounts.chat || 0),
        template: Number(responseRoutePurposeCounts.template || 0),
      },
    },
    security: {
      promptInjectionAttempts,
      rateLimitHits,
      openAIFailures,
    },
    feedback: {
      total: feedbackTotal,
      helpful,
      notHelpful,
      report,
      quality: {
        helpfulRate: roundRate(feedbackTotal > 0 ? helpful / feedbackTotal : 0),
        negativeRate: roundRate(
          feedbackTotal > 0 ? (notHelpful + report) / feedbackTotal : 0
        ),
      },
    },
    rates: {
      localFallbackRate: roundRate(
        responsesTotal > 0 ? localFallbackCount / responsesTotal : 0
      ),
      denialRate: roundRate(policyTotal > 0 ? denials.total / policyTotal : 0),
      promptInjectionRate: roundRate(
        policyTotal > 0 ? promptInjectionAttempts / policyTotal : 0
      ),
      openAIFailureRate: roundRate(
        modelAttempts > 0 ? openAIFailures / modelAttempts : 0
      ),
    },
  };

  const operationsReview = await buildQualityOperationsReview({ dates, historical });

  return {
    live,
    historical,
    operationsReview,
    alerts: buildHistoricalAlerts({
      promptInjectionAttempts,
      openAIFailureRate: historical.rates.openAIFailureRate,
      localFallbackRate: historical.rates.localFallbackRate,
      negativeFeedbackRate: historical.feedback.quality.negativeRate,
      feedbackTotal,
      responseTotal: responsesTotal,
    }),
  };
};

module.exports = {
  buildAkusoAdminMetrics,
  buildQualityOperationsReview,
};
