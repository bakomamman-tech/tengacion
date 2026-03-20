const mongoose = require("mongoose");
const NewsCluster = require("../models/NewsCluster");
const NewsPublisherContract = require("../models/NewsPublisherContract");
const NewsSource = require("../models/NewsSource");
const NewsStory = require("../models/NewsStory");
const asyncHandler = require("../middleware/asyncHandler");
const { runClusterNewsJob } = require("../jobs/clusterNews.job");
const { runExpireNewsRightsJob } = require("../jobs/expireNewsRights.job");
const { runIngestNewsJob } = require("../jobs/ingestNews.job");
const { runScoreNewsJob } = require("../jobs/scoreNews.job");
const { applyModerationToStory } = require("../services/newsModerationService");
const { normalizeMode } = require("../services/newsRightsService");
const { normalizeSlug } = require("../services/newsNormalizeService");

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

const createSource = asyncHandler(async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const slug = normalizeSlug(payload.slug || payload.displayName || "");

  if (!slug || !payload.displayName || !payload.providerType) {
    return res.status(400).json({ error: "slug/displayName/providerType are required" });
  }

  const source = await NewsSource.create({
    slug,
    displayName: String(payload.displayName || "").trim(),
    publisherName: String(payload.publisherName || payload.displayName || "").trim(),
    providerType: String(payload.providerType || "").trim(),
    publisherTier: String(payload.publisherTier || "discovery").trim(),
    sourceType: String(payload.sourceType || "publisher").trim(),
    homepageUrl: String(payload.homepageUrl || "").trim(),
    canonicalDomain: String(payload.canonicalDomain || "").trim().toLowerCase(),
    logoUrl: String(payload.logoUrl || "").trim(),
    defaultLanguage: String(payload.defaultLanguage || "en").trim().toLowerCase(),
    countries: Array.isArray(payload.countries) ? payload.countries : [],
    states: Array.isArray(payload.states) ? payload.states : [],
    topicTags: Array.isArray(payload.topicTags) ? payload.topicTags.map(normalizeSlug) : [],
    discoveryOnly: Boolean(payload.discoveryOnly),
    isActive: payload.isActive !== false,
    trustScore: Number(payload.trustScore || 0.7),
    attribution:
      payload.attribution && typeof payload.attribution === "object" ? payload.attribution : {},
    ingest: payload.ingest && typeof payload.ingest === "object" ? payload.ingest : {},
    moderation:
      payload.moderation && typeof payload.moderation === "object"
        ? payload.moderation
        : { status: "approved", trustScore: Number(payload.trustScore || 0.7) },
  });

  return res.status(201).json(source);
});

const updateSource = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ error: "Invalid source id" });
  }

  const payload = req.body && typeof req.body === "object" ? req.body : {};
  if (payload.slug) {
    payload.slug = normalizeSlug(payload.slug);
  }
  if (Array.isArray(payload.topicTags)) {
    payload.topicTags = payload.topicTags.map(normalizeSlug);
  }

  const source = await NewsSource.findByIdAndUpdate(req.params.id, payload, {
    new: true,
  });
  if (!source) {
    return res.status(404).json({ error: "Source not found" });
  }

  return res.json(source);
});

const createContract = asyncHandler(async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  if (!isValidId(payload.sourceId)) {
    return res.status(400).json({ error: "Valid sourceId is required" });
  }
  if (!payload.contractName) {
    return res.status(400).json({ error: "contractName is required" });
  }

  const contract = await NewsPublisherContract.create({
    sourceId: payload.sourceId,
    contractName: String(payload.contractName || "").trim(),
    contractVersion: String(payload.contractVersion || "v1").trim(),
    publisherTier: String(payload.publisherTier || "discovery").trim(),
    status: String(payload.status || "active").trim(),
    rightsModeDefault: normalizeMode(payload.rightsModeDefault || "SUMMARY_PLUS_LINKOUT"),
    rights: payload.rights && typeof payload.rights === "object" ? payload.rights : {},
    attribution:
      payload.attribution && typeof payload.attribution === "object" ? payload.attribution : {},
    allowedCountries: Array.isArray(payload.allowedCountries) ? payload.allowedCountries : [],
    allowedStates: Array.isArray(payload.allowedStates) ? payload.allowedStates : [],
    startAt: payload.startAt ? new Date(payload.startAt) : new Date(),
    expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
    signedBy: String(payload.signedBy || "").trim(),
    notes: String(payload.notes || "").trim(),
  });

  return res.status(201).json(contract);
});

const reingest = asyncHandler(async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const result = await runIngestNewsJob({
    sourceIds: Array.isArray(payload.sourceIds) ? payload.sourceIds : [],
    providerTypes: Array.isArray(payload.providerTypes) ? payload.providerTypes : [],
    limitPerSource: Number(payload.limitPerSource || 20),
    mockStoriesBySource:
      payload.mockStoriesBySource && typeof payload.mockStoriesBySource === "object"
        ? payload.mockStoriesBySource
        : {},
  });

  await runExpireNewsRightsJob();

  return res.json({ success: true, ...result });
});

const recluster = asyncHandler(async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const result = await runClusterNewsJob({
    storyIds: Array.isArray(payload.storyIds) ? payload.storyIds : [],
    since: payload.since || null,
    limit: Number(payload.limit || 300),
  });
  await runScoreNewsJob({ limit: Number(payload.limit || 400) });
  return res.json({ success: true, ...result });
});

const moderateStory = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.storyId)) {
    return res.status(400).json({ error: "Invalid story id" });
  }

  const story = await NewsStory.findById(req.params.storyId);
  if (!story) {
    return res.status(404).json({ error: "Story not found" });
  }

  applyModerationToStory(story, req.body || {}, req.user.id);
  await story.save();

  if (story.clusterId) {
    const cluster = await NewsCluster.findById(story.clusterId).lean();
    await runClusterNewsJob({
      storyIds: Array.isArray(cluster?.storyIds) ? cluster.storyIds : [story._id],
      limit: Math.max(20, Number(cluster?.storyIds?.length || 20)),
    });
  } else {
    await runClusterNewsJob({ storyIds: [story._id], limit: 20 });
  }
  await runScoreNewsJob({ limit: 400 });

  return res.json({ success: true, story });
});

module.exports = {
  createSource,
  updateSource,
  createContract,
  reingest,
  recluster,
  moderateStory,
};
