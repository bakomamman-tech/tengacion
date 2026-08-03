const asyncHandler = require("../middleware/asyncHandler");
const { logAnalyticsEvent } = require("../services/analyticsService");
const {
  ROUTE_ANALYTICS_CONTRACT,
  validateRouteViewPayload,
} = require("../services/routeTruthService");

const recordRouteView = asyncHandler(async (req, res) => {
  const validation = validateRouteViewPayload(req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const { event, feature } = validation;
  const storedEvent = await logAnalyticsEvent({
    type: ROUTE_ANALYTICS_CONTRACT.eventType,
    userId: req.userId || req.user?.id || null,
    actorRole: req.userId || req.user?.id ? "authenticated" : "anonymous",
    targetId: feature.id,
    targetType: "route_feature",
    contentType: feature.surface,
    metadata: {
      eventType: ROUTE_ANALYTICS_CONTRACT.eventType,
      contractVersion: event.contractVersion,
      featureId: feature.id,
      routePattern: event.routePattern,
      canonicalPath: feature.canonicalPath,
      lifecycle: feature.status,
      surface: feature.surface,
      access: feature.access,
    },
  });

  if (!storedEvent) {
    return res.status(503).json({ error: "Route analytics could not be recorded." });
  }

  return res.status(202).json({
    accepted: true,
    eventType: ROUTE_ANALYTICS_CONTRACT.eventType,
    contractVersion: ROUTE_ANALYTICS_CONTRACT.version,
  });
});

module.exports = { recordRouteView };
