const { normalizeId } = require("./affinityService");

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
  }
  if (sets.friendUserIds?.has(authorUserId) || sets.friendCreatorIds?.has(creatorId)) {
    score += 14;
    reasons.push(buildReason("friend_connection", 14));
  }
  if (sets.followingUserIds?.has(authorUserId) || sets.followingCreatorIds?.has(creatorId)) {
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

const rankCandidatesWithDiagnostics = ({ surface, candidates = [], affinity, creatorQualityMap, limit = 20 } = {}) => {
  const candidateList = Array.isArray(candidates) ? candidates : [];
  const cappedLimit = normalizeLimit(limit);
  const diversityCap = surface === "home" ? 3 : 2;
  const meta = {
    candidateCount: candidateList.length,
    eligibleCount: 0,
    filteredCount: 0,
    filteredByReason: {},
    rankedCount: 0,
    fallbackMode: "empty",
    diversityCap,
    limit: cappedLimit,
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
    const popularity = getPopularityBoost(candidate, surface);
    const exploration = getExplorationBonus(candidate, affinity);
    const trustPenalty = getTrustPenalty(candidate, creatorQualityMap);
    const viewerFollowsCreator = Boolean(
      normalizeId(candidate?.creatorId)
      && affinity?.relationshipSets?.followingCreatorIds?.has(normalizeId(candidate?.creatorId))
    );

    const score = relationship.score
      + affinityBoost.score
      + freshness.score
      + popularity.score
      + exploration.score
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
        ...trustPenalty.reasons.map((entry) => ({ ...entry, penalty: true })),
      ],
    });
  }

  const items = diversify(
    ranked.sort((a, b) => Number(b.score || 0) - Number(a.score || 0)),
    diversityCap
  ).slice(0, cappedLimit);

  meta.rankedCount = items.length;
  meta.fallbackMode = getFallbackMode({ affinity, rankedCount: items.length });

  return { items, meta };
};

const rankCandidates = (options = {}) => {
  const { items } = rankCandidatesWithDiagnostics(options);
  return items;
};

module.exports = {
  getIneligibleReason,
  rankCandidates,
  rankCandidatesWithDiagnostics,
  shouldFilterCandidate,
};
