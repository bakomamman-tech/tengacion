const fs = require("fs");
const path = require("path");

const ROUTE_TRUTH_PATH = path.resolve(
  __dirname,
  "../../frontend/src/config/routeTruthRegistry.json"
);

const ROUTE_TRUTH_REGISTRY = JSON.parse(fs.readFileSync(ROUTE_TRUTH_PATH, "utf8"));
const ROUTE_ANALYTICS_CONTRACT = Object.freeze({
  ...(ROUTE_TRUTH_REGISTRY.routeAnalyticsContract || {}),
});

const normalizePath = (value = "") => {
  const pathValue = String(value || "").trim().split(/[?#]/, 1)[0] || "/";
  if (!pathValue.startsWith("/")) {
    return pathValue;
  }
  return pathValue.length > 1 ? pathValue.replace(/\/+$/, "") : pathValue;
};

const escapePattern = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const compileRoutePattern = (routePattern = "") => {
  const normalized = normalizePath(routePattern);
  if (!normalized.startsWith("/")) {
    return null;
  }

  const source = normalized
    .split("/")
    .map((segment) => {
      if (!segment) return "";
      if (segment === "*") return ".*";
      if (segment.startsWith(":")) return "[^/]+";
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

const ROUTE_TRUTH_MATCHERS = (ROUTE_TRUTH_REGISTRY.features || [])
  .flatMap((feature) =>
    expandFeatureAppPaths(feature).map(({ appPath, routePattern }) => ({
      feature,
      appPath,
      routePattern,
      matcher: compileRoutePattern(routePattern),
      score: scoreRoutePattern(routePattern),
    }))
  )
  .filter((entry) => entry.matcher)
  .sort((left, right) => right.score - left.score);

const CONTRACT_ROUTE_MAP = new Map(
  ROUTE_TRUTH_MATCHERS.map((entry) => [
    `${entry.feature.id}\u0000${entry.routePattern}`,
    entry,
  ])
);

const findRouteTruthMatch = (route = "") => {
  const normalized = normalizePath(route);
  const match = ROUTE_TRUTH_MATCHERS.find((entry) => entry.matcher.test(normalized));
  if (!match) return null;

  return {
    feature: match.feature,
    appPath: match.appPath,
    routePattern: match.routePattern,
  };
};

const validateRouteViewPayload = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Route analytics payload must be an object." };
  }

  const allowedFields = new Set(ROUTE_ANALYTICS_CONTRACT.requiredClientFields || []);
  const unexpectedFields = Object.keys(body).filter((field) => !allowedFields.has(field));
  if (unexpectedFields.length > 0) {
    return { error: "Route analytics payload contains fields outside the contract." };
  }

  const missingFields = [...allowedFields].filter(
    (field) => body[field] === undefined || body[field] === null || body[field] === ""
  );
  if (missingFields.length > 0) {
    return { error: "Route analytics payload is missing required fields." };
  }

  if (body.contractVersion !== ROUTE_ANALYTICS_CONTRACT.version) {
    return { error: "Unsupported route analytics contract version." };
  }

  const featureId = String(body.featureId || "").trim();
  const routePattern = String(body.routePattern || "").trim();
  if (
    featureId.length > 80 ||
    routePattern.length > 200 ||
    !routePattern.startsWith("/") ||
    /[?#]/.test(routePattern)
  ) {
    return { error: "Invalid route analytics feature or route pattern." };
  }

  const match = CONTRACT_ROUTE_MAP.get(`${featureId}\u0000${normalizePath(routePattern)}`);
  if (!match) {
    return { error: "Route analytics feature and route pattern are not registered." };
  }

  return {
    event: {
      contractVersion: ROUTE_ANALYTICS_CONTRACT.version,
      featureId: match.feature.id,
      routePattern: match.routePattern,
    },
    feature: match.feature,
  };
};

module.exports = {
  ROUTE_ANALYTICS_CONTRACT,
  ROUTE_TRUTH_REGISTRY,
  findRouteTruthMatch,
  validateRouteViewPayload,
};
