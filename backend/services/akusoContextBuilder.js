const mongoose = require("mongoose");

const CreatorProfile = require("../models/CreatorProfile");
const User = require("../models/User");
const { sanitizePlainText, sanitizeRoute } = require("./assistant/outputSanitizer");
const {
  findFeatureByRoute,
  listRelevantFeatures,
} = require("./akusoFeatureRegistryService");
const { sanitizeAkusoPreferences } = require("./akusoMemoryService");

const pickSafeContextHints = (value = {}) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    surface: sanitizePlainText(source.surface || "", 60),
    pageTitle: sanitizePlainText(source.pageTitle || "", 120),
    section: sanitizePlainText(source.section || "", 80),
    selectedEntity: sanitizePlainText(source.selectedEntity || "", 80),
    publicCreatorId: sanitizePlainText(source.publicCreatorId || "", 80),
  };
};

const buildSafeProfileSummary = (user = {}, creatorProfile = null) => ({
  displayName: sanitizePlainText(user?.name || creatorProfile?.displayName || "", 120),
  username: sanitizePlainText(user?.username || "", 80),
  role: sanitizePlainText(user?.role || "guest", 40) || "guest",
  country: sanitizePlainText(user?.country || "", 80),
  creatorDisplayName: sanitizePlainText(creatorProfile?.displayName || "", 120),
  creatorTypes: Array.isArray(creatorProfile?.creatorTypes)
    ? creatorProfile.creatorTypes.map((entry) => sanitizePlainText(entry, 40)).filter(Boolean)
    : [],
  creatorStatus: creatorProfile
    ? creatorProfile.onboardingComplete || creatorProfile.onboardingCompleted
      ? "ready"
      : "onboarding"
    : "not_creator",
});

const loadPublicCreatorInfo = async (creatorId = "") => {
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return null;
  }

  const doc = await CreatorProfile.findById(creatorId)
    .select("displayName tagline genres creatorTypes")
    .lean();

  if (!doc) {
    return null;
  }

  return {
    displayName: sanitizePlainText(doc.displayName || "", 120),
    tagline: sanitizePlainText(doc.tagline || "", 160),
    genres: Array.isArray(doc.genres)
      ? doc.genres.map((entry) => sanitizePlainText(entry, 40)).filter(Boolean).slice(0, 6)
      : [],
    creatorTypes: Array.isArray(doc.creatorTypes)
      ? doc.creatorTypes.map((entry) => sanitizePlainText(entry, 40)).filter(Boolean).slice(0, 4)
      : [],
  };
};

const buildAkusoContext = async ({ input = {}, user = {}, memory = {} } = {}) => {
  const currentRoute = sanitizeRoute(input.currentRoute || "");
  const currentPage = sanitizePlainText(input.currentPage || "", 120);
  const contextHints = pickSafeContextHints(input.contextHints);
  const preferences = sanitizeAkusoPreferences({
    ...memory,
    ...input.preferences,
  });
  const currentFeature = findFeatureByRoute(currentRoute);

  const [userRecord, creatorProfile, publicCreator] = await Promise.all([
    user?.id
      ? User.findById(user.id)
          .select("name username role country")
          .lean()
      : Promise.resolve(null),
    user?.id
      ? CreatorProfile.findOne({ userId: user.id })
          .select("displayName creatorTypes onboardingComplete onboardingCompleted")
          .lean()
      : Promise.resolve(null),
    contextHints.publicCreatorId
      ? loadPublicCreatorInfo(contextHints.publicCreatorId)
      : Promise.resolve(null),
  ]);

  const auth = {
    isAuthenticated: Boolean(user?.id),
    userId: sanitizePlainText(user?.id || "", 80),
    role: sanitizePlainText(user?.role || "guest", 40) || "guest",
    isAdmin: Boolean(user?.isAdmin),
    isCreator: Boolean(user?.isCreator || creatorProfile),
    permissions: Array.isArray(user?.permissions)
      ? user.permissions.map((entry) => sanitizePlainText(entry, 60)).filter(Boolean).slice(0, 10)
      : [],
  };

  return {
    auth,
    page: {
      currentRoute,
      currentPage,
      surface:
        currentFeature?.surface ||
        contextHints.surface ||
        (currentRoute ? "app" : "general"),
      currentFeatureKey: currentFeature?.featureKey || "",
      currentFeatureTitle: currentFeature?.pageName || "",
      currentFeatureSummary: currentFeature?.assistantExplanation || "",
      pageTitle: contextHints.pageTitle || currentPage,
      section: contextHints.section || "",
      selectedEntity: contextHints.selectedEntity || "",
    },
    preferences,
    memory: {
      recentSummary: sanitizePlainText(memory?.recentSummary || "", 400),
      lastTopic: sanitizePlainText(memory?.lastTopic || "", 160),
      lastMode: sanitizePlainText(memory?.lastMode || "", 40),
      lastRoute: sanitizePlainText(memory?.lastRoute || "", 160),
      lastFeatureKey: sanitizePlainText(memory?.lastFeatureKey || "", 80),
    },
    relevantFeatures: listRelevantFeatures({
      query: input.message || currentPage,
      currentRoute,
      user: {
        ...user,
        isCreator: Boolean(user?.isCreator || creatorProfile),
      },
      limit: 4,
    }).map((feature) => ({
      featureKey: feature.featureKey,
      pageName: feature.pageName,
      routePattern: feature.routePattern,
      assistantExplanation: feature.assistantExplanation,
      commonQuestions: feature.commonQuestions,
      safeNavigationSteps: feature.safeNavigationSteps,
      accessible: Boolean(feature.accessible),
      cautionNotes: feature.cautionNotes,
    })),
    safeProfileSummary: buildSafeProfileSummary(userRecord || user, creatorProfile),
    publicCreator,
  };
};

module.exports = {
  buildAkusoContext,
};
