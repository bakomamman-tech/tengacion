const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const { buildUserAffinityProfile } = require("../services/affinityService");
const { loadCreatorQualityProfiles } = require("../services/trustScoreService");
const {
  listHomeCandidates,
  listCreatorCandidates,
  listLiveCandidates,
  listCreatorHubCandidates,
} = require("../services/candidateService");
const { rankCandidates } = require("../services/rankingService");
const { decorateRankedItems } = require("../services/explanationService");
const { createRecommendationLog, trackDiscoveryEvents } = require("../services/discoveryEventService");

const parseLimit = (value, fallback = 12) =>
  Math.max(1, Math.min(50, Number.parseInt(value, 10) || fallback));

const collectCreatorIds = (candidates = []) =>
  Array.from(
    new Set(
      (Array.isArray(candidates) ? candidates : [])
        .map((candidate) => String(candidate?.creatorId || ""))
        .filter(Boolean)
    )
  );

const serveDiscoverySurface = async ({ req, res, surface, candidateLoader, loaderOptions = {} }) => {
  const limit = parseLimit(req.query?.limit, 12);
  const userId = req.user.id;

  const affinity = await buildUserAffinityProfile({ userId });
  const candidates = await candidateLoader({
    userId,
    limit,
    ...loaderOptions,
  });
  const creatorQualityMap = await loadCreatorQualityProfiles({
    creatorIds: collectCreatorIds(candidates),
  });
  const ranked = rankCandidates({
    surface,
    candidates,
    affinity,
    creatorQualityMap,
    limit,
  });
  const items = decorateRankedItems({ items: ranked });
  const requestId = await createRecommendationLog({
    userId,
    surface,
    candidates,
    rankedItems: items,
    affinity,
  });

  return res.json({
    requestId,
    surface,
    items,
    nextCursor: null,
  });
};

exports.getHomeDiscovery = asyncHandler(async (req, res) =>
  serveDiscoverySurface({
    req,
    res,
    surface: "home",
    candidateLoader: listHomeCandidates,
  })
);

exports.getCreatorDiscovery = asyncHandler(async (req, res) =>
  serveDiscoverySurface({
    req,
    res,
    surface: "creators",
    candidateLoader: listCreatorCandidates,
  })
);

exports.getLiveDiscovery = asyncHandler(async (req, res) =>
  serveDiscoverySurface({
    req,
    res,
    surface: "live",
    candidateLoader: listLiveCandidates,
  })
);

exports.getCreatorHubDiscovery = asyncHandler(async (req, res) => {
  const creatorId = String(req.query?.creatorId || "").trim();
  if (creatorId && !mongoose.Types.ObjectId.isValid(creatorId)) {
    return res.status(400).json({ error: "Invalid creatorId" });
  }

  return serveDiscoverySurface({
    req,
    res,
    surface: "creator_hub",
    candidateLoader: listCreatorHubCandidates,
    loaderOptions: { creatorId },
  });
});

exports.postDiscoveryEvents = asyncHandler(async (req, res) => {
  const requestId = String(req.body?.requestId || "").trim();
  const surface = String(req.body?.surface || "").trim().toLowerCase();
  const events = Array.isArray(req.body?.events) ? req.body.events : [];

  if (!surface) {
    return res.status(400).json({ error: "surface is required" });
  }
  if (!events.length) {
    return res.status(400).json({ error: "events must be a non-empty array" });
  }

  const result = await trackDiscoveryEvents({
    userId: req.user.id,
    requestId,
    surface,
    events,
  });

  return res.status(202).json({
    success: true,
    requestId,
    accepted: result.accepted,
  });
});
