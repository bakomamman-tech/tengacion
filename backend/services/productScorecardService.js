const AnalyticsEvent = require("../models/AnalyticsEvent");
const { buildDateRange } = require("./analyticsService");
const {
  ROUTE_ANALYTICS_CONTRACT,
  ROUTE_TRUTH_REGISTRY,
} = require("./routeTruthService");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const PRODUCT_SCORECARD_VERSION = 1;
const REQUIRED_BASELINE_WINDOW_DAYS = 30;

const number = (value) => Number(value || 0);
const roundRate = (value = 0) =>
  Number.isFinite(Number(value)) ? Number(Number(value).toFixed(4)) : 0;

const inclusiveUtcDays = (start, end) => {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;

  const startDay = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  );
  const endDay = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate()
  );
  return Math.max(0, Math.floor((endDay - startDay) / ONE_DAY_MS) + 1);
};

const countMap = (rows = [], keyField = "_id", countField = "views") =>
  new Map(
    rows.map((row) => [
      String(row?.[keyField] ?? "unknown"),
      number(row?.[countField]),
    ])
  );

const buildDistribution = ({ rows = [], registryValues = [], totalViews = 0 } = {}) => {
  const counts = countMap(rows);
  const values = new Set([
    ...registryValues.map((value) => String(value || "unknown")),
    ...counts.keys(),
  ]);

  return [...values]
    .map((key) => {
      const views = number(counts.get(key));
      return {
        key,
        views,
        share: totalViews > 0 ? roundRate(views / totalViews) : 0,
      };
    })
    .sort((left, right) => right.views - left.views || left.key.localeCompare(right.key));
};

const buildCaptureState = ({
  requestedWindowDays,
  observedWindowDays,
  totalViews,
  firstSeenAt,
  lastSeenAt,
} = {}) => {
  let status = "ready";
  let message = "The route telemetry window is ready for a production baseline capture.";

  if (totalViews <= 0) {
    status = "no_data";
    message = "No accepted route-view telemetry exists in the selected window.";
  } else if (requestedWindowDays < REQUIRED_BASELINE_WINDOW_DAYS) {
    status = "insufficient_selected_window";
    message = `Select at least ${REQUIRED_BASELINE_WINDOW_DAYS} calendar days for the baseline.`;
  } else if (observedWindowDays < REQUIRED_BASELINE_WINDOW_DAYS) {
    status = "insufficient_telemetry_window";
    message = `Production telemetry currently spans ${observedWindowDays} of ${REQUIRED_BASELINE_WINDOW_DAYS} required calendar days.`;
  }

  return {
    status,
    ready: status === "ready",
    message,
    requiredWindowDays: REQUIRED_BASELINE_WINDOW_DAYS,
    requestedWindowDays,
    observedWindowDays,
    remainingTelemetryDays: Math.max(
      0,
      REQUIRED_BASELINE_WINDOW_DAYS - observedWindowDays
    ),
    firstSeenAt: firstSeenAt || null,
    lastSeenAt: lastSeenAt || null,
  };
};

const buildProductScorecard = async ({ range, startDate, endDate } = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const match = {
    type: ROUTE_ANALYTICS_CONTRACT.eventType,
    createdAt: { $gte: dates.start, $lte: dates.end },
  };

  const [result = {}] = await AnalyticsEvent.aggregate([
    { $match: match },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              totalViews: { $sum: 1 },
              authenticatedViews: {
                $sum: { $cond: [{ $ne: ["$userId", null] }, 1, 0] },
              },
              anonymousViews: {
                $sum: { $cond: [{ $eq: ["$userId", null] }, 1, 0] },
              },
              firstSeenAt: { $min: "$createdAt" },
              lastSeenAt: { $max: "$createdAt" },
            },
          },
        ],
        uniqueAuthenticatedUsers: [
          { $match: { userId: { $ne: null } } },
          { $group: { _id: "$userId" } },
          { $count: "count" },
        ],
        byFeature: [
          {
            $group: {
              _id: "$metadata.featureId",
              views: { $sum: 1 },
              authenticatedViews: {
                $sum: { $cond: [{ $ne: ["$userId", null] }, 1, 0] },
              },
              anonymousViews: {
                $sum: { $cond: [{ $eq: ["$userId", null] }, 1, 0] },
              },
              firstSeenAt: { $min: "$createdAt" },
              lastSeenAt: { $max: "$createdAt" },
            },
          },
          { $sort: { views: -1, _id: 1 } },
        ],
        uniqueUsersByFeature: [
          { $match: { userId: { $ne: null } } },
          {
            $group: {
              _id: {
                featureId: "$metadata.featureId",
                userId: "$userId",
              },
            },
          },
          {
            $group: {
              _id: "$_id.featureId",
              count: { $sum: 1 },
            },
          },
        ],
        byRoute: [
          {
            $group: {
              _id: {
                featureId: "$metadata.featureId",
                routePattern: "$metadata.routePattern",
              },
              views: { $sum: 1 },
            },
          },
          { $sort: { views: -1, "_id.routePattern": 1 } },
        ],
        byLifecycle: [
          { $group: { _id: "$metadata.lifecycle", views: { $sum: 1 } } },
          { $sort: { views: -1, _id: 1 } },
        ],
        bySurface: [
          { $group: { _id: "$metadata.surface", views: { $sum: 1 } } },
          { $sort: { views: -1, _id: 1 } },
        ],
        byAccess: [
          { $group: { _id: "$metadata.access", views: { $sum: 1 } } },
          { $sort: { views: -1, _id: 1 } },
        ],
        byContractVersion: [
          { $group: { _id: "$metadata.contractVersion", views: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        daily: [
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              views: { $sum: 1 },
              authenticatedViews: {
                $sum: { $cond: [{ $ne: ["$userId", null] }, 1, 0] },
              },
              anonymousViews: {
                $sum: { $cond: [{ $eq: ["$userId", null] }, 1, 0] },
              },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  const rawSummary = result.summary?.[0] || {};
  const totalViews = number(rawSummary.totalViews);
  const uniqueAuthenticatedUsers = number(
    result.uniqueAuthenticatedUsers?.[0]?.count
  );
  const features = Array.isArray(ROUTE_TRUTH_REGISTRY.features)
    ? ROUTE_TRUTH_REGISTRY.features
    : [];
  const featureCounts = new Map(
    (result.byFeature || []).map((row) => [String(row?._id || ""), row])
  );
  const featureUserCounts = countMap(
    result.uniqueUsersByFeature || [],
    "_id",
    "count"
  );
  const routesByFeature = (result.byRoute || []).reduce((map, row) => {
    const featureId = String(row?._id?.featureId || "");
    if (!featureId) return map;
    const routes = map.get(featureId) || [];
    routes.push({
      routePattern: String(row?._id?.routePattern || ""),
      views: number(row?.views),
    });
    map.set(featureId, routes);
    return map;
  }, new Map());

  const featureRows = features
    .map((feature) => {
      const counts = featureCounts.get(feature.id) || {};
      const views = number(counts.views);
      return {
        featureId: feature.id,
        title: feature.title,
        lifecycle: feature.status,
        surface: feature.surface,
        access: feature.access,
        canonicalPath: feature.canonicalPath,
        ownerRole: feature.ownerRole,
        kpi: feature.kpi,
        views,
        share: totalViews > 0 ? roundRate(views / totalViews) : 0,
        authenticatedViews: number(counts.authenticatedViews),
        anonymousViews: number(counts.anonymousViews),
        uniqueAuthenticatedUsers: number(featureUserCounts.get(feature.id)),
        firstSeenAt: counts.firstSeenAt || null,
        lastSeenAt: counts.lastSeenAt || null,
        routes: routesByFeature.get(feature.id) || [],
      };
    })
    .sort(
      (left, right) =>
        right.views - left.views || left.title.localeCompare(right.title)
    );

  const viewedFeatureCount = featureRows.filter((feature) => feature.views > 0).length;
  const productionFeatures = featureRows.filter(
    (feature) => feature.lifecycle === "production"
  );
  const productionFeaturesViewed = productionFeatures.filter(
    (feature) => feature.views > 0
  ).length;
  const classifiedViews = featureRows.reduce(
    (sum, feature) => sum + feature.views,
    0
  );
  const requestedWindowDays = inclusiveUtcDays(dates.start, dates.end);
  const observedWindowDays = inclusiveUtcDays(
    rawSummary.firstSeenAt,
    rawSummary.lastSeenAt
  );

  return {
    contract: {
      scorecardVersion: PRODUCT_SCORECARD_VERSION,
      routeEventType: ROUTE_ANALYTICS_CONTRACT.eventType,
      routeContractVersion: ROUTE_ANALYTICS_CONTRACT.version,
      requiredBaselineWindowDays: REQUIRED_BASELINE_WINDOW_DAYS,
      privacyBoundary:
        "Only registry feature IDs and parameterized route patterns are aggregated; raw URLs, dynamic identifiers, query/hash state, titles and referrers are excluded.",
    },
    filters: {
      range: dates.range,
      startDate: dates.start,
      endDate: dates.end,
    },
    generatedAt: new Date(),
    capture: buildCaptureState({
      requestedWindowDays,
      observedWindowDays,
      totalViews,
      firstSeenAt: rawSummary.firstSeenAt,
      lastSeenAt: rawSummary.lastSeenAt,
    }),
    summary: {
      totalRouteViews: totalViews,
      authenticatedViews: number(rawSummary.authenticatedViews),
      anonymousViews: number(rawSummary.anonymousViews),
      authenticatedShare:
        totalViews > 0
          ? roundRate(number(rawSummary.authenticatedViews) / totalViews)
          : 0,
      uniqueAuthenticatedUsers,
      registryFeatureCount: featureRows.length,
      viewedFeatureCount,
      featureCoverageRate:
        featureRows.length > 0
          ? roundRate(viewedFeatureCount / featureRows.length)
          : 0,
      productionFeatureCount: productionFeatures.length,
      productionFeaturesViewed,
      productionFeatureCoverageRate:
        productionFeatures.length > 0
          ? roundRate(productionFeaturesViewed / productionFeatures.length)
          : 0,
      unclassifiedViews: Math.max(0, totalViews - classifiedViews),
    },
    distributions: {
      lifecycle: buildDistribution({
        rows: result.byLifecycle,
        registryValues: features.map((feature) => feature.status),
        totalViews,
      }),
      surface: buildDistribution({
        rows: result.bySurface,
        registryValues: features.map((feature) => feature.surface),
        totalViews,
      }),
      access: buildDistribution({
        rows: result.byAccess,
        registryValues: features.map((feature) => feature.access),
        totalViews,
      }),
      contractVersion: buildDistribution({
        rows: result.byContractVersion,
        registryValues: [ROUTE_ANALYTICS_CONTRACT.version],
        totalViews,
      }),
    },
    daily: (result.daily || []).map((row) => ({
      date: row._id,
      views: number(row.views),
      authenticatedViews: number(row.authenticatedViews),
      anonymousViews: number(row.anonymousViews),
    })),
    features: featureRows,
    zeroViewProductionFeatures: productionFeatures
      .filter((feature) => feature.views === 0)
      .map(({ featureId, title, surface, access, ownerRole, kpi }) => ({
        featureId,
        title,
        surface,
        access,
        ownerRole,
        kpi,
      })),
    measurementNotes: [
      "A route view measures a committed governed navigation, not task completion or KPI success.",
      "Unique users count authenticated accounts only; anonymous visitors are not assigned analytics identifiers.",
      "METRIC-002 remains incomplete until capture.ready is true for production telemetry and the exported baseline is reviewed.",
    ],
  };
};

module.exports = {
  PRODUCT_SCORECARD_VERSION,
  REQUIRED_BASELINE_WINDOW_DAYS,
  buildProductScorecard,
};
