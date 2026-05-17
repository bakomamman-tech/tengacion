const AnalyticsEvent = require("../models/AnalyticsEvent");
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
    key: "first_upload_started",
    label: "First upload started",
  },
  {
    key: "first_upload_completed",
    label: "First upload completed",
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

const toIdString = (value = "") => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value._id) {
    return value._id.toString();
  }
  return value.toString();
};

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
  return summarizeStepKeys(completedSteps);
};

const summarizeStepKeys = (stepKeys = []) => {
  const completedSet = new Set(
    (Array.isArray(stepKeys) ? stepKeys : [])
      .map((stepKey) => String(stepKey || "").trim())
      .filter((stepKey) => CREATOR_ONBOARDING_STEP_MAP.has(stepKey))
  );
  const completedSteps = CREATOR_ONBOARDING_STEPS
    .filter((step) => completedSet.has(step.key))
    .map((step) => step.key);

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
  completedSteps = null,
  metadata = {},
} = {}) => {
  const step = CREATOR_ONBOARDING_STEP_MAP.get(stepKey);
  if (!userId || !profileId || !step) {
    return Promise.resolve(null);
  }

  const summary = Array.isArray(completedSteps)
    ? summarizeStepKeys(completedSteps)
    : summarizeSnapshot(snapshot);
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
      ...metadata,
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

const normalizeUploadStatus = (upload = {}) =>
  String(upload?.publishedStatus || (upload?.isPublished ? "published" : "draft"))
    .trim()
    .toLowerCase();

const isCompletedUploadStatus = (status = "") =>
  status === "published" || status === "under_review";

const getLoggedCreatorOnboardingStepKeys = async ({ profileId } = {}) => {
  if (!profileId) {
    return [];
  }

  const rows = await AnalyticsEvent.find({
    type: "creator_onboarding_step_completed",
    targetType: "creator_profile",
    targetId: profileId,
  })
    .select("contentType")
    .lean()
    .catch(() => []);

  return rows
    .map((row) => String(row?.contentType || "").trim())
    .filter((stepKey) => CREATOR_ONBOARDING_STEP_MAP.has(stepKey));
};

const logCreatorUploadOnboardingMilestones = async ({
  userId,
  profile = null,
  profileId = "",
  upload = {},
  source = "creator_upload",
  uploadContentType = "",
  uploadTargetId = "",
} = {}) => {
  const resolvedProfileId = profileId || profile?._id || profile?.id || "";
  if (!userId || !resolvedProfileId || !upload) {
    return [];
  }

  const status = normalizeUploadStatus(upload);
  const milestoneKeys = ["first_upload_started"];
  if (isCompletedUploadStatus(status)) {
    milestoneKeys.push("first_upload_completed");
  }

  const [loggedKeys] = await Promise.all([
    getLoggedCreatorOnboardingStepKeys({ profileId: resolvedProfileId }),
  ]);
  const profileSnapshot = buildCreatorProfileOnboardingSnapshot(profile);
  const completedKeys = new Set([
    ...getCompletedStepKeys(profileSnapshot),
    ...loggedKeys,
    ...milestoneKeys,
  ]);

  const events = [];
  for (const stepKey of milestoneKeys) {
    if (loggedKeys.includes(stepKey)) {
      continue;
    }

    const event = await logCreatorOnboardingStepCompleted({
      userId,
      profileId: resolvedProfileId,
      stepKey,
      source,
      completedSteps: [...completedKeys],
      metadata: {
        uploadStatus: status || "draft",
        uploadContentType: uploadContentType || upload?.contentType || upload?.creatorCategory || "",
        uploadTargetId: toIdString(uploadTargetId || upload?._id || upload?.id || ""),
      },
    });
    if (event) {
      events.push(event);
    }
  }

  return events;
};

module.exports = {
  CREATOR_ONBOARDING_STEPS,
  buildCreatorProfileOnboardingSnapshot,
  getLoggedCreatorOnboardingStepKeys,
  logCreatorOnboardingStepCompleted,
  logCreatorProfileOnboardingTransitions,
  logCreatorUploadOnboardingMilestones,
};
