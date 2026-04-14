const { POLICY_BUCKETS } = require("./akusoPolicyService");

const roundRate = (value = 0) =>
  Number.isFinite(value) ? Number(value.toFixed(4)) : 0;

const nowIso = () => new Date().toISOString();

const createInitialState = () => ({
  startedAt: nowIso(),
  lastUpdatedAt: nowIso(),
  requests: {
    chat: 0,
    hints: 0,
    feedback: 0,
    templates: 0,
  },
  policy: {
    total: 0,
    buckets: {
      [POLICY_BUCKETS.SAFE_ANSWER]: 0,
      [POLICY_BUCKETS.SAFE_WITH_CAUTION]: 0,
      [POLICY_BUCKETS.APP_GUIDANCE]: 0,
      [POLICY_BUCKETS.SENSITIVE_ACTION_REQUIRES_AUTH]: 0,
      [POLICY_BUCKETS.DISALLOWED]: 0,
      [POLICY_BUCKETS.EMERGENCY_ESCALATION]: 0,
      [POLICY_BUCKETS.PROMPT_INJECTION_ATTEMPT]: 0,
    },
    denials: {
      total: 0,
      promptInjection: 0,
      disallowed: 0,
      emergencyEscalation: 0,
      sensitiveAction: 0,
    },
  },
  responses: {
    total: 0,
    providers: {
      openai: 0,
      local_fallback: 0,
      policy_engine: 0,
    },
    modelAttempts: 0,
    openAIFailures: 0,
    localFallbackReasons: {
      model_router_local: 0,
      invalid_model_payload: 0,
      openai_error: 0,
    },
    routeBreakdown: {
      chat: 0,
      template: 0,
    },
  },
  security: {
    promptInjectionAttempts: 0,
    rateLimitHits: 0,
  },
  feedback: {
    total: 0,
    helpful: 0,
    notHelpful: 0,
    report: 0,
  },
});

let metricsState = createInitialState();

const touchMetrics = () => {
  metricsState.lastUpdatedAt = nowIso();
};

const bump = (container, key) => {
  if (!container || !key) {
    return;
  }
  container[key] = Number(container[key] || 0) + 1;
  touchMetrics();
};

const recordAkusoRequest = ({ routeName = "" } = {}) => {
  const routeKey = String(routeName || "").trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(metricsState.requests, routeKey)) {
    return;
  }
  bump(metricsState.requests, routeKey);
};

const recordAkusoPolicyDecision = ({ categoryBucket = "" } = {}) => {
  const bucket = String(categoryBucket || "").trim();
  if (!bucket) {
    return;
  }

  metricsState.policy.total += 1;
  bump(metricsState.policy.buckets, bucket);

  if (bucket === POLICY_BUCKETS.PROMPT_INJECTION_ATTEMPT) {
    bump(metricsState.policy.denials, "total");
    bump(metricsState.policy.denials, "promptInjection");
    return;
  }

  if (bucket === POLICY_BUCKETS.DISALLOWED) {
    bump(metricsState.policy.denials, "total");
    bump(metricsState.policy.denials, "disallowed");
    return;
  }

  if (bucket === POLICY_BUCKETS.EMERGENCY_ESCALATION) {
    bump(metricsState.policy.denials, "total");
    bump(metricsState.policy.denials, "emergencyEscalation");
    return;
  }

  if (bucket === POLICY_BUCKETS.SENSITIVE_ACTION_REQUIRES_AUTH) {
    bump(metricsState.policy.denials, "total");
    bump(metricsState.policy.denials, "sensitiveAction");
  }
};

const recordAkusoPromptInjection = () => {
  bump(metricsState.security, "promptInjectionAttempts");
};

const recordAkusoModelAttempt = () => {
  bump(metricsState.responses, "modelAttempts");
};

const recordAkusoOpenAIFailure = () => {
  bump(metricsState.responses, "openAIFailures");
};

const recordAkusoRateLimitHit = () => {
  bump(metricsState.security, "rateLimitHits");
};

const recordAkusoResponse = ({
  provider = "local_fallback",
  routeName = "chat",
  fallbackReason = "",
} = {}) => {
  const safeProvider = String(provider || "local_fallback").trim().toLowerCase();
  const safeRoute = String(routeName || "chat").trim().toLowerCase();

  metricsState.responses.total += 1;
  bump(metricsState.responses.providers, safeProvider);

  if (Object.prototype.hasOwnProperty.call(metricsState.responses.routeBreakdown, safeRoute)) {
    bump(metricsState.responses.routeBreakdown, safeRoute);
  }

  if (
    safeProvider === "local_fallback" &&
    fallbackReason &&
    Object.prototype.hasOwnProperty.call(
      metricsState.responses.localFallbackReasons,
      fallbackReason
    )
  ) {
    bump(metricsState.responses.localFallbackReasons, fallbackReason);
  }
};

const recordAkusoFeedback = ({ rating = "" } = {}) => {
  const safeRating = String(rating || "").trim().toLowerCase();
  metricsState.feedback.total += 1;
  touchMetrics();

  if (safeRating === "helpful") {
    metricsState.feedback.helpful += 1;
    return;
  }
  if (safeRating === "report") {
    metricsState.feedback.report += 1;
    return;
  }
  if (safeRating === "not_helpful") {
    metricsState.feedback.notHelpful += 1;
  }
};

const getAkusoMetricsSnapshot = () => {
  const snapshotAt = nowIso();
  const startedAtMs = Date.parse(metricsState.startedAt);
  const uptimeSec =
    Number.isFinite(startedAtMs) && startedAtMs > 0
      ? Math.max(0, Math.round((Date.now() - startedAtMs) / 1000))
      : 0;

  const responseTotal =
    Number(metricsState.responses.providers.openai || 0) +
    Number(metricsState.responses.providers.local_fallback || 0) +
    Number(metricsState.responses.providers.policy_engine || 0);
  const modelAttempts = Number(metricsState.responses.modelAttempts || 0);
  const feedbackTotal = Number(metricsState.feedback.total || 0);
  const policyTotal = Number(metricsState.policy.total || 0);

  return {
    since: metricsState.startedAt,
    snapshotAt,
    lastUpdatedAt: metricsState.lastUpdatedAt,
    uptimeSec,
    requests: {
      ...metricsState.requests,
    },
    policy: {
      total: policyTotal,
      buckets: {
        ...metricsState.policy.buckets,
      },
      denials: {
        ...metricsState.policy.denials,
      },
    },
    responses: {
      total: Number(metricsState.responses.total || 0),
      providers: {
        ...metricsState.responses.providers,
      },
      modelAttempts,
      openAIFailures: Number(metricsState.responses.openAIFailures || 0),
      localFallbackReasons: {
        ...metricsState.responses.localFallbackReasons,
      },
      routeBreakdown: {
        ...metricsState.responses.routeBreakdown,
      },
    },
    security: {
      promptInjectionAttempts: Number(metricsState.security.promptInjectionAttempts || 0),
      rateLimitHits: Number(metricsState.security.rateLimitHits || 0),
    },
    feedback: {
      total: feedbackTotal,
      helpful: Number(metricsState.feedback.helpful || 0),
      notHelpful: Number(metricsState.feedback.notHelpful || 0),
      report: Number(metricsState.feedback.report || 0),
      quality: {
        helpfulRate: roundRate(
          feedbackTotal > 0 ? Number(metricsState.feedback.helpful || 0) / feedbackTotal : 0
        ),
        negativeRate: roundRate(
          feedbackTotal > 0
            ? (Number(metricsState.feedback.notHelpful || 0) +
                Number(metricsState.feedback.report || 0)) /
              feedbackTotal
            : 0
        ),
      },
    },
    rates: {
      localFallbackRate: roundRate(
        responseTotal > 0
          ? Number(metricsState.responses.providers.local_fallback || 0) / responseTotal
          : 0
      ),
      denialRate: roundRate(
        policyTotal > 0 ? Number(metricsState.policy.denials.total || 0) / policyTotal : 0
      ),
      promptInjectionRate: roundRate(
        policyTotal > 0
          ? Number(metricsState.security.promptInjectionAttempts || 0) / policyTotal
          : 0
      ),
      openAIFailureRate: roundRate(
        modelAttempts > 0
          ? Number(metricsState.responses.openAIFailures || 0) / modelAttempts
          : 0
      ),
    },
  };
};

const resetAkusoMetrics = () => {
  metricsState = createInitialState();
};

module.exports = {
  getAkusoMetricsSnapshot,
  recordAkusoFeedback,
  recordAkusoModelAttempt,
  recordAkusoOpenAIFailure,
  recordAkusoPolicyDecision,
  recordAkusoPromptInjection,
  recordAkusoRateLimitHit,
  recordAkusoRequest,
  recordAkusoResponse,
  resetAkusoMetrics,
};
