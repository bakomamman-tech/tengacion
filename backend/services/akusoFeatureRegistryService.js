const {
  FEATURE_REGISTRY: LEGACY_FEATURES,
  getSurfaceQuickPrompts,
  resolveSurfaceFromPath,
} = require("./assistant/featureRegistry");
const { getHelpArticleByFeatureId, searchHelpArticles } = require("./assistant/helpDocs");
const { sanitizePlainText, sanitizeRoute } = require("./assistant/outputSanitizer");

const normalize = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const ROLE_LABELS = {
  authenticated: ["authenticated"],
  creator: ["creator", "admin"],
  admin: ["admin"],
};

const buildCautionNotes = (feature = {}) => {
  if (feature.access === "creator") {
    return ["Requires an authenticated creator account or admin access."];
  }
  if (feature.access === "admin") {
    return ["Restricted to trusted staff with admin permissions."];
  }
  return ["Requires login before Akuso can open or inspect this screen."];
};

const buildNavigationSteps = (feature = {}) => {
  const article = getHelpArticleByFeatureId(feature.id);
  if (article?.steps?.length) {
    return article.steps.map((step) => sanitizePlainText(step, 180)).filter(Boolean);
  }

  return [
    `Open ${sanitizePlainText(feature.title || "the page", 80)} from Tengacion navigation.`,
    sanitizePlainText(feature.safeDescription || feature.description || "", 180),
    "Use the built-in page controls to complete the action yourself.",
  ].filter(Boolean);
};

const toAkusoFeature = (feature = {}) => ({
  featureKey: sanitizePlainText(feature.id || "", 80),
  routePattern: sanitizeRoute(feature.route || ""),
  pageName: sanitizePlainText(feature.title || "", 120),
  surface: sanitizePlainText(feature.surface || "general", 60) || "general",
  purpose: sanitizePlainText(feature.description || "", 220),
  allowedRoles: ROLE_LABELS[feature.access] || ["authenticated"],
  userFacingActions: Array.isArray(feature.allowedActions)
    ? feature.allowedActions.map((entry) => sanitizePlainText(entry, 80)).filter(Boolean)
    : [],
  assistantExplanation: sanitizePlainText(
    feature.safeDescription || feature.description || "",
    220
  ),
  commonQuestions: Array.isArray(feature.quickPrompts)
    ? feature.quickPrompts.map((entry) => sanitizePlainText(entry, 120)).filter(Boolean)
    : [],
  safeNavigationSteps: buildNavigationSteps(feature),
  availabilityStatus: "implemented",
  cautionNotes: buildCautionNotes(feature),
  aliases: Array.isArray(feature.aliases)
    ? feature.aliases.map((entry) => normalize(entry)).filter(Boolean)
    : [],
  access: sanitizePlainText(feature.access || "authenticated", 20) || "authenticated",
});

const AKUSO_FEATURE_REGISTRY = LEGACY_FEATURES.map(toAkusoFeature);

const scoreFeature = (feature = {}, query = "") => {
  const needle = normalize(query);
  if (!needle) {
    return 0;
  }

  let score = 0;
  if (normalize(feature.pageName) === needle) score += 80;
  if (normalize(feature.pageName).includes(needle)) score += 24;
  if (normalize(feature.purpose).includes(needle)) score += 12;
  if (normalize(feature.assistantExplanation).includes(needle)) score += 10;

  for (const alias of feature.aliases || []) {
    if (!alias) continue;
    if (alias === needle) {
      score += 72;
    } else if (alias.includes(needle) || needle.includes(alias)) {
      score += 36;
    }
  }

  for (const question of feature.commonQuestions || []) {
    if (normalize(question).includes(needle)) {
      score += 8;
    }
  }

  return score;
};

const getUserAccess = (user = {}) => {
  if (user?.isAdmin || ["admin", "super_admin", "moderator", "trust_safety_admin"].includes(normalize(user?.role))) {
    return "admin";
  }
  if (user?.isCreator) {
    return "creator";
  }
  if (user?.id || user?.userId || user?._id) {
    return "authenticated";
  }
  return "public";
};

const canUserAccessFeature = (feature = {}, user = {}) => {
  const access = getUserAccess(user);
  if (feature.access === "admin") {
    return access === "admin";
  }
  if (feature.access === "creator") {
    return access === "creator" || access === "admin";
  }
  return access !== "public";
};

const findFeatureByRoute = (route = "") => {
  const needle = sanitizeRoute(route);
  if (!needle) {
    return null;
  }

  return (
    AKUSO_FEATURE_REGISTRY.find((feature) => {
      const legacy = LEGACY_FEATURES.find((entry) => entry.id === feature.featureKey);
      return Array.isArray(legacy?.pathPatterns)
        ? legacy.pathPatterns.some((pattern) => pattern.test(needle))
        : false;
    }) || null
  );
};

const findFeatureByIntent = (query = "") => {
  const scored = AKUSO_FEATURE_REGISTRY.map((feature) => ({
    feature,
    score: scoreFeature(feature, query),
  }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.feature || null;
};

const listRelevantFeatures = ({ query = "", currentRoute = "", user = {}, limit = 4 } = {}) => {
  const currentFeature = findFeatureByRoute(currentRoute);
  const matches = AKUSO_FEATURE_REGISTRY.map((feature) => ({
    feature,
    score: scoreFeature(feature, query),
  }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ feature }) => feature);

  const combined = [
    ...(currentFeature ? [currentFeature] : []),
    ...matches,
    ...AKUSO_FEATURE_REGISTRY.filter((feature) => {
      const surface = resolveSurfaceFromPath(currentRoute);
      return feature.surface === surface;
    }),
  ];

  const seen = new Set();
  return combined
    .filter((feature) => {
      if (!feature?.featureKey || seen.has(feature.featureKey)) {
        return false;
      }
      seen.add(feature.featureKey);
      return true;
    })
    .slice(0, Math.max(1, Number(limit) || 4))
    .map((feature) => ({
      ...feature,
      accessible: canUserAccessFeature(feature, user),
    }));
};

const getAkusoHints = ({ query = "", currentRoute = "", user = {}, limit = 6 } = {}) => {
  const access = getUserAccess(user);
  const prompts = getSurfaceQuickPrompts({
    surface: resolveSurfaceFromPath(currentRoute),
    access: access === "public" ? "authenticated" : access,
  });
  const featureMatch = findFeatureByIntent(query) || findFeatureByRoute(currentRoute);
  const helpArticles = searchHelpArticles(query || featureMatch?.pageName || "", { limit: 3 });

  const hints = [
    ...(featureMatch?.commonQuestions || []),
    ...prompts,
    ...helpArticles.map((article) => article.title),
  ];

  return [...new Set(hints.map((entry) => sanitizePlainText(entry, 120)).filter(Boolean))].slice(
    0,
    Math.max(1, Number(limit) || 6)
  );
};

module.exports = {
  AKUSO_FEATURE_REGISTRY,
  canUserAccessFeature,
  findFeatureByIntent,
  findFeatureByRoute,
  getAkusoHints,
  getUserAccess,
  listRelevantFeatures,
};
