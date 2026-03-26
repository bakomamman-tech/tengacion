const { evaluateModerationPolicy } = require("./moderationPolicyService");

const toVisibilityDecision = (status = "ALLOW") => {
  if (status === "ALLOW") {
    return "allowed";
  }
  if (status === "RESTRICTED_BLURRED") {
    return "restricted";
  }
  if (status === "HOLD_FOR_REVIEW") {
    return "review";
  }
  return "blocked";
};

const evaluateModerationDecision = (payload = {}) => {
  const decision = evaluateModerationPolicy(payload);
  return {
    ...decision,
    visibilityDecision: toVisibilityDecision(decision.status),
    reviewerRequired:
      decision.status === "HOLD_FOR_REVIEW"
      || decision.status === "RESTRICTED_BLURRED"
      || Boolean(decision.requiresEscalation),
    shouldQuarantine: Boolean(decision.quarantineMedia),
    shouldBlurDerivative: decision.status === "RESTRICTED_BLURRED",
    action:
      decision.status === "ALLOW"
        ? "allow"
        : decision.status === "RESTRICTED_BLURRED"
          ? "restrict"
          : "block",
  };
};

module.exports = {
  evaluateModerationDecision,
  toVisibilityDecision,
};
