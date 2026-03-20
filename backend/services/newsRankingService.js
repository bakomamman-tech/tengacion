const { computeLocalRelevanceScore } = require("./newsGeoService");
const { normalizeSlug, normalizeWhitespace } = require("./newsNormalizeService");

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

const ARTICLE_TYPE_IMPORTANCE = {
  breaking: 0.96,
  analysis: 0.72,
  opinion: 0.44,
  explainer: 0.62,
  report: 0.68,
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
      ...(Array.isArray(user?.interests) ? user.interests : []),
    ]
      .map((entry) => normalizeSlug(entry))
      .filter(Boolean)
  );

const getHoursOld = (publishedAt) => {
  const publishedMs = new Date(publishedAt || 0).getTime();
  if (!publishedMs) {
    return 240;
  }
  return Math.max(0, (Date.now() - publishedMs) / (60 * 60 * 1000));
};

const computeFreshnessScore = (publishedAt) => {
  const hoursOld = getHoursOld(publishedAt);
  return clamp01(Math.exp(-hoursOld / 20));
};

const computeImportanceScore = (story = {}, { source = null } = {}) => {
  const articleType = String(story?.articleType || "report").trim().toLowerCase();
  const articleBase = ARTICLE_TYPE_IMPORTANCE[articleType] || ARTICLE_TYPE_IMPORTANCE.report;
  const topicDensity = Math.min(
    0.12,
    (Array.isArray(story?.topicTags) ? story.topicTags.length : 0) * 0.025
  );
  const entityDensity = Math.min(
    0.12,
    (Array.isArray(story?.namedEntities) ? story.namedEntities.length : 0) * 0.015
  );
  const trustBoost = Math.min(
    0.16,
    Number(
      source?.trustScore ??
        story?.moderation?.sourceTrustScore ??
        story?.moderation?.trustScore ??
        0.6
    ) * 0.16
  );
  const sensitiveBoost = Math.min(
    0.1,
    (Array.isArray(story?.moderation?.sensitiveFlags)
      ? story.moderation.sensitiveFlags.length
      : 0) * 0.03
  );

  return clamp01(articleBase + topicDensity + entityDensity + trustBoost + sensitiveBoost);
};

const computeCoverageDiversityScore = (value = {}) => {
  const sourceCount = Number(value?.sourceCount || 0) || 1;
  const storyCount = Number(value?.storyCount || 0) || 1;
  const diversityRatio = sourceCount / Math.max(1, storyCount);
  return clamp01(Math.min(1, sourceCount / 5) * 0.7 + clamp01(diversityRatio) * 0.3);
};

const computeUserAffinityScore = (story = {}, preferences = {}, user = {}) => {
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
  const topicMatches = storyTopics.filter((entry) => preferredTopics.has(entry)).length;
  const sourceSlug = normalizeSlug(story?.sourceSlug || story?.primarySourceSlug || "");

  let score = storyTopics.length ? topicMatches / storyTopics.length : 0;
  if (followedSources.has(sourceSlug)) {
    score += 0.28;
  }
  if (mutedSources.has(sourceSlug)) {
    score -= 0.3;
  }

  return clamp01(score);
};

const computeEngagementScore = (stats = {}) => {
  const impressions = Math.max(1, Number(stats?.impressions || 0));
  const opens = Number(stats?.opens || 0);
  const clicks = Number(stats?.clicks || 0);
  const reports = Number(stats?.reports || 0);
  const hides = Number(stats?.hides || 0);

  const positiveRate = (opens * 0.55 + clicks * 0.75) / impressions;
  const negativeRate = (reports * 0.9 + hides * 0.6) / impressions;
  return clamp01(positiveRate - negativeRate + 0.12);
};

const computeFatiguePenalty = (story = {}, exposure = {}) => {
  const recentSourceImpressions = Number(exposure?.recentSourceImpressions || 0);
  const recentTopicImpressions = Number(exposure?.recentTopicImpressions || 0);
  const sameStoryImpressions = Number(exposure?.sameStoryImpressions || 0);

  return clamp01(
    recentSourceImpressions * 0.04 +
      recentTopicImpressions * 0.025 +
      sameStoryImpressions * 0.16
  );
};

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
  return blocked.has(storyTopics[0]) || storyTopics.some((entry) => blocked.has(entry)) ? 1 : 0;
};

const calculateFinalScore = (components = {}) =>
  clamp01(
    Number(components.importanceScore || 0) * 0.24 +
      Number(components.freshnessScore || 0) * 0.2 +
      Number(components.localRelevanceScore || 0) * 0.18 +
      Number(components.userAffinityScore || 0) * 0.14 +
      Number(components.sourceTrustScore || 0) * 0.1 +
      Number(components.coverageDiversityScore || 0) * 0.08 +
      Number(components.engagementScore || 0) * 0.06 -
      Number(components.duplicatePenalty || 0) -
      Number(components.fatiguePenalty || 0) -
      Number(components.blockedTopicPenalty || 0)
  );

const buildReasonList = (story = {}, components = {}, { source = null } = {}) => {
  const reasons = [];
  const topicTags = uniqueNormalized(story?.topicTags || []);
  const primaryTopic = topicTags[0];
  const sourceName = normalizeWhitespace(source?.displayName || source?.publisherName || "");

  if (components.localRelevanceScore >= 0.8) {
    reasons.push("Relevant to your location");
  }
  if (components.userAffinityScore >= 0.5 && primaryTopic) {
    reasons.push(`Matches your interest in ${primaryTopic.replace(/-/g, " ")}`);
  }
  if (components.freshnessScore >= 0.8) {
    reasons.push("Recently published");
  }
  if (components.coverageDiversityScore >= 0.45) {
    reasons.push("Covered by multiple publishers");
  }
  if (sourceName && components.sourceTrustScore >= 0.65) {
    reasons.push(`From a trusted source: ${sourceName}`);
  }

  return reasons.slice(0, 4);
};

const scoreStory = (story = {}, context = {}) => {
  const source = context?.source || story?.sourceId || null;
  const geography = story?.geography || {};
  const sourceTrustScore = clamp01(
    Number(
      source?.trustScore ??
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
      computeUserAffinityScore(story, context?.preferences || {}, context?.user || {})
  );
  const coverageDiversityScore = clamp01(
    context?.coverageDiversityScore ?? computeCoverageDiversityScore(story)
  );
  const engagementScore = clamp01(
    context?.engagementScore ?? computeEngagementScore(context?.engagement || {})
  );
  const duplicatePenalty = clamp01(context?.duplicatePenalty ?? 0);
  const fatiguePenalty = clamp01(
    context?.fatiguePenalty ?? computeFatiguePenalty(story, context?.exposure || {})
  );
  const blockedTopicPenalty = clamp01(
    context?.blockedTopicPenalty ?? computeBlockedTopicPenalty(story, context?.preferences || {})
  );

  const scoring = {
    importanceScore,
    freshnessScore,
    localRelevanceScore,
    userAffinityScore,
    sourceTrustScore,
    coverageDiversityScore,
    engagementScore,
    duplicatePenalty,
    fatiguePenalty,
    blockedTopicPenalty,
  };

  return {
    ...scoring,
    finalScore: calculateFinalScore(scoring),
    reasons: buildReasonList(story, scoring, { source }),
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
      clamp01(Math.max(0, (Number(cluster?.storyCount || list.length) || 1) - 1) * 0.015),
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
  computeFatiguePenalty,
  computeBlockedTopicPenalty,
  calculateFinalScore,
  scoreStory,
  scoreCluster,
  applyFeedDiversity,
};
