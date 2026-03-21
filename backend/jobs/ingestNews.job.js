const NewsAsset = require("../models/NewsAsset");
const NewsIngestionJob = require("../models/NewsIngestionJob");
const NewsPublisherContract = require("../models/NewsPublisherContract");
const NewsSource = require("../models/NewsSource");
const NewsStory = require("../models/NewsStory");
const { classifyNewsPayload } = require("../services/newsClassificationService");
const { inferGeography } = require("../services/newsGeoService");
const { buildSummary } = require("../services/newsSummaryService");
const { applyRightsToStoryPayload, normalizeRights } = require("../services/newsRightsService");
const {
  hashValue,
  normalizeHeadline,
  normalizeProviderStory,
} = require("../services/newsNormalizeService");
const reutersIngestService = require("../services/newsIngest/reutersIngestService");
const apIngestService = require("../services/newsIngest/apIngestService");
const guardianIngestService = require("../services/newsIngest/guardianIngestService");
const gdeltDiscoveryService = require("../services/newsIngest/gdeltDiscoveryService");
const partnerRssIngestService = require("../services/newsIngest/partnerRssIngestService");

const PROVIDER_MAP = {
  reuters: reutersIngestService,
  ap: apIngestService,
  guardian: guardianIngestService,
  gdelt: gdeltDiscoveryService,
  partner_rss: partnerRssIngestService,
};

const sanitizeRawPayload = (normalized = {}, source = {}) => ({
  externalId: normalized?.externalId || "",
  canonicalUrl: normalized?.canonicalUrl || "",
  publishedAt: normalized?.publishedAt || null,
  updatedAt: normalized?.updatedAt || null,
  authorByline: normalized?.authorByline || "",
  language: normalized?.language || "en",
  sourceSlug: normalized?.sourceSlug || source?.slug || "",
  tags: Array.isArray(normalized?.tags) ? normalized.tags : [],
  assetCount: Array.isArray(normalized?.assets) ? normalized.assets.length : 0,
  providerType: source?.providerType || "",
  licenseType: source?.licenseType || "",
});

const getActiveContract = async (sourceId) =>
  NewsPublisherContract.findOne({
    sourceId,
    status: "active",
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  })
    .sort({ expiresAt: 1, createdAt: -1 })
    .lean();

const normalizeAssets = (assets = []) =>
  (Array.isArray(assets) ? assets : []).map((asset) => ({
    externalId: asset?.externalId || asset?.id || "",
    assetType: asset?.assetType || asset?.type || "image",
    role: asset?.role || "thumbnail",
    url: asset?.url || asset?.secureUrl || asset?.src || "",
    secureUrl: asset?.secureUrl || asset?.url || asset?.src || "",
    width: Number(asset?.width || 0),
    height: Number(asset?.height || 0),
    mimeType: asset?.mimeType || asset?.contentType || "",
    altText: asset?.altText || asset?.alt || "",
    caption: asset?.caption || "",
    creditLine: asset?.creditLine || asset?.credit || "",
  }));

const upsertAssets = async ({ storyId, sourceId, sourceSlug, assets = [], rights = {} }) => {
  const assetRefs = [];
  for (const asset of assets) {
    const lookup = asset?.externalId
      ? { sourceId, externalId: asset.externalId }
      : { sourceId, url: asset.url };
    const doc = await NewsAsset.findOneAndUpdate(
      lookup,
      {
        $set: {
          storyId,
          sourceId,
          externalId: asset?.externalId || "",
          assetType: asset?.assetType || "image",
          role: asset?.role || "thumbnail",
          url: asset?.url || "",
          secureUrl: asset?.secureUrl || asset?.url || "",
          width: Number(asset?.width || 0),
          height: Number(asset?.height || 0),
          mimeType: asset?.mimeType || "",
          altText: asset?.altText || "",
          caption: asset?.caption || "",
          creditLine: asset?.creditLine || "",
          hash: hashValue(`${sourceSlug}:${asset?.url || asset?.secureUrl || ""}`),
          rights,
          moderation: {
            status: "approved",
            trustScore: 0.7,
            sourceTrustScore: 0.7,
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    assetRefs.push({ assetId: doc._id, role: doc.role || "thumbnail" });
  }
  return assetRefs;
};

const buildStoryUpdatePayload = ({ source, contract, providerStory }) => {
  const normalized = normalizeProviderStory(providerStory, { sourceSlug: source.slug });
  const classification = classifyNewsPayload(normalized);
  const geography = inferGeography(normalized);
  const rights = normalizeRights(normalized.rights || {}, { source, contract });
  const moderatedStatus =
    source?.publisherTier === "discovery" || source?.discoveryOnly
      ? "limited"
      : source?.moderation?.status === "limited"
        ? "limited"
        : "approved";

  return applyRightsToStoryPayload(
    {
      sourceId: source._id,
      publisherContractId: contract?._id || null,
      sourceSlug: normalized.sourceSlug || source.slug,
      externalId: normalized.externalId,
      sourceUrlKey:
        normalized.sourceUrlKey || hashValue(normalized.canonicalUrl || normalized.title),
      title: normalized.title,
      normalizedTitle: normalizeHeadline(normalized.title),
      subtitle: normalized.subtitle,
      bodyHtml: normalized.bodyHtml,
      summaryText: buildSummary(normalized),
      contentType: rights.mode === "FULL_IN_APP" ? "explainer" : "summary",
      canonicalUrl: normalized.canonicalUrl,
      publishedAt: normalized.publishedAt,
      updatedAtSource: normalized.updatedAt,
      authorByline: normalized.authorByline,
      language: normalized.language,
      country: geography?.primaryCountry || "",
      region: geography?.primaryState || "",
      city: geography?.primaryCity || "",
      articleType: classification.articleType,
      trustScore: Number(source?.trustScore || 0.7),
      isBreaking: classification.articleType === "breaking",
      isOpinion: classification.articleType === "opinion",
      topicTags: classification.topicTags,
      namedEntities: classification.namedEntities,
      geography,
      rights,
      moderation: {
        status: moderatedStatus,
        trustScore: Number(source?.trustScore || 0.7),
        sourceTrustScore: Number(source?.trustScore || 0.7),
        sensitiveFlags: classification.sensitiveFlags,
        misinformationRisk: classification.sensitiveFlags.includes("misinformation-risk")
          ? 0.55
          : 0,
      },
      isDiscoveryOnly: Boolean(source?.discoveryOnly || source?.publisherTier === "discovery"),
      ingestionKey: hashValue(`${source.slug}:${normalized.externalId}:${normalized.canonicalUrl}`),
      ingestedAt: new Date(),
      raw: sanitizeRawPayload(normalized, source),
    },
    { source, contract }
  );
};

const ingestSource = async ({
  source,
  limit = 20,
  fetchImpl = global.fetch,
  mockStories = null,
} = {}) => {
  const jobDoc = await NewsIngestionJob.create({
    sourceId: source?._id || null,
    sourceSlug: source?.slug || "",
    providerType: source?.providerType || "",
    licenseType: source?.licenseType || "",
    status: "running",
    startedAt: new Date(),
    metadata: {
      limit,
      sourceType: source?.sourceType || "",
      publisherTier: source?.publisherTier || "",
    },
  });

  try {
    const provider = PROVIDER_MAP[source?.providerType];
    if (!provider) {
      await NewsIngestionJob.updateOne(
        { _id: jobDoc._id },
        {
          $set: {
            status: "failed",
            completedAt: new Date(),
            errorMessage: `Unsupported provider type: ${source?.providerType || "unknown"}`,
          },
        }
      );
      return {
        sourceSlug: source?.slug || "",
        providerType: source?.providerType || "",
        ingested: 0,
        skipped: 0,
        stories: [],
        error: `Unsupported provider type: ${source?.providerType || "unknown"}`,
      };
    }

    const contract = await getActiveContract(source._id);
    const providerStories = await provider.fetchStories({
      source,
      limit,
      fetchImpl,
      mockStories,
    });

    const stories = [];
    let skipped = 0;
    for (const providerStory of providerStories) {
      if (!providerStory?.title || !providerStory?.canonicalUrl) {
        skipped += 1;
        continue;
      }

      const updatePayload = buildStoryUpdatePayload({ source, contract, providerStory });
      const storyDoc = await NewsStory.findOneAndUpdate(
        {
          sourceSlug: updatePayload.sourceSlug,
          externalId: updatePayload.externalId,
        },
        { $set: updatePayload },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const assetRefs = await upsertAssets({
        storyId: storyDoc._id,
        sourceId: source._id,
        sourceSlug: source.slug,
        assets: normalizeAssets(providerStory?.assets || []),
        rights: updatePayload.rights,
      });

      if (assetRefs.length) {
        storyDoc.assetRefs = assetRefs;
        await storyDoc.save();
      }

      stories.push(storyDoc);
    }

    await NewsSource.updateOne(
      { _id: source._id },
      {
        $set: {
          "ingest.lastIngestedAt": new Date(),
          "ingest.lastIngestStatus": "ok",
        },
      }
    );

    await NewsIngestionJob.updateOne(
      { _id: jobDoc._id },
      {
        $set: {
          status: "completed",
          completedAt: new Date(),
          ingestedCount: stories.length,
          skippedCount: skipped,
        },
      }
    );

    return {
      sourceSlug: source.slug,
      providerType: source.providerType,
      ingested: stories.length,
      skipped,
      stories,
    };
  } catch (error) {
    await NewsIngestionJob.updateOne(
      { _id: jobDoc._id },
      {
        $set: {
          status: "failed",
          completedAt: new Date(),
          errorMessage: error?.message || "Ingest failed",
        },
      }
    );
    throw error;
  }
};

const runIngestNewsJob = async ({
  sourceIds = [],
  providerTypes = [],
  limitPerSource = 20,
  fetchImpl = global.fetch,
  mockStoriesBySource = {},
} = {}) => {
  const query = {
    isActive: true,
    isBlocked: { $ne: true },
    "ingest.enabled": { $ne: false },
  };
  if (Array.isArray(sourceIds) && sourceIds.length) {
    query._id = { $in: sourceIds };
  }
  if (Array.isArray(providerTypes) && providerTypes.length) {
    query.providerType = { $in: providerTypes };
  }

  const sources = await NewsSource.find(query).lean(false);
  const results = [];
  for (const source of sources) {
    try {
      const result = await ingestSource({
        source,
        limit: limitPerSource,
        fetchImpl,
        mockStories: mockStoriesBySource?.[source.slug] || null,
      });
      results.push(result);
    } catch (error) {
      await NewsSource.updateOne(
        { _id: source._id },
        {
          $set: {
            "ingest.lastIngestedAt": new Date(),
            "ingest.lastIngestStatus": error?.message || "failed",
          },
        }
      );
      results.push({
        sourceSlug: source.slug,
        providerType: source.providerType,
        ingested: 0,
        skipped: 0,
        stories: [],
        error: error?.message || "Ingest failed",
      });
    }
  }

  return {
    sourceCount: sources.length,
    ingestedCount: results.reduce((sum, entry) => sum + Number(entry?.ingested || 0), 0),
    skippedCount: results.reduce((sum, entry) => sum + Number(entry?.skipped || 0), 0),
    results,
  };
};

module.exports = {
  ingestSource,
  runIngestNewsJob,
};
