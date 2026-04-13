const User = require("../../models/User");
const { getCreatorProfile } = require("./tools/shared");
const {
  findFeatureByRoute,
  getSurfaceFeatureSummary,
  getSurfaceQuickPrompts,
  resolveSurfaceFromPath,
} = require("./featureRegistry");
const { sanitizeAssistantPreferences, sanitizePlainText } = require("./outputSanitizer");

const buildAssistantContext = async ({
  user = null,
  context = {},
  preferences = {},
  memory = {},
  modeHint = "",
  pendingAction = null,
} = {}) => {
  const currentPath = sanitizePlainText(context?.currentPath || "", 160);
  const currentSearch = sanitizePlainText(context?.currentSearch || "", 160);
  const pageTitle = sanitizePlainText(context?.pageTitle || "", 120);
  const selectedChatId = sanitizePlainText(context?.selectedChatId || "", 80);
  const selectedContentId = sanitizePlainText(context?.selectedContentId || "", 80);
  const currentSurface = resolveSurfaceFromPath(currentPath);
  const feature = findFeatureByRoute(currentPath);
  const userRole = sanitizePlainText(user?.role || "user", 40).toLowerCase() || "user";
  const [userRecord, creatorProfile] = await Promise.all([
    user?.id ? User.findById(user.id).select("name username role").lean() : Promise.resolve(null),
    user?.id ? getCreatorProfile(user.id) : Promise.resolve(null),
  ]);

  return {
    userId: user?.id || "",
    userRole,
    isAuthenticated: Boolean(user?.id),
    isAdmin: userRole === "admin" || userRole === "super_admin",
    isCreator: Boolean(creatorProfile),
    userName: sanitizePlainText(userRecord?.name || "", 120),
    username: sanitizePlainText(userRecord?.username || "", 80),
    creatorProfileId: sanitizePlainText(creatorProfile?._id || "", 80),
    creatorTypes: Array.isArray(creatorProfile?.creatorTypes)
      ? creatorProfile.creatorTypes.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [],
    creatorOnboardingComplete: Boolean(creatorProfile?.onboardingComplete || creatorProfile?.onboardingCompleted),
    currentPath,
    currentSearch,
    pageTitle,
    selectedChatId,
    selectedContentId,
    currentSurface,
    currentFeatureId: feature?.id || "",
    currentFeatureTitle: feature?.title || "",
    currentFeatureDescription: feature?.safeDescription || feature?.description || "",
    currentFeatureAllowedActions: feature?.allowedActions || [],
    recommendedFeatures: getSurfaceFeatureSummary({
      surface: currentSurface,
      access: userRole === "admin" ? "admin" : creatorProfile ? "creator" : "authenticated",
    }),
    quickPrompts: getSurfaceQuickPrompts({
      surface: currentSurface,
      access: userRole === "admin" ? "admin" : creatorProfile ? "creator" : "authenticated",
    }),
    preferences: sanitizeAssistantPreferences(preferences),
    memory: memory && typeof memory === "object" ? memory : {},
    modeHint: sanitizePlainText(modeHint || "", 40),
    pendingAction:
      pendingAction && typeof pendingAction === "object"
        ? {
            type: sanitizePlainText(pendingAction?.type || "", 40),
            label: sanitizePlainText(pendingAction?.label || "", 80),
            description: sanitizePlainText(pendingAction?.description || "", 200),
            route: sanitizePlainText(pendingAction?.route || "", 160),
          }
        : null,
  };
};

module.exports = {
  buildAssistantContext,
};
