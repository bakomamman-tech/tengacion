const { AKUSO_MODES, classifyAkusoRequest } = require("./akusoClassifierService");
const { canUserAccessFeature } = require("./akusoFeatureRegistryService");

const POLICY_BUCKETS = {
  SAFE_ANSWER: "SAFE_ANSWER",
  SAFE_WITH_CAUTION: "SAFE_WITH_CAUTION",
  APP_GUIDANCE: "APP_GUIDANCE",
  SENSITIVE_ACTION_REQUIRES_AUTH: "SENSITIVE_ACTION_REQUIRES_AUTH",
  DISALLOWED: "DISALLOWED",
  EMERGENCY_ESCALATION: "EMERGENCY_ESCALATION",
  PROMPT_INJECTION_ATTEMPT: "PROMPT_INJECTION_ATTEMPT",
};

const CAUTION_NOTICES = {
  medical:
    "Akuso can share general health education only and cannot diagnose, prescribe, or replace a licensed clinician.",
  legal:
    "Akuso can give high-level legal information only. For real decisions, use a qualified legal professional.",
  financial:
    "Akuso can give high-level financial education only. For real financial decisions, use a qualified professional.",
};

const evaluateAkusoPolicy = ({
  input = {},
  user = {},
  promptInjectionGuard = null,
} = {}) => {
  const classification = classifyAkusoRequest({
    message: input.message,
    mode: input.mode,
    currentRoute: input.currentRoute,
    currentPage: input.currentPage,
    promptInjectionGuard,
  });

  let categoryBucket = POLICY_BUCKETS.SAFE_ANSWER;
  let safetyLevel = "safe";
  const warnings = [];
  const suggestions = [];
  let shouldCallModel = true;
  let requiresAuth = false;
  let httpStatus = 200;
  let denialReason = "";

  if (classification.promptInjection?.matched) {
    categoryBucket = POLICY_BUCKETS.PROMPT_INJECTION_ATTEMPT;
    safetyLevel = "refusal";
    shouldCallModel = false;
    denialReason =
      "Akuso cannot reveal hidden instructions, secrets, internal configuration, or privileged data.";
    suggestions.push("Ask about a real Tengacion feature instead.");
  } else if (classification.disallowed) {
    categoryBucket = POLICY_BUCKETS.DISALLOWED;
    safetyLevel = "refusal";
    shouldCallModel = false;
    denialReason =
      "Akuso cannot help with fraud, hacking, credential theft, exploitation, or other harmful requests.";
    suggestions.push("Ask for a safe alternative or a defensive explanation.");
  } else if (classification.emergency) {
    categoryBucket = POLICY_BUCKETS.EMERGENCY_ESCALATION;
    safetyLevel = "emergency";
    shouldCallModel = false;
    denialReason =
      "This sounds urgent. Please contact your GP, a licensed clinician, or emergency services immediately.";
  } else if (classification.sensitive) {
    categoryBucket = POLICY_BUCKETS.SENSITIVE_ACTION_REQUIRES_AUTH;
    safetyLevel = "caution";
    shouldCallModel = false;
    requiresAuth = true;
    if (!user?.id) {
      httpStatus = 401;
      denialReason =
        "Sign in first before Akuso can discuss account-specific or sensitive actions safely.";
    } else {
      denialReason =
        "Akuso will not perform sensitive account, payout, payment, or private-data actions on your behalf.";
    }
    suggestions.push("Use the secure page and complete the action yourself.");
  } else if (classification.appHelpRequested) {
    categoryBucket = POLICY_BUCKETS.APP_GUIDANCE;
    safetyLevel = "safe";
  }

  if (
    categoryBucket !== POLICY_BUCKETS.PROMPT_INJECTION_ATTEMPT &&
    categoryBucket !== POLICY_BUCKETS.DISALLOWED &&
    categoryBucket !== POLICY_BUCKETS.EMERGENCY_ESCALATION &&
    categoryBucket !== POLICY_BUCKETS.SENSITIVE_ACTION_REQUIRES_AUTH
  ) {
    if (classification.medical || classification.legal || classification.financial) {
      categoryBucket = POLICY_BUCKETS.SAFE_WITH_CAUTION;
      safetyLevel = "caution";
      if (classification.medical) warnings.push(CAUTION_NOTICES.medical);
      if (classification.legal) warnings.push(CAUTION_NOTICES.legal);
      if (classification.financial) warnings.push(CAUTION_NOTICES.financial);
    }
  }

  const featureAccessAllowed = classification.feature
    ? canUserAccessFeature(classification.feature, user)
    : false;

  if (classification.feature && !featureAccessAllowed) {
    warnings.push(
      classification.feature.access === "admin"
        ? "That feature is restricted to trusted staff."
        : classification.feature.access === "creator"
          ? "That feature is limited to creators or admins."
          : "Sign in before Akuso can open that screen."
    );
  }

  return {
    classification,
    categoryBucket,
    safetyLevel,
    warnings: [...new Set(warnings)].filter(Boolean),
    suggestions: [...new Set(suggestions)].filter(Boolean),
    shouldCallModel,
    requiresAuth,
    httpStatus,
    denialReason,
    featureAccessAllowed,
    mode: classification.mode || AKUSO_MODES.KNOWLEDGE_LEARNING,
    taskType:
      classification.mode === AKUSO_MODES.CREATOR_WRITING
        ? "creator_writing"
        : classification.needsReasoning
          ? "reasoning"
          : classification.mode === AKUSO_MODES.APP_HELP
            ? "app_guidance"
            : "knowledge",
  };
};

module.exports = {
  POLICY_BUCKETS,
  evaluateAkusoPolicy,
};
