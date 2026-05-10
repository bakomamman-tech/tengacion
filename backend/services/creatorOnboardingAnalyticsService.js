const { logAnalyticsEvent } = require("./analyticsService");
const {
  calculateCreatorProfileCompletionScore,
  isCreatorRegistrationCompleted,
  normalizeCreatorTypes,
} = require("./creatorProfileService");

const CREATOR_ONBOARDING_STEPS = [
  {
    key: "account_created",
    label: "Account created",
  },
  {
    key: "creator_lane_selected",
    label: "Creator lane selected",
  },
  {
    key: "profile_ready",
    label: "Profile ready",
  },
  {
    key: "payment_readiness_started",
    label: "Payment readiness started",
  },
];

const CREATOR_ONBOARDING_STEP_MAP = new Map(
  CREATOR_ONBOARDING_STEPS.map((step) => [step.key, step])
);

const toText = (value = "") => String(value || "").trim();

const hasCreatorProfileIdentity = (profile = {}) =>
  Boolean(toText(profile?.displayName || profile?.fullName));

const hasPayoutReadinessSignal = (profile = {}) =>
  Boolean(
    toText(profile?.accountNumber) ||
      toText(profile?.country) ||
      toText(profile?.countryOfResidence)
  );

const buildCreatorProfileOnboardingSnapshot = (profile = null) => {
  if (!profile) {
    return {
      account_created: false,
      creator_lane_selected: false,
      profile_ready: false,
      payment_readiness_started: false,
    };
  }

  const creatorTypes = normalizeCreatorTypes(profile.creatorTypes || []);
  const profileCompletionScore = Number(profile.profileCompletionScore) ||
    calculateCreatorProfileCompletionScore(profile);
  const profileReady = Boolean(
    hasCreatorProfileIdentity(profile) &&
      creatorTypes.length > 0 &&
      profile.acceptedTerms &&
      profile.acceptedCopyrightDeclaration &&
      (isCreatorRegistrationCompleted(profile) || profileCompletionScore >= 75)
  );

  return {
    account_created: Boolean(profile._id || profile.userId),
    creator_lane_selected: creatorTypes.length > 0,
    profile_ready: profileReady,
    payment_readiness_started: hasPayoutReadinessSignal(profile),
  };
};

const getCompletedStepKeys = (snapshot = {}) =>
  CREATOR_ONBOARDING_STEPS
    .filter((step) => Boolean(snapshot[step.key]))
    .map((step) => step.key);

const summarizeSnapshot = (snapshot = {}) => {
  const completedSteps = getCompletedStepKeys(snapshot);
  return {
    completedSteps,
    completedCount: completedSteps.length,
    totalSteps: CREATOR_ONBOARDING_STEPS.length,
    progressPercent: Math.round((completedSteps.length / CREATOR_ONBOARDING_STEPS.length) * 100),
  };
};

const logCreatorOnboardingStepCompleted = ({
  userId,
  profileId,
  stepKey,
  source = "",
  snapshot = {},
} = {}) => {
  const step = CREATOR_ONBOARDING_STEP_MAP.get(stepKey);
  if (!userId || !profileId || !step) {
    return Promise.resolve(null);
  }

  const summary = summarizeSnapshot(snapshot);
  return logAnalyticsEvent({
    type: "creator_onboarding_step_completed",
    userId,
    actorRole: "artist",
    targetId: profileId,
    targetType: "creator_profile",
    contentType: step.key,
    metadata: {
      stepKey: step.key,
      stepLabel: step.label,
      source,
      completedCount: summary.completedCount,
      totalSteps: summary.totalSteps,
      progressPercent: summary.progressPercent,
      completedSteps: summary.completedSteps,
    },
  }).catch(() => null);
};

const logCreatorProfileOnboardingTransitions = async ({
  userId,
  profileId,
  beforeProfile = null,
  afterProfile = null,
  source = "",
} = {}) => {
  try {
    if (!userId || !profileId || !afterProfile) {
      return [];
    }

    const beforeSnapshot = buildCreatorProfileOnboardingSnapshot(beforeProfile);
    const afterSnapshot = buildCreatorProfileOnboardingSnapshot(afterProfile);
    const beforeCompleted = new Set(getCompletedStepKeys(beforeSnapshot));
    const newlyCompletedSteps = getCompletedStepKeys(afterSnapshot).filter(
      (stepKey) => !beforeCompleted.has(stepKey)
    );

    const events = await Promise.all(
      newlyCompletedSteps.map((stepKey) =>
        logCreatorOnboardingStepCompleted({
          userId,
          profileId,
          stepKey,
          source,
          snapshot: afterSnapshot,
        })
      )
    );

    return events.filter(Boolean);
  } catch {
    return [];
  }
};

module.exports = {
  CREATOR_ONBOARDING_STEPS,
  buildCreatorProfileOnboardingSnapshot,
  logCreatorOnboardingStepCompleted,
  logCreatorProfileOnboardingTransitions,
};
