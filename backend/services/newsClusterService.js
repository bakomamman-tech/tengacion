const mongoose = require("mongoose");
const NewsCluster = require("../models/NewsCluster");
const NewsStory = require("../models/NewsStory");
const { buildDuplicateGroups } = require("./newsDedupService");
const { buildClusterSummary } = require("./newsSummaryService");
const { getMostRestrictiveMode } = require("./newsRightsService");
const { scoreCluster } = require("./newsRankingService");
const { hashValue, normalizeHeadline, normalizeSlug } = require("./newsNormalizeService");

const uniq = (values = []) =>
  [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
    ),
  ];

const combineGeography = (stories = []) => {
  const list = Array.isArray(stories) ? stories.filter(Boolean) : [];
  const representative = list[0] || {};

  return {
    scope: representative?.geography?.scope || "unknown",
    countries: uniq(list.flatMap((entry) => entry?.geography?.countries || [])),
    states: uniq(list.flatMap((entry) => entry?.geography?.states || [])),
    cities: uniq(list.flatMap((entry) => entry?.geography?.cities || [])),
    primaryCountry: representative?.geography?.primaryCountry || "",
    primaryState: representative?.geography?.primaryState || "",
    primaryCity: representative?.geography?.primaryCity || "",
    relevanceScore: Number(representative?.geography?.relevanceScore || 0),
  };
};

const deriveClusterModeration = (stories = []) => {
  const statuses = uniq(stories.map((entry) => entry?.moderation?.status || ""));
  const sensitiveFlags = uniq(stories.flatMap((entry) => entry?.moderation?.sensitiveFlags || []));
  const sourceTrustScore =
    stories.reduce((sum, entry) => sum + Number(entry?.moderation?.sourceTrustScore || 0.6), 0) /
      Math.max(1, stories.length) || 0.6;
  const trustScore =
    stories.reduce((sum, entry) => sum + Number(entry?.moderation?.trustScore || 0.6), 0) /
      Math.max(1, stories.length) || 0.6;

  let status = "approved";
  if (!statuses.length) {
    status = "pending";
  } else if (statuses.every((entry) => entry === "blocked")) {
    status = "blocked";
  } else if (statuses.includes("limited")) {
    status = "limited";
  } else if (statuses.includes("pending")) {
    status = "pending";
  }

  return {
    status,
    reason: "",
    trustScore,
    sourceTrustScore,
    sensitiveFlags,
    misinformationRisk: Math.max(
      ...stories.map((entry) => Number(entry?.moderation?.misinformationRisk || 0))
    ),
    reviewedAt: null,
    reviewedBy: null,
    notes: "",
  };
};

const deriveClusterRights = (stories = []) => {
  const list = Array.isArray(stories) ? stories.filter(Boolean) : [];
  const restrictiveMode = getMostRestrictiveMode(list.map((entry) => entry?.rights?.mode));
  const expiries = list
    .map((entry) => entry?.rights?.expiresAt)
    .filter(Boolean)
    .map((entry) => new Date(entry));
  const earliestExpiry = expiries.length
    ? expiries.sort((left, right) => left.getTime() - right.getTime())[0]
    : null;

  return {
    mode: restrictiveMode,
    attributionRequired: list.some((entry) => entry?.rights?.attributionRequired !== false),
    canonicalLinkRequired: list.some((entry) => entry?.rights?.canonicalLinkRequired !== false),
    allowBodyHtml:
      restrictiveMode === "FULL_IN_APP" &&
      list.every((entry) => entry?.rights?.allowBodyHtml !== false),
    allowSummary: list.some((entry) => entry?.rights?.allowSummary !== false),
    allowThumbnail: list.some((entry) => entry?.rights?.allowThumbnail !== false),
    allowEmbed: list.some((entry) => entry?.rights?.allowEmbed === true),
    expiresAt: earliestExpiry,
    isExpired: Boolean(earliestExpiry && earliestExpiry.getTime() <= Date.now()),
    contractVersion: uniq(list.map((entry) => entry?.rights?.contractVersion || ""))[0] || "",
    notes: "",
  };
};

const chooseRepresentativeStory = (stories = []) =>
  [...(Array.isArray(stories) ? stories : [])]
    .filter(Boolean)
    .sort((left, right) => {
      const scoreDelta =
        Number(right?.scoring?.finalScore || 0) - Number(left?.scoring?.finalScore || 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return (
        new Date(right?.publishedAt || 0).getTime() -
        new Date(left?.publishedAt || 0).getTime()
      );
    })[0] || null;

const createClusteringKey = (stories = []) => {
  const representative = chooseRepresentativeStory(stories);
  return hashValue(
    `${normalizeHeadline(representative?.title || "")}:${uniq(
      stories.map((entry) => entry?.sourceSlug || "")
    ).join(",")}`
  );
};

const buildClusterDocumentPayload = (stories = []) => {
  const list = [...(Array.isArray(stories) ? stories : [])]
    .filter(Boolean)
    .sort(
      (left, right) =>
        new Date(right?.publishedAt || 0).getTime() - new Date(left?.publishedAt || 0).getTime()
    );
  const representative = chooseRepresentativeStory(list);
  const sourceSlugs = uniq(list.map((entry) => normalizeSlug(entry?.sourceSlug || "")));
  const topicTags = uniq(list.flatMap((entry) => entry?.topicTags || [])).map((entry) =>
    normalizeSlug(entry)
  );
  const rights = deriveClusterRights(list);
  const moderation = deriveClusterModeration(list);
  const draft = {
    representativeStoryId: representative?._id,
    storyIds: list.map((entry) => entry._id),
    title: representative?.title || "Untitled coverage",
    summary: buildClusterSummary(list),
    topicTags: topicTags.filter(Boolean).slice(0, 10),
    geography: combineGeography(list),
    articleType: representative?.articleType || "report",
    storyCount: list.length || 1,
    sourceCount: sourceSlugs.length || 1,
    sourceSlugs,
    importanceScore: Math.max(...list.map((entry) => Number(entry?.scoring?.importanceScore || 0))),
    freshnessScore: Math.max(...list.map((entry) => Number(entry?.scoring?.freshnessScore || 0))),
    coverageDiversityScore:
      sourceSlugs.length <= 1 ? 0.12 : Math.min(1, sourceSlugs.length / Math.max(2, list.length)),
    rights,
    moderation,
    lastPublishedAt: representative?.publishedAt || new Date(),
    clusteringKey: createClusteringKey(list),
  };

  draft.scoring = scoreCluster(draft, list, {
    source: representative?.sourceId || null,
  });

  return draft;
};

const clusterStories = (stories = [], options = {}) =>
  buildDuplicateGroups(stories, options).map((group) => buildClusterDocumentPayload(group));

const findExistingClusterId = (stories = []) => {
  const ids = uniq(
    stories
      .map((entry) => {
        if (!entry?.clusterId) {
          return "";
        }
        if (entry.clusterId instanceof mongoose.Types.ObjectId) {
          return entry.clusterId.toString();
        }
        if (entry.clusterId?._id) {
          return String(entry.clusterId._id);
        }
        return String(entry.clusterId);
      })
      .filter(Boolean)
  );
  return ids[0] || "";
};

const rebuildClusters = async ({ storyIds = [], since = null, limit = 300 } = {}) => {
  const query = {
    "moderation.status": { $in: ["approved", "limited", "pending"] },
  };
  if (Array.isArray(storyIds) && storyIds.length) {
    query._id = { $in: storyIds.map((entry) => new mongoose.Types.ObjectId(entry)) };
  } else if (since) {
    query.publishedAt = { $gte: new Date(since) };
  }

  const stories = await NewsStory.find(query)
    .sort({ publishedAt: -1 })
    .limit(Math.max(1, Number(limit) || 300))
    .populate("sourceId")
    .lean(false);

  const groups = buildDuplicateGroups(stories, {
    similarityThreshold: 0.7,
    entityThreshold: 0.4,
    maxDeltaMs: 8 * 60 * 60 * 1000,
  });

  const clusters = [];
  for (const group of groups) {
    if (!group.length) {
      continue;
    }

    const payload = buildClusterDocumentPayload(group);
    const existingId = findExistingClusterId(group);

    let clusterDoc;
    if (existingId) {
      clusterDoc = await NewsCluster.findByIdAndUpdate(existingId, payload, {
        new: true,
      });
    }
    if (!clusterDoc) {
      clusterDoc = await NewsCluster.create(payload);
    }

    await NewsStory.updateMany(
      { _id: { $in: group.map((entry) => entry._id) } },
      { $set: { clusterId: clusterDoc._id } }
    );

    clusters.push(clusterDoc);
  }

  return {
    storyCount: stories.length,
    clusterCount: clusters.length,
    clusters,
  };
};

module.exports = {
  chooseRepresentativeStory,
  buildClusterDocumentPayload,
  clusterStories,
  rebuildClusters,
};
