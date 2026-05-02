const toText = (value = "") => String(value || "").trim();

const maskAccountNumber = (value = "") => {
  const normalized = toText(value).replace(/\s+/g, "");
  if (!normalized) {
    return "";
  }
  if (normalized.length <= 4) {
    return normalized;
  }
  return `${"*".repeat(normalized.length - 4)}${normalized.slice(-4)}`;
};

const buildCheck = ({ key, label, complete, statusWhenMissing, nextStep }) => ({
  key,
  label,
  complete: Boolean(complete),
  statusWhenMissing,
  nextStep,
});

const resolvePayoutReadinessStatus = ({ profile, checks }) => {
  const profileStatus = toText(profile?.status || "active").toLowerCase();
  const onboardingComplete = Boolean(profile?.onboardingCompleted || profile?.onboardingComplete);

  if (!profile || !toText(profile?._id || profile?.userId)) {
    return {
      status: "not_started",
      label: "Not started",
      nextStep: "Register as a creator before payout setup can begin.",
    };
  }

  if (profileStatus === "restricted") {
    return {
      status: "restricted",
      label: "Restricted",
      nextStep: "Contact support or review creator verification before payouts can continue.",
    };
  }

  if (profileStatus === "pending_review") {
    return {
      status: "verification_pending",
      label: "Verification pending",
      nextStep: "Wait for creator review to finish before requesting payout.",
    };
  }

  const missing = checks.find((entry) => !entry.complete);
  if (missing) {
    return {
      status: missing.statusWhenMissing || (onboardingComplete ? "payout_method_missing" : "profile_incomplete"),
      label: onboardingComplete ? "Payout method missing" : "Profile incomplete",
      nextStep: missing.nextStep || "Complete the missing payout setup item.",
    };
  }

  return {
    status: "ready",
    label: "Ready",
    nextStep: "Your creator payout profile is ready for settlement review.",
  };
};

const buildPayoutReadiness = (profile = null) => {
  const accountNumber = toText(profile?.accountNumber);
  const country = toText(profile?.country);
  const countryOfResidence = toText(profile?.countryOfResidence);
  const active = toText(profile?.status || "active").toLowerCase() === "active";
  const onboardingComplete = Boolean(profile?.onboardingCompleted || profile?.onboardingComplete);
  const acceptedTerms = Boolean(profile?.acceptedTerms);
  const acceptedCopyrightDeclaration = Boolean(profile?.acceptedCopyrightDeclaration);

  const checks = [
    buildCheck({
      key: "creator_profile",
      label: "Creator profile",
      complete: Boolean(profile && toText(profile?._id || profile?.userId)),
      statusWhenMissing: "not_started",
      nextStep: "Register as a creator and choose your creator lane.",
    }),
    buildCheck({
      key: "onboarding",
      label: "Creator onboarding",
      complete: onboardingComplete,
      statusWhenMissing: "profile_incomplete",
      nextStep: "Finish creator onboarding in your workspace.",
    }),
    buildCheck({
      key: "terms",
      label: "Creator terms",
      complete: acceptedTerms && acceptedCopyrightDeclaration,
      statusWhenMissing: "profile_incomplete",
      nextStep: "Accept creator terms and copyright declarations.",
    }),
    buildCheck({
      key: "account_number",
      label: "Payout account number",
      complete: Boolean(accountNumber),
      statusWhenMissing: "payout_method_missing",
      nextStep: "Add the account number where creator payouts should land.",
    }),
    buildCheck({
      key: "country",
      label: "Country",
      complete: Boolean(country),
      statusWhenMissing: "profile_incomplete",
      nextStep: "Add the country attached to your creator profile.",
    }),
    buildCheck({
      key: "country_of_residence",
      label: "Country of residence",
      complete: Boolean(countryOfResidence),
      statusWhenMissing: "profile_incomplete",
      nextStep: "Add your current country of residence.",
    }),
    buildCheck({
      key: "creator_status",
      label: "Creator status",
      complete: active,
      statusWhenMissing: toText(profile?.status).toLowerCase() === "pending_review"
        ? "verification_pending"
        : "restricted",
      nextStep: "Resolve creator verification or account restrictions.",
    }),
  ];

  const status = resolvePayoutReadinessStatus({ profile, checks });

  return {
    ready: status.status === "ready",
    status: status.status,
    label: status.label,
    nextStep: status.nextStep,
    checks,
    missingChecks: checks.filter((entry) => !entry.complete).map((entry) => entry.key),
    accountNumberMasked: maskAccountNumber(accountNumber),
    country,
    countryOfResidence,
  };
};

module.exports = {
  buildPayoutReadiness,
  maskAccountNumber,
};
