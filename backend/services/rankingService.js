const { normalizeId } = require("./affinityService");
const {
  getFeaturedDiscoveryCollections,
  getFeaturedDiscoverySignals,
} = require("../config/discoveryCollections");
const {
  DEFAULT_RECOMMENDATION_POLICY,
  getMaxContentTypeStreak,
  normalizePolicy,
} = require("./recommendationGovernanceService");

const log1p = (value) => Math.log(1 + Math.max(0, Number(value) || 0));

const hoursSince = (value) => {
  const time = new Date(value || 0).getTime();
  if (!time) return 99999;
  return Math.max(0, (Date.now() - time) / (60 * 60 * 1000));
};

const buildReason = (key, score) => ({ key, score: Number(score.toFixed(3)) });

const incrementReasonCount = (counts, reason) => {
  if (!reason) return;
  counts[reason] = Number(counts[reason] || 0) + 1;
};

const getRelationshipBoost = (candidate, affinity) => {
  const sets = affinity?.relationshipSets || {};
  const authorUserId = normalizeId(candidate?.authorUserId);
  const creatorId = normalizeId(candidate?.creatorId);
  const reasons = [];
  let score = 0;

  if (sets.closeFriendUserIds?.has(authorUserId) || sets.closeFriendCreatorIds?.has(creatorId)) {
    score += 18;
    reasons.push(buildReason("close_connection", 18));
  } else if (sets.friendUserIds?.has(authorUserId) || sets.friendCreatorIds?.has(creatorId)) {
    score += 14;
    reasons.push(buildReason("friend_connection", 14));
  } else if (sets.followingUserIds?.has(authorUserId) || sets.followingCreatorIds?.has(creatorId)) {
    score += 12;
    reasons.push(buildReason("following_connection", 12));
  }
  if (sets.messagePartnerIds?.has(authorUserId)) {
    score += 6;
    reasons.push(buildReason("recent_messages", 6));
  }
  if (sets.purchaseCreatorIds?.has(creatorId)) {
    score += 8;
    reasons.push(buildReason("previous_purchase", 8));
  }

  return { score, reasons };
};

const getAffinityBoost = (candidate, affinity) => {
  const reasons = [];
  let score = 0;

  const creatorId = normalizeId(candidate?.creatorId);
  const contentType = String(candidate?.contentType || "").trim().toLowerCase();
  const topCreatorScore = Number(affinity?.topCreatorScores?.get(creatorId) || 0);
  const contentTypeScore = Number(affinity?.contentTypeScores?.get(contentType) || 0);
  const topics = Array.isArray(candidate?.topics) ? candidate.topics : [];

  if (topCreatorScore > 0) {
    const boost = Math.min(10, 3 + topCreatorScore * 0.7);
    score += boost;
    reasons.push(buildReason("creator_affinity", boost));
  }
  if (contentTypeScore > 0) {
    const boost = Math.min(8, 2 + contentTypeScore * 0.6);
    score += boost;
    reasons.push(buildReason("content_type_affinity", boost));
  }
  for (const topic of topics) {
    const topicScore = Number(affinity?.topicScores?.get(String(topic || "").trim().toLowerCase()) || 0);
    if (topicScore > 0) {
      const boost = Math.min(5, topicScore * 0.5);
      score += boost;
      reasons.push(buildReason("topic_affinity", boost));
      break;
    }
  }

  return { score, reasons };
};

const getFreshnessBoost = (candidate, surface) => {
  const ageHours = hoursSince(candidate?.createdAt);
  const surfaceScale = surface === "live" ? 8 : surface === "home" ? 6 : 4.5;
  const freshness = surfaceScale / (1 + ageHours / (surface === "home" ? 12 : 24));
  return {
    score: freshness,
    reasons: freshness >= 2 ? [buildReason("fresh_content", freshness)] : [],
  };
};

const getHomeAgePenalty = (candidate, surface) => {
  if (surface !== "home") {
    return { score: 0, reasons: [] };
  }

  const ageHours = hoursSince(candidate?.createdAt);
  const score = Math.min(32, 4 * Math.log2(1 + ageHours / 6));
  return {
    score,
    reasons: score >= 2 ? [buildReason("older_content", score)] : [],
  };
};

const getRecentImpressionPenalty = (candidate, recentImpressions) => {
  const entityId = normalizeId(candidate?.entityId);
  const impression = recentImpressions?.get(entityId);
  if (!impression) {
    return { score: 0, reasons: [] };
  }

  const count = Math.max(1, Number(impression?.count || 0));
  const lastSeenHours = hoursSince(impression?.lastSeenAt);
  const recencyFactor = 1 / (1 + lastSeenHours / 24);
  const score = Math.min(18, (6 + log1p(count) * 4) * recencyFactor);

  return {
    score,
    reasons: score >= 1 ? [buildReason("recently_seen", score)] : [],
  };
};

const getPopularityBoost = (candidate, surface) => {
  const base = log1p(candidate?.popularity || 0);
  const multiplier = surface === "creator_hub" ? 1.8 : surface === "creators" ? 1.4 : 1.25;
  const score = base * multiplier;
  return {
    score,
    reasons: score >= 1.5 ? [buildReason("popular_now", score)] : [],
  };
};

const getTrustPenalty = (candidate, creatorQualityMap) => {
  const creatorId = normalizeId(candidate?.creatorId);
  if (!creatorId) {
    return { score: 0, reasons: [] };
  }

  const quality = creatorQualityMap?.get(creatorId);
  if (!quality) {
    return { score: 0, reasons: [] };
  }

  const trustScore = Number(quality?.trustScore || 0.5);
  const penalty = (1 - trustScore) * 16;
  return {
    score: penalty,
    reasons: penalty >= 3 ? [buildReason("trust_penalty", penalty)] : [],
  };
};

const getRecommendationPerformanceAdjustment = (
  candidate,
  creatorPerformanceMap,
  policy = DEFAULT_RECOMMENDATION_POLICY
) => {
  const creatorId = normalizeId(candidate?.creatorId);
  const performance = creatorId ? creatorPerformanceMap?.get(creatorId) : null;
  if (!performance) return { score: 0, reasons: [] };

  const normalizedPolicy = normalizePolicy(policy);
  const hidePenalty = Number(performance.hideRate || 0) * normalizedPolicy.hideRatePenalty;
  const reportPenalty = Number(performance.reportRate || 0) * normalizedPolicy.reportRatePenalty;
  const conversionBoost = Number(performance.conversionRate || 0) * normalizedPolicy.conversionRateBoost;
  const score = conversionBoost - hidePenalty - reportPenalty;
  const reasons = [];
  if (conversionBoost >= 0.5) reasons.push(buildReason("trusted_conversion", conversionBoost));
  if (hidePenalty >= 0.5) reasons.push({ ...buildReason("hide_rate_penalty", hidePenalty), penalty: true });
  if (reportPenalty >= 0.5) reasons.push({ ...buildReason("report_rate_penalty", reportPenalty), penalty: true });
  return { score, reasons };
};

const getIneligibleReason = (candidate, affinity) => {
  if (!candidate?.candidateId) {
    return "missing_candidate_id";
  }

  const sets = affinity?.relationshipSets || {};
  const authorUserId = normalizeId(candidate?.authorUserId);
  if (!authorUserId) {
    return "";
  }

  if (sets.blockedUserIds?.has(authorUserId)) {
    return "blocked_author";
  }
  if (sets.mutedUserIds?.has(authorUserId)) {
    return "muted_author";
  }
  if (sets.restrictedUserIds?.has(authorUserId)) {
    return "restricted_author";
  }

  return "";
};

const shouldFilterCandidate = (candidate, affinity) => Boolean(getIneligibleReason(candidate, affinity));

const getExplorationBonus = (candidate, affinity) => {
  const sets = affinity?.relationshipSets || {};
  const authorUserId = normalizeId(candidate?.authorUserId);
  const creatorId = normalizeId(candidate?.creatorId);
  const isKnown =
    sets.followingUserIds?.has(authorUserId)
    || sets.friendUserIds?.has(authorUserId)
    || sets.followingCreatorIds?.has(creatorId)
    || sets.friendCreatorIds?.has(creatorId)
    || sets.purchaseCreatorIds?.has(creatorId);

  if (isKnown) {
    return { score: 0, reasons: [] };
  }

  const score = candidate?.popularity > 0 ? 1.8 : 1;
  return {
    score,
    reasons: [buildReason("exploration", score)],
  };
};

const isExplorationCandidate = (candidate, affinity) => {
  const sets = affinity?.relationshipSets || {};
  const authorUserId = normalizeId(candidate?.authorUserId);
  const creatorId = normalizeId(candidate?.creatorId);
  return !(
    sets.followingUserIds?.has(authorUserId)
    || sets.friendUserIds?.has(authorUserId)
    || sets.followingCreatorIds?.has(creatorId)
    || sets.friendCreatorIds?.has(creatorId)
    || sets.purchaseCreatorIds?.has(creatorId)
  );
};

const getFeaturedCollectionBoost = (candidate, { isColdStart = false } = {}) => {
  const signals = getFeaturedDiscoverySignals(candidate);
  if (!signals.matched || !isColdStart) {
    return {
      matched: signals.matched,
      score: 0,
      reasons: [],
    };
  }

  const score = Math.min(16, Math.max(0, Number(signals.boost || 0)));
  return {
    matched: true,
    score,
    reasons: score > 0 ? [buildReason("featured_collection", score)] : [],
  };
};

const diversify = (items, perCreatorCap = 2) => {
  const creatorCounts = new Map();
  const diversified = [];
  const overflow = [];

  for (const item of items) {
    const creatorId = normalizeId(item?.creatorId);
    if (!creatorId) {
      diversified.push(item);
      continue;
    }
    const count = Number(creatorCounts.get(creatorId) || 0);
    if (count < perCreatorCap) {
      diversified.push(item);
      creatorCounts.set(creatorId, count + 1);
    } else {
      overflow.push(item);
    }
  }

  return [...diversified, ...overflow];
};

const applyGovernedOrdering = ({
  items = [],
  affinity,
  limit = 20,
  policy = DEFAULT_RECOMMENDATION_POLICY,
} = {}) => {
  const normalizedPolicy = normalizePolicy(policy);
  const targetSize = Math.min(normalizeLimit(limit), items.length);
  if (!normalizedPolicy.enabled) {
    return diversify(items, normalizedPolicy.maxRepeatedCreatorCount).slice(0, targetSize);
  }

  const remaining = items.map((item) => ({
    ...item,
    isExploration: isExplorationCandidate(item, affinity),
  }));
  const selected = [];
  const creatorCounts = new Map();
  const desiredExploration = Math.min(
    remaining.filter((item) => item.isExploration).length,
    Math.ceil(targetSize * normalizedPolicy.minimumExplorationShare)
  );

  while (selected.length < targetSize && remaining.length) {
    const slotsRemaining = targetSize - selected.length;
    const explorationSelected = selected.filter((item) => item.isExploration).length;
    const mustExplore = explorationSelected + slotsRemaining <= desiredExploration;
    const previousType = String(selected[selected.length - 1]?.contentType || "");
    let currentTypeStreak = 0;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (String(selected[index]?.contentType || "") !== previousType) break;
      currentTypeStreak += 1;
    }

    const isAllowed = (item, { enforceType = true, enforceCreator = true } = {}) => {
      const creatorId = normalizeId(item.creatorId);
      const creatorAllowed = !creatorId || Number(creatorCounts.get(creatorId) || 0) < normalizedPolicy.maxRepeatedCreatorCount;
      const type = String(item.contentType || "");
      const typeAllowed = !type || type !== previousType || currentTypeStreak < normalizedPolicy.maxContentTypeStreak;
      return (!mustExplore || item.isExploration) && (!enforceCreator || creatorAllowed) && (!enforceType || typeAllowed);
    };

    let nextIndex = remaining.findIndex((item) => isAllowed(item));
    if (nextIndex < 0) break;

    const [next] = remaining.splice(nextIndex, 1);
    selected.push(next);
    const creatorId = normalizeId(next.creatorId);
    if (creatorId) creatorCounts.set(creatorId, Number(creatorCounts.get(creatorId) || 0) + 1);
  }

  return selected;
};

const hasPositiveAffinityEntries = (entries = [], keyName) =>
  Array.isArray(entries)
  && entries.some((entry) => entry?.[keyName] && Number(entry?.score || 0) > 0);

const hasPositiveAffinitySignals = (affinity) => {
  if (!affinity) return false;

  const recentSignals = affinity.recentSignals || {};
  const hasRecentActivity = ["events", "progressRows", "purchases", "messagePartners"]
    .some((key) => Number(recentSignals?.[key] || 0) > 0);
  const sets = affinity.relationshipSets || {};
  const hasRelationshipActivity = [
    "followingUserIds",
    "friendUserIds",
    "closeFriendUserIds",
    "followingCreatorIds",
    "friendCreatorIds",
    "closeFriendCreatorIds",
    "messagePartnerIds",
    "purchaseCreatorIds",
  ].some((key) => Number(sets?.[key]?.size || 0) > 0);

  return (
    hasRecentActivity
    || hasRelationshipActivity
    || hasPositiveAffinityEntries(affinity.topCreators, "creatorId")
    || hasPositiveAffinityEntries(affinity.preferredContentTypes, "contentType")
    || hasPositiveAffinityEntries(affinity.topTopics, "topic")
  );
};

const getFallbackMode = ({ affinity, rankedCount }) => {
  if (Number(rankedCount || 0) <= 0) {
    return "empty";
  }
  return hasPositiveAffinitySignals(affinity) ? "personalized" : "cold_start";
};

const normalizeLimit = (limit) => Math.max(1, Math.min(50, Number(limit) || 20));

const getCandidateCreatedAt = (candidate) => {
  const timestamp = new Date(candidate?.createdAt || candidate?.payload?.createdAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const compareCandidates = (surface) => (left, right) => {
  const scoreDifference = Number(right?.score || 0) - Number(left?.score || 0);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  if (surface === "home") {
    const createdAtDifference = getCandidateCreatedAt(right) - getCandidateCreatedAt(left);
    if (createdAtDifference !== 0) {
      return createdAtDifference;
    }
  }

  return String(left?.candidateId || "").localeCompare(String(right?.candidateId || ""));
};

const rankCandidatesWithDiagnostics = ({
  surface,
  candidates = [],
  affinity,
  creatorQualityMap,
  creatorPerformanceMap,
  recentImpressions,
  limit = 20,
  policy = DEFAULT_RECOMMENDATION_POLICY,
} = {}) => {
  const candidateList = Array.isArray(candidates) ? candidates : [];
  const cappedLimit = normalizeLimit(limit);
  const normalizedPolicy = normalizePolicy(policy);
  const diversityCap = normalizedPolicy.maxRepeatedCreatorCount;
  const isColdStart = !hasPositiveAffinitySignals(affinity);
  const featuredCollections = getFeaturedDiscoveryCollections();
  const meta = {
    candidateCount: candidateList.length,
    eligibleCount: 0,
    filteredCount: 0,
    filteredByReason: {},
    rankedCount: 0,
    fallbackMode: "empty",
    diversityCap,
    maxContentTypeStreak: normalizedPolicy.maxContentTypeStreak,
    minimumExplorationShare: normalizedPolicy.minimumExplorationShare,
    limit: cappedLimit,
    featuredCollectionActive: featuredCollections.active,
    featuredCandidateCount: 0,
    featuredBoostedCount: 0,
  };
  const ranked = [];

  for (const candidate of candidateList) {
    const ineligibleReason = getIneligibleReason(candidate, affinity);
    if (ineligibleReason) {
      meta.filteredCount += 1;
      incrementReasonCount(meta.filteredByReason, ineligibleReason);
      continue;
    }
    meta.eligibleCount += 1;

    const relationship = getRelationshipBoost(candidate, affinity);
    const affinityBoost = getAffinityBoost(candidate, affinity);
    const freshness = getFreshnessBoost(candidate, surface);
    const agePenalty = getHomeAgePenalty(candidate, surface);
    const impressionPenalty = getRecentImpressionPenalty(candidate, recentImpressions);
    const popularity = getPopularityBoost(candidate, surface);
    const exploration = getExplorationBonus(candidate, affinity);
    const featuredCollection = getFeaturedCollectionBoost(candidate, { isColdStart });
    const trustPenalty = getTrustPenalty(candidate, creatorQualityMap);
    const performanceAdjustment = getRecommendationPerformanceAdjustment(
      candidate,
      creatorPerformanceMap,
      normalizedPolicy
    );
    const viewerFollowsCreator = Boolean(
      normalizeId(candidate?.creatorId)
      && affinity?.relationshipSets?.followingCreatorIds?.has(normalizeId(candidate?.creatorId))
    );

    if (featuredCollection.matched) {
      meta.featuredCandidateCount += 1;
    }
    if (featuredCollection.score > 0) {
      meta.featuredBoostedCount += 1;
    }

    const score = relationship.score
      + affinityBoost.score
      + freshness.score
      + popularity.score
      + exploration.score
      + featuredCollection.score
      + performanceAdjustment.score
      - agePenalty.score
      - impressionPenalty.score
      - trustPenalty.score;

    ranked.push({
      ...candidate,
      score: Number(score.toFixed(4)),
      viewerFollowsCreator,
      reasonSignals: [
        ...relationship.reasons,
        ...affinityBoost.reasons,
        ...freshness.reasons,
        ...popularity.reasons,
        ...exploration.reasons,
        ...featuredCollection.reasons,
        ...performanceAdjustment.reasons,
        ...agePenalty.reasons.map((entry) => ({ ...entry, penalty: true })),
        ...impressionPenalty.reasons.map((entry) => ({ ...entry, penalty: true })),
        ...trustPenalty.reasons.map((entry) => ({ ...entry, penalty: true })),
      ],
    });
  }

  const sorted = ranked.sort(compareCandidates(surface));
  const items = applyGovernedOrdering({
    items: sorted,
    affinity,
    limit: cappedLimit,
    policy: normalizedPolicy,
  });

  meta.rankedCount = items.length;
  meta.fallbackMode = getFallbackMode({ affinity, rankedCount: items.length });
  meta.explorationCount = items.filter((item) => item.isExploration).length;
  meta.explorationShare = items.length
    ? Number((meta.explorationCount / items.length).toFixed(4))
    : 0;
  meta.maxObservedContentTypeStreak = getMaxContentTypeStreak(
    items.map((item, index) => ({ entityType: item.contentType, rank: index + 1 }))
  );

  return { items, meta };
};

const rankCandidates = (options = {}) => {
  const { items } = rankCandidatesWithDiagnostics(options);
  return items;
};

module.exports = {
  applyGovernedOrdering,
  getRecommendationPerformanceAdjustment,
  getIneligibleReason,
  rankCandidates,
  rankCandidatesWithDiagnostics,
  shouldFilterCandidate,
};
