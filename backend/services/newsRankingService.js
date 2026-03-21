const { computeLocalRelevanceScore } = require("./newsGeoService");
const { normalizeSlug, normalizeWhitespace } = require("./newsNormalizeService");

const PUBLIC_INTEREST_TOPICS = new Set([
  "politics",
  "economy",
  "education",
  "health",
  "weather",
  "climate",
  "safety",
  "security",
  "transport",
  "business",
]);

const ARTICLE_TYPE_IMPORTANCE = {
  breaking: 0.94,
  analysis: 0.68,
  opinion: 0.34,
  explainer: 0.64,
  report: 0.7,
};

const clamp01 = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  if (num <= 0) {
    return 0;
  }
  if (num >= 1) {
    return 1;
  }
  return num;
};

const uniqueNormalized = (values = []) =>
  [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((entry) => normalizeSlug(entry))
        .filter(Boolean)
    ),
  ];

const toTopicSet = (preferences = {}, user = {}) =>
  new Set(
    [
      ...(Array.isArray(preferences?.preferredTopics) ? preferences.preferredTopics : []),
      ...(Array.isArray(preferences?.followedTopicSlugs) ? preferences.followedTopicSlugs : []),
      ...(Array.isArray(user?.interests) ? user.interests : []),
    ]
      .map((entry) => normalizeSlug(entry))
      .filter(Boolean)
  );

const getStoryId = (story = {}) =>
  String(story?._id || story?.id || story?.storyId || "").trim();

const getHoursOld = (publishedAt) => {
  const publishedMs = new Date(publishedAt || 0).getTime();
  if (!publishedMs) {
    return 240;
  }
  return Math.max(0, (Date.now() - publishedMs) / (60 * 60 * 1000));
};

const computeFreshnessScore = (publishedAt) => {
  const hoursOld = getHoursOld(publishedAt);
  return clamp01(Math.exp(-hoursOld / 18));
};

const computeImportanceScore = (story = {}, { source = null } = {}) => {
  const articleType = String(story?.articleType || "report").trim().toLowerCase();
  const articleBase = ARTICLE_TYPE_IMPORTANCE[articleType] || ARTICLE_TYPE_IMPORTANCE.report;
  const topicTags = uniqueNormalized(story?.topicTags || []);
  const topicDensity = Math.min(0.14, topicTags.length * 0.028);
  const entityDensity = Math.min(
    0.1,
    (Array.isArray(story?.namedEntities) ? story.namedEntities.length : 0) * 0.014
  );
  const trustBoost = Math.min(
    0.16,
    Number(
      source?.trustScore ??
        story?.trustScore ??
        story?.moderation?.sourceTrustScore ??
        story?.moderation?.trustScore ??
        0.6
    ) * 0.17
  );
  const breakingBoost = Boolean(story?.isBreaking || articleType === "breaking") ? 0.08 : 0;
  const opinionPenalty = Boolean(story?.isOpinion || articleType === "opinion") ? 0.08 : 0;

  return clamp01(articleBase + topicDensity + entityDensity + trustBoost + breakingBoost - opinionPenalty);
};

const computeCoverageDiversityScore = (value = {}) => {
  const sourceCount = Number(value?.sourceCount || 0) || 1;
  const storyCount = Number(value?.storyCount || 0) || 1;
  const diversityRatio = sourceCount / Math.max(1, storyCount);
  return clamp01(Math.min(1, sourceCount / 6) * 0.72 + clamp01(diversityRatio) * 0.28);
};

const computeUserAffinityScore = (story = {}, preferences = {}, user = {}, signals = {}) => {
  if (preferences?.personalizationEnabled === false) {
    return 0;
  }

  const followedSources = new Set(
    (Array.isArray(preferences?.followedSourceSlugs) ? preferences.followedSourceSlugs : [])
      .map((entry) => normalizeSlug(entry))
      .filter(Boolean)
  );
  const mutedSources = new Set(
    (Array.isArray(preferences?.mutedSourceSlugs) ? preferences.mutedSourceSlugs : [])
      .map((entry) => normalizeSlug(entry))
      .filter(Boolean)
  );
  const preferredTopics = toTopicSet(preferences, user);
  const storyTopics = uniqueNormalized(story?.topicTags || []);
  const sourceSlug = normalizeSlug(story?.sourceSlug || story?.primarySourceSlug || "");
  const storyId = getStoryId(story);
  const topicWeights = signals?.topicWeights instanceof Map ? signals.topicWeights : new Map();
  const sourceWeights = signals?.sourceWeights instanceof Map ? signals.sourceWeights : new Map();
  const savedStoryIds = signals?.savedStoryIds instanceof Set ? signals.savedStoryIds : new Set();
  const readStoryIds = signals?.readStoryIds instanceof Set ? signals.readStoryIds : new Set();

  let score = 0;
  if (storyTopics.length) {
    const preferredMatches = storyTopics.filter((entry) => preferredTopics.has(entry)).length;
    const weightedTopicInterest = storyTopics.reduce(
      (sum, topic) => sum + Number(topicWeights.get(topic) || 0),
      0
    );

    score += preferredMatches / storyTopics.length * 0.44;
    score += clamp01(weightedTopicInterest / 5.5) * 0.34;
  }

  if (sourceSlug) {
    if (followedSources.has(sourceSlug)) {
      score += 0.24;
    }
    score += clamp01(Number(sourceWeights.get(sourceSlug) || 0) / 4) * 0.16;
  }

  if (storyId && savedStoryIds.has(storyId)) {
    score += 0.16;
  } else if (storyId && readStoryIds.has(storyId)) {
    score += 0.08;
  }

  if (mutedSources.has(sourceSlug)) {
    score -= 0.36;
  }

  return clamp01(score);
};

const computeEngagementScore = (stats = {}) => {
  const impressions = Math.max(1, Number(stats?.impressions || 0));
  const opens = Number(stats?.opens || 0);
  const clicks = Number(stats?.clicks || 0);
  const reports = Number(stats?.reports || 0);
  const hides = Number(stats?.hides || 0);

  const positiveRate = (opens * 0.48 + clicks * 0.74) / impressions;
  const negativeRate = (reports * 0.92 + hides * 0.62) / impressions;
  return clamp01(positiveRate - negativeRate + 0.12);
};

const computeDiversityPenalty = (_story = {}, exposure = {}) =>
  clamp01(
    Number(exposure?.recentSourceImpressions || 0) * 0.06 +
      Number(exposure?.recentTopicImpressions || 0) * 0.04
  );

const computeFatiguePenalty = (_story = {}, exposure = {}) =>
  clamp01(Number(exposure?.sameStoryImpressions || 0) * 0.18);

const computeBlockedTopicPenalty = (story = {}, preferences = {}) => {
  const blocked = new Set(
    (Array.isArray(preferences?.blockedTopicSlugs) ? preferences.blockedTopicSlugs : [])
      .map((entry) => normalizeSlug(entry))
      .filter(Boolean)
  );
  const storyTopics = uniqueNormalized(story?.topicTags || []);
  if (!blocked.size || !storyTopics.length) {
    return 0;
  }
  return storyTopics.some((entry) => blocked.has(entry)) ? 1 : 0;
};

const computePublicInterestBoost = (story = {}, { source = null } = {}) => {
  const articleType = String(story?.articleType || "report").trim().toLowerCase();
  if (articleType === "opinion" || story?.isOpinion) {
    return 0;
  }

  const topicTags = uniqueNormalized(story?.topicTags || []);
  const geography = story?.geography || {};
  const sourceTrust = clamp01(
    Number(
      source?.trustScore ??
        story?.trustScore ??
        story?.moderation?.sourceTrustScore ??
        story?.moderation?.trustScore ??
        0.6
    )
  );
  const flags = new Set(
    (Array.isArray(story?.moderation?.sensitiveFlags) ? story.moderation.sensitiveFlags : [])
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
  );

  let boost = 0;
  if (story?.isBreaking || articleType === "breaking") {
    boost += 0.32;
  }
  if (topicTags.some((entry) => PUBLIC_INTEREST_TOPICS.has(entry))) {
    boost += 0.2;
  }
  if (flags.has("elections") || flags.has("violence") || flags.has("crisis")) {
    boost += 0.18;
  }
  if (normalizeWhitespace(geography?.primaryCountry || "").toLowerCase() === "nigeria") {
    boost += geography?.scope === "national" ? 0.16 : 0.08;
  }

  boost += sourceTrust * 0.12;
  return clamp01(boost);
};

const calculateFinalScore = (components = {}) =>
  clamp01(
    Number(components.importanceScore || 0) * 0.12 +
      Number(components.freshnessScore || 0) * 0.18 +
      Number(components.localRelevanceScore || 0) * 0.14 +
      Number(components.userAffinityScore || 0) * 0.22 +
      Number(components.sourceTrustScore || 0) * 0.14 +
      Number(components.coverageDiversityScore || 0) * 0.08 +
      Number(components.engagementScore || 0) * 0.08 +
      Number(components.publicInterestBoost || 0) * 0.12 -
      Number(components.diversityPenalty || 0) * 0.12 -
      Number(components.duplicatePenalty || 0) * 0.08 -
      Number(components.fatiguePenalty || 0) * 0.08 -
      Number(components.blockedTopicPenalty || 0) * 0.45
  );

const buildReasonList = (story = {}, components = {}, context = {}) => {
  const reasons = [];
  const topicTags = uniqueNormalized(story?.topicTags || []);
  const primaryTopic = topicTags[0];
  const source = context?.source || story?.sourceId || null;
  const preferences = context?.preferences || {};
  const sourceName = normalizeWhitespace(source?.displayName || source?.publisherName || "");
  const sourceSlug = normalizeSlug(story?.sourceSlug || story?.primarySourceSlug || "");
  const followedSources = new Set(
    (Array.isArray(preferences?.followedSourceSlugs) ? preferences.followedSourceSlugs : [])
      .map((entry) => normalizeSlug(entry))
      .filter(Boolean)
  );
  const topicWeights = context?.signals?.topicWeights instanceof Map
    ? context.signals.topicWeights
    : new Map();
  const geography = story?.geography || {};

  if (primaryTopic && Number(topicWeights.get(primaryTopic) || 0) >= 1.2) {
    reasons.push(`Because you read ${primaryTopic.replace(/-/g, " ")} news`);
  }
  if (components.localRelevanceScore >= 0.84) {
    reasons.push("Trending in your region");
  }
  if (
    normalizeWhitespace(geography?.primaryCountry || "").toLowerCase() === "nigeria" &&
    components.publicInterestBoost >= 0.18
  ) {
    reasons.push("Major story in Nigeria");
  }
  if (sourceSlug && followedSources.has(sourceSlug) && components.sourceTrustScore >= 0.7) {
    reasons.push("From a trusted source you follow");
  } else if (sourceName && components.sourceTrustScore >= 0.8) {
    reasons.push(`From a trusted source: ${sourceName}`);
  }
  if (components.coverageDiversityScore >= 0.45) {
    reasons.push("Balanced with source diversity");
  }

  return reasons.slice(0, 4);
};

const scoreStory = (story = {}, context = {}) => {
  const source = context?.source || story?.sourceId || null;
  const geography = story?.geography || {};
  const sourceTrustScore = clamp01(
    Number(
      source?.trustScore ??
        story?.trustScore ??
        story?.moderation?.sourceTrustScore ??
        story?.moderation?.trustScore ??
        0.6
    )
  );
  const importanceScore = computeImportanceScore(story, { source });
  const freshnessScore = computeFreshnessScore(story?.publishedAt);
  const localRelevanceScore = clamp01(
    context?.localRelevanceScore ??
      computeLocalRelevanceScore(geography, context?.userGeo || {})
  );
  const userAffinityScore = clamp01(
    context?.userAffinityScore ??
      computeUserAffinityScore(
        story,
        context?.preferences || {},
        context?.user || {},
        context?.signals || {}
      )
  );
  const coverageDiversityScore = clamp01(
    context?.coverageDiversityScore ?? computeCoverageDiversityScore(story)
  );
  const engagementScore = clamp01(
    context?.engagementScore ?? computeEngagementScore(context?.engagement || {})
  );
  const diversityPenalty = clamp01(
    context?.diversityPenalty ?? computeDiversityPenalty(story, context?.exposure || {})
  );
  const duplicatePenalty = clamp01(context?.duplicatePenalty ?? 0);
  const fatiguePenalty = clamp01(
    context?.fatiguePenalty ?? computeFatiguePenalty(story, context?.exposure || {})
  );
  const blockedTopicPenalty = clamp01(
    context?.blockedTopicPenalty ?? computeBlockedTopicPenalty(story, context?.preferences || {})
  );
  const publicInterestBoost = clamp01(
    context?.publicInterestBoost ?? computePublicInterestBoost(story, { source })
  );

  const scoring = {
    importanceScore,
    freshnessScore,
    localRelevanceScore,
    userAffinityScore,
    sourceTrustScore,
    coverageDiversityScore,
    engagementScore,
    diversityPenalty,
    duplicatePenalty,
    fatiguePenalty,
    blockedTopicPenalty,
    publicInterestBoost,
  };

  return {
    ...scoring,
    finalScore: calculateFinalScore(scoring),
    reasons: buildReasonList(story, scoring, { ...context, source }),
    scoredAt: new Date(),
  };
};

const scoreCluster = (cluster = {}, stories = [], context = {}) => {
  const list = Array.isArray(stories) ? stories.filter(Boolean) : [];
  const representativeStory = list[0] || cluster?.representativeStoryId || cluster;
  const baseline = scoreStory(representativeStory, {
    ...context,
    coverageDiversityScore:
      context?.coverageDiversityScore ??
      cluster?.coverageDiversityScore ??
      computeCoverageDiversityScore({
        storyCount: cluster?.storyCount || list.length || 1,
        sourceCount:
          cluster?.sourceCount || new Set(list.map((entry) => entry?.sourceSlug)).size || 1,
      }),
    duplicatePenalty:
      context?.duplicatePenalty ??
      clamp01(Math.max(0, (Number(cluster?.storyCount || list.length) || 1) - 1) * 0.02),
  });

  const importanceScore = clamp01(
    Math.max(Number(cluster?.importanceScore || 0), Number(baseline.importanceScore || 0))
  );
  const freshnessScore = clamp01(
    Math.max(Number(cluster?.freshnessScore || 0), Number(baseline.freshnessScore || 0))
  );
  const coverageDiversityScore = clamp01(
    Math.max(
      Number(cluster?.coverageDiversityScore || 0),
      Number(baseline.coverageDiversityScore || 0)
    )
  );

  return {
    ...baseline,
    importanceScore,
    freshnessScore,
    coverageDiversityScore,
    finalScore: calculateFinalScore({
      ...baseline,
      importanceScore,
      freshnessScore,
      coverageDiversityScore,
    }),
  };
};

const getCardId = (card = {}) =>
  String(card?.clusterId || card?.storyId || card?._id || card?.id || "").trim();

const getPrimarySourceSlug = (card = {}) =>
  normalizeSlug(
    card?.primarySourceSlug ||
      card?.representativeStory?.source?.slug ||
      card?.representativeStory?.sourceSlug ||
      card?.sourceSlug ||
      card?.source?.slug ||
      card?.sourceSlugs?.[0] ||
      ""
  );

const getPrimaryTopic = (card = {}) =>
  normalizeSlug(
    card?.topicTags?.[0] ||
      card?.representativeStory?.topicTags?.[0] ||
      card?.representativeStory?.topic?.[0] ||
      ""
  );

const createFeedState = () => ({
  selectedIds: new Set(),
  sourceCounts: new Map(),
  topicCounts: new Map(),
});

const canAddCard = (card = {}, state = createFeedState(), config = {}) => {
  const primarySource = getPrimarySourceSlug(card);
  const primaryTopic = getPrimaryTopic(card);
  const sourceCap = Number(config?.sourceCap || 3);
  const topicCap = Number(config?.topicCap || 5);

  if (primarySource && (state.sourceCounts.get(primarySource) || 0) >= sourceCap) {
    return false;
  }
  if (primaryTopic && (state.topicCounts.get(primaryTopic) || 0) >= topicCap) {
    return false;
  }

  return true;
};

const recordCard = (card = {}, state = createFeedState()) => {
  const id = getCardId(card);
  const primarySource = getPrimarySourceSlug(card);
  const primaryTopic = getPrimaryTopic(card);

  if (id) {
    state.selectedIds.add(id);
  }
  if (primarySource) {
    state.sourceCounts.set(primarySource, (state.sourceCounts.get(primarySource) || 0) + 1);
  }
  if (primaryTopic) {
    state.topicCounts.set(primaryTopic, (state.topicCounts.get(primaryTopic) || 0) + 1);
  }
};

const addQuotaCards = (selected = [], candidates = [], predicate, state, config, targetCount) => {
  for (const card of candidates) {
    if (selected.length >= targetCount) {
      break;
    }
    const id = getCardId(card);
    if (!id || state.selectedIds.has(id) || !predicate(card) || !canAddCard(card, state, config)) {
      continue;
    }
    selected.push(card);
    recordCard(card, state);
  }
};

const applyFeedDiversity = (cards = [], options = {}) => {
  const limit = Math.max(1, Number(options?.limit || 20));
  const sorted = [...(Array.isArray(cards) ? cards : [])].sort(
    (left, right) =>
      Number(right?.finalScore || right?.scoring?.finalScore || 0) -
      Number(left?.finalScore || left?.scoring?.finalScore || 0)
  );
  const state = createFeedState();
  const selected = [];
  const config = {
    sourceCap: Number(options?.sourceCap || 3),
    topicCap: Number(options?.topicCap || 5),
  };
  const localTarget = Math.max(0, Number(options?.localTarget ?? 2));
  const internationalTarget = Math.max(0, Number(options?.internationalTarget ?? 2));

  addQuotaCards(
    selected,
    sorted,
    (card) => {
      const scope = String(card?.geography?.scope || card?.representativeStory?.geography?.scope || "");
      return scope === "local" || scope === "national";
    },
    state,
    config,
    Math.min(limit, localTarget)
  );

  addQuotaCards(
    selected,
    sorted,
    (card) => {
      const scope = String(card?.geography?.scope || card?.representativeStory?.geography?.scope || "");
      return scope === "international";
    },
    state,
    config,
    Math.min(limit, selected.length + internationalTarget)
  );

  for (const card of sorted) {
    if (selected.length >= limit) {
      break;
    }
    const id = getCardId(card);
    if (!id || state.selectedIds.has(id) || !canAddCard(card, state, config)) {
      continue;
    }
    selected.push(card);
    recordCard(card, state);
  }

  return selected.slice(0, limit);
};

module.exports = {
  clamp01,
  computeFreshnessScore,
  computeImportanceScore,
  computeCoverageDiversityScore,
  computeUserAffinityScore,
  computeEngagementScore,
  computeDiversityPenalty,
  computeFatiguePenalty,
  computeBlockedTopicPenalty,
  computePublicInterestBoost,
  calculateFinalScore,
  scoreStory,
  scoreCluster,
  applyFeedDiversity,
};
