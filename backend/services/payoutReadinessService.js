const toText = (value = "") => String(value || "").trim();

const STATUS_DETAILS = {
  not_started: {
    label: "Not started",
    nextStep: "Register as a creator before payout setup can begin.",
    actionLabel: "Start creator onboarding",
    actionPath: "/creator/register",
    supportFlow: "creator_onboarding",
  },
  profile_incomplete: {
    label: "Profile incomplete",
    nextStep: "Complete the missing creator profile details before payouts can continue.",
    actionLabel: "Update creator profile",
    actionPath: "/creator/settings",
    supportFlow: "creator_onboarding",
  },
  verification_pending: {
    label: "Verification pending",
    nextStep: "Wait for creator review to finish before requesting payout.",
    actionLabel: "Review verification status",
    actionPath: "/creator/verification",
    supportFlow: "creator_verification",
  },
  payout_method_missing: {
    label: "Payout method missing",
    nextStep: "Add payout account details before settlement review.",
    actionLabel: "Update payout details",
    actionPath: "/creator/settings",
    supportFlow: "creator_payouts",
  },
  ready: {
    label: "Ready",
    nextStep: "Your creator payout profile is ready for settlement review.",
    actionLabel: "Review earnings",
    actionPath: "/creator/earnings",
    supportFlow: "creator_payouts",
  },
  restricted: {
    label: "Restricted",
    nextStep: "Contact support or review creator verification before payouts can continue.",
    actionLabel: "Contact creator support",
    actionPath: "/creator/support",
    supportFlow: "creator_verification",
  },
};

const buildStatusPayload = (status, nextStepOverride = "") => {
  const details = STATUS_DETAILS[status] || STATUS_DETAILS.profile_incomplete;

  return {
    status,
    label: details.label,
    nextStep: nextStepOverride || details.nextStep,
    supportFlow: details.supportFlow,
    primaryAction: {
      label: details.actionLabel,
      path: details.actionPath,
      supportFlow: details.supportFlow,
    },
  };
};

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

const buildCheck = ({ key, label, complete, statusWhenMissing, nextStep, group = "profile" }) => ({
  key,
  label,
  complete: Boolean(complete),
  statusWhenMissing,
  nextStep,
  group,
});

const resolvePayoutReadinessStatus = ({ profile, checks }) => {
  const profileStatus = toText(profile?.status || "active").toLowerCase();
  const onboardingComplete = Boolean(profile?.onboardingCompleted || profile?.onboardingComplete);

  if (!profile || !toText(profile?._id || profile?.userId)) {
    return buildStatusPayload("not_started");
  }

  if (profileStatus === "restricted") {
    return buildStatusPayload("restricted");
  }

  if (profileStatus === "pending_review") {
    return buildStatusPayload("verification_pending");
  }

  const missing = checks.find((entry) => !entry.complete);
  if (missing) {
    const missingStatus = missing.statusWhenMissing || (onboardingComplete
      ? "payout_method_missing"
      : "profile_incomplete");
    return buildStatusPayload(missingStatus, missing.nextStep);
  }

  return buildStatusPayload("ready");
};

const buildBlockingReasons = (checks) => checks
  .filter((entry) => !entry.complete)
  .map((entry) => ({
    key: entry.key,
    label: entry.label,
    group: entry.group,
    status: entry.statusWhenMissing || "profile_incomplete",
    nextStep: entry.nextStep || "Complete the missing payout setup item.",
  }));

const buildPayoutReadiness = (profile = null) => {
  const accountNumber = toText(profile?.accountNumber);
  const bankName = toText(profile?.bankName);
  const bankCode = toText(profile?.bankCode);
  const accountName = toText(profile?.accountName);
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
      group: "profile",
    }),
    buildCheck({
      key: "onboarding",
      label: "Creator onboarding",
      complete: onboardingComplete,
      statusWhenMissing: "profile_incomplete",
      nextStep: "Finish creator onboarding in your workspace.",
      group: "profile",
    }),
    buildCheck({
      key: "terms",
      label: "Creator terms",
      complete: acceptedTerms && acceptedCopyrightDeclaration,
      statusWhenMissing: "profile_incomplete",
      nextStep: "Accept creator terms and copyright declarations.",
      group: "profile",
    }),
    buildCheck({
      key: "account_number",
      label: "Payout account number",
      complete: Boolean(accountNumber),
      statusWhenMissing: "payout_method_missing",
      nextStep: "Add the account number where creator payouts should land.",
      group: "payout_method",
    }),
    buildCheck({
      key: "bank_name",
      label: "Payout bank name",
      complete: Boolean(bankName),
      statusWhenMissing: "payout_method_missing",
      nextStep: "Choose the bank where creator payouts should land.",
      group: "payout_method",
    }),
    buildCheck({
      key: "bank_code",
      label: "Payout bank code",
      complete: Boolean(bankCode),
      statusWhenMissing: "payout_method_missing",
      nextStep: "Choose a supported Nigerian bank for automatic payouts.",
      group: "payout_method",
    }),
    buildCheck({
      key: "account_name",
      label: "Payout account name",
      complete: Boolean(accountName),
      statusWhenMissing: "payout_method_missing",
      nextStep: "Add or verify the account name for automatic payouts.",
      group: "payout_method",
    }),
    buildCheck({
      key: "country",
      label: "Country",
      complete: Boolean(country),
      statusWhenMissing: "profile_incomplete",
      nextStep: "Add the country attached to your creator profile.",
      group: "profile",
    }),
    buildCheck({
      key: "country_of_residence",
      label: "Country of residence",
      complete: Boolean(countryOfResidence),
      statusWhenMissing: "profile_incomplete",
      nextStep: "Add your current country of residence.",
      group: "profile",
    }),
    buildCheck({
      key: "creator_status",
      label: "Creator status",
      complete: active,
      statusWhenMissing: toText(profile?.status).toLowerCase() === "pending_review"
        ? "verification_pending"
        : "restricted",
      nextStep: "Resolve creator verification or account restrictions.",
      group: "verification",
    }),
  ];

  const status = resolvePayoutReadinessStatus({ profile, checks });
  const blockingReasons = buildBlockingReasons(checks);

  return {
    ready: status.status === "ready",
    canRequestPayout: status.status === "ready",
    status: status.status,
    label: status.label,
    nextStep: status.nextStep,
    supportFlow: status.supportFlow,
    primaryAction: status.primaryAction,
    checks,
    blockingReasons,
    missingChecks: blockingReasons.map((entry) => entry.key),
    missingCheckCount: blockingReasons.length,
    accountNumberMasked: maskAccountNumber(accountNumber),
    bankName,
    bankCode,
    accountName,
    country,
    countryOfResidence,
  };
};

module.exports = {
  buildPayoutReadiness,
  maskAccountNumber,
  STATUS_DETAILS,
};
