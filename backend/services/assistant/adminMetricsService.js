const AnalyticsEvent = require("../../models/AnalyticsEvent");
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

  return {
    live,
    historical,
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
};
