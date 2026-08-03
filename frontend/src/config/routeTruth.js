import registry from "./routeTruthRegistry.json";

export const ROUTE_TRUTH_REGISTRY = registry;
export const ROUTE_LIFECYCLE = Object.freeze({
  PRODUCTION: "production",
  BETA: "beta",
  PREVIEW: "preview",
  EXPERIMENTAL: "experimental",
  INTERNAL: "internal",
  ALIAS: "alias",
});

const NAVIGATION_STATUSES = new Set([
  ROUTE_LIFECYCLE.PRODUCTION,
  ROUTE_LIFECYCLE.BETA,
  ROUTE_LIFECYCLE.EXPERIMENTAL,
]);

const normalizePath = (value = "") => {
  const path = String(value || "").trim().split(/[?#]/, 1)[0] || "/";
  if (!path.startsWith("/")) {
    return path;
  }
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
};

const escapePattern = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const compileAppPath = (appPath = "") => {
  const normalized = normalizePath(appPath);
  if (!normalized.startsWith("/")) {
    return null;
  }

  const source = normalized
    .split("/")
    .map((segment) => {
      if (!segment) {
        return "";
      }
      if (segment === "*") {
        return ".*";
      }
      if (segment.startsWith(":")) {
        return "[^/]+";
      }
      return escapePattern(segment);
    })
    .join("/");

  return new RegExp(`^${source}/?$`, "i");
};

const routeMatchers = registry.features
  .flatMap((feature) =>
    (feature.appPaths || []).map((appPath) => ({
      feature,
      appPath,
      matcher: compileAppPath(appPath),
      score:
        String(appPath).split("/").filter(Boolean).length * 100 +
        String(appPath).replace(/:[^/]+|\*/g, "").length,
    }))
  )
  .filter((entry) => entry.matcher)
  .sort((left, right) => right.score - left.score);

const featureById = new Map(registry.features.map((feature) => [feature.id, feature]));

export const getFeatureTruthById = (featureId = "") =>
  featureById.get(String(featureId || "").trim()) || null;

export const getRouteTruth = (path = "") => {
  const normalized = normalizePath(path);
  return routeMatchers.find((entry) => entry.matcher.test(normalized))?.feature || null;
};

export const getLifecycleLabel = (status = "") => {
  if (status === ROUTE_LIFECYCLE.BETA) {
    return "Beta";
  }
  if (status === ROUTE_LIFECYCLE.EXPERIMENTAL) {
    return "Experimental";
  }
  if (status === ROUTE_LIFECYCLE.PREVIEW) {
    return "Preview";
  }
  if (status === ROUTE_LIFECYCLE.INTERNAL) {
    return "Internal";
  }
  return "";
};

export const isLifecycleNavigable = (feature) =>
  Boolean(feature && NAVIGATION_STATUSES.has(feature.status));

export const decorateNavigationItem = (item = {}) => {
  const truth = getRouteTruth(item.path || item.route || "");
  if (!truth || !isLifecycleNavigable(truth)) {
    return null;
  }

  return {
    ...item,
    lifecycleStatus: truth.status,
    lifecycleLabel: getLifecycleLabel(truth.status),
    lifecycleFeatureId: truth.id,
  };
};

export const decorateNavigationItems = (items = []) =>
  (Array.isArray(items) ? items : []).map(decorateNavigationItem).filter(Boolean);

export default registry;
