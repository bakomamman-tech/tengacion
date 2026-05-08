const {
  calculateCreatorProfileCompletionScore,
  isCreatorRegistrationCompleted,
  normalizeCreatorTypes,
} = require("./creatorProfileService");

const LANE_UPLOAD_ROUTES = {
  music: "/creator/music/upload",
  bookPublishing: "/creator/books/upload",
  podcast: "/creator/podcasts/upload",
};

const toText = (value = "") => String(value || "").trim();

const toList = (value = []) => (Array.isArray(value) ? value : []);

const getItemStatus = (item = {}) =>
  toText(item.publishedStatus || (item.isPublished ? "published" : "draft"))
    .toLowerCase();

const flattenContentItems = (content = {}) => [
  ...toList(content.musicTracks),
  ...toList(content.podcastTracks),
  ...toList(content.books),
  ...toList(content.albums),
  ...toList(content.videos),
];

const resolveUploadRoute = (creatorTypes = []) => {
  const [firstLane] = normalizeCreatorTypes(creatorTypes);
  return LANE_UPLOAD_ROUTES[firstLane] || "/creator/categories";
};

const buildStep = ({
  key,
  label,
  description,
  complete,
  actionLabel,
  actionTo,
}) => ({
  key,
  label,
  description,
  complete: Boolean(complete),
  actionLabel,
  actionTo,
});

const buildCreatorActivationProgress = ({
  profile = null,
  user = null,
  creatorTypes = [],
  content = {},
  payoutReadiness = null,
} = {}) => {
  const suppliedCreatorTypes = normalizeCreatorTypes(creatorTypes);
  const normalizedCreatorTypes = suppliedCreatorTypes.length
    ? suppliedCreatorTypes
    : normalizeCreatorTypes(profile?.creatorTypes || []);
  const contentItems = flattenContentItems(content);
  const hasStartedUpload = contentItems.length > 0;
  const hasCompletedUpload = contentItems.some((item) => {
    const status = getItemStatus(item);
    return status === "published" || status === "under_review";
  });
  const hasIdentity = Boolean(
    toText(profile?.displayName || profile?.fullName || user?.name)
  );
  const hasTerms = Boolean(profile?.acceptedTerms && profile?.acceptedCopyrightDeclaration);
  const onboardingComplete = Boolean(isCreatorRegistrationCompleted(profile));
  const profileCompletionScore = Number(profile?.profileCompletionScore)
    || calculateCreatorProfileCompletionScore(profile || {});
  const profileReady = Boolean(
    profile &&
    hasIdentity &&
    normalizedCreatorTypes.length &&
    hasTerms &&
    (onboardingComplete || profileCompletionScore >= 75)
  );
  const payoutStarted = Boolean(
    profile &&
    (
      toText(profile?.accountNumber) ||
      toText(profile?.country) ||
      toText(profile?.countryOfResidence) ||
      (payoutReadiness && payoutReadiness.status !== "not_started")
    )
  );
  const uploadRoute = resolveUploadRoute(normalizedCreatorTypes);

  const steps = [
    buildStep({
      key: "account_created",
      label: "Account created",
      description: "Your creator profile exists in Tengacion.",
      complete: Boolean(profile?._id || profile?.userId || user?._id),
      actionLabel: "Start creator onboarding",
      actionTo: "/creator/register",
    }),
    buildStep({
      key: "creator_lane_selected",
      label: "Creator lane selected",
      description: "Music, book publishing, or podcast lanes are enabled.",
      complete: normalizedCreatorTypes.length > 0,
      actionLabel: "Choose creator lanes",
      actionTo: "/creator/categories",
    }),
    buildStep({
      key: "profile_ready",
      label: "Profile ready",
      description: "Identity, creator terms, and publishing basics are saved.",
      complete: profileReady,
      actionLabel: "Complete creator profile",
      actionTo: "/creator/settings",
    }),
    buildStep({
      key: "first_upload_started",
      label: "First upload started",
      description: "A draft or submitted creator upload exists.",
      complete: hasStartedUpload,
      actionLabel: "Start first upload",
      actionTo: uploadRoute,
    }),
    buildStep({
      key: "first_upload_completed",
      label: "First upload completed",
      description: "At least one upload has reached review or publishing.",
      complete: hasCompletedUpload,
      actionLabel: "Finish first upload",
      actionTo: uploadRoute,
    }),
    buildStep({
      key: "payment_readiness_started",
      label: "Payment readiness started",
      description: "Payout details are saved or ready for review.",
      complete: payoutStarted,
      actionLabel: "Review payout readiness",
      actionTo: "/creator/payouts",
    }),
  ];

  const completedCount = steps.filter((step) => step.complete).length;
  const nextStep = steps.find((step) => !step.complete) || null;
  const totalSteps = steps.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  return {
    status: nextStep ? "in_progress" : "complete",
    completedCount,
    totalSteps,
    progressPercent,
    nextStep,
    steps,
    firstUploadStarted: hasStartedUpload,
    firstUploadCompleted: hasCompletedUpload,
    enabledCreatorTypes: normalizedCreatorTypes,
  };
};

module.exports = {
  buildCreatorActivationProgress,
};
