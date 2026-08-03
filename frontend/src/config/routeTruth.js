import registry from "./routeTruthRegistry.json";

export const ROUTE_TRUTH_REGISTRY = registry;
export const ROUTE_ANALYTICS_CONTRACT = Object.freeze({
  ...(registry.routeAnalyticsContract || {}),
});
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

const expandFeatureAppPaths = (feature = {}) => {
  const appPaths = Array.isArray(feature.appPaths) ? feature.appPaths : [];
  const nestedRoots = appPaths
    .filter((appPath) => String(appPath || "").startsWith("/") && String(appPath).endsWith("/*"))
    .map((appPath) => String(appPath).slice(0, -2));

  return appPaths.flatMap((appPath) => {
    const normalized = normalizePath(appPath);
    if (normalized.startsWith("/")) {
      return [{ appPath, routePattern: normalized }];
    }

    return nestedRoots.map((root) => ({
      appPath,
      routePattern: normalizePath(`${root}/${normalized}`),
    }));
  });
};

const scoreRoutePattern = (routePattern = "") => {
  const segments = String(routePattern).split("/").filter(Boolean);
  const staticSegments = segments.filter(
    (segment) => segment !== "*" && !segment.startsWith(":")
  ).length;
  const dynamicSegments = segments.filter((segment) => segment.startsWith(":"))
    .length;
  const wildcardSegments = segments.filter((segment) => segment === "*").length;

  return (
    segments.length * 10000 +
    staticSegments * 100 +
    dynamicSegments * 10 -
    wildcardSegments * 1000
  );
};

const routeMatchers = registry.features
  .flatMap((feature) =>
    expandFeatureAppPaths(feature).map(({ appPath, routePattern }) => ({
      feature,
      appPath,
      routePattern,
      matcher: compileAppPath(routePattern),
      score: scoreRoutePattern(routePattern),
    }))
  )
  .filter((entry) => entry.matcher)
  .sort((left, right) => right.score - left.score);

const featureById = new Map(registry.features.map((feature) => [feature.id, feature]));

export const getFeatureTruthById = (featureId = "") =>
  featureById.get(String(featureId || "").trim()) || null;

export const getRouteTruthMatch = (path = "") => {
  const normalized = normalizePath(path);
  const match = routeMatchers.find((entry) => entry.matcher.test(normalized));
  if (!match) {
    return null;
  }

  return {
    feature: match.feature,
    appPath: match.appPath,
    routePattern: match.routePattern,
  };
};

export const getRouteTruth = (path = "") =>
  getRouteTruthMatch(path)?.feature || null;

export const buildRouteAnalyticsEvent = (path = "") => {
  const match = getRouteTruthMatch(path);
  if (!match || !ROUTE_ANALYTICS_CONTRACT.eventType) {
    return null;
  }

  return {
    contractVersion: ROUTE_ANALYTICS_CONTRACT.version,
    featureId: match.feature.id,
    routePattern: match.routePattern,
  };
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
