const DEFAULT_FEATURED_BOOST = 8;

const normalizeText = (value = "", maxLength = 120) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, maxLength);

const parseList = (value = "") =>
  String(value || "")
    .split(/[,\n]+/)
    .map((entry) => normalizeText(entry))
    .filter(Boolean);

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const collectCandidateUsernames = (candidate = {}) => {
  const payload = candidate.payload || {};
  const host = payload.host || {};

  return [
    payload.username,
    payload.creatorUsername,
    payload.authorUsername,
    host.username,
  ]
    .map((value) => normalizeText(value, 80).replace(/^@+/, ""))
    .filter(Boolean);
};

const collectCandidateTopics = (candidate = {}) => {
  const payload = candidate.payload || {};
  const values = [
    ...(Array.isArray(candidate.topics) ? candidate.topics : []),
    ...(Array.isArray(payload.genres) ? payload.genres : []),
    ...(Array.isArray(payload.hashtags) ? payload.hashtags : []),
    payload.genre,
    payload.kind,
    payload.category,
    payload.contentType,
  ];

  return values.map((value) => normalizeText(value, 80).replace(/^#+/, "")).filter(Boolean);
};

const getFeaturedDiscoveryCollections = () => {
  const creatorIds = new Set([
    ...parseList(process.env.DISCOVERY_FEATURED_CREATOR_IDS),
    ...parseList(process.env.DISCOVERY_FEATURED_AUTHOR_USER_IDS),
  ]);
  const usernames = new Set(
    parseList(process.env.DISCOVERY_FEATURED_USERNAMES).map((value) =>
      value.replace(/^@+/, "")
    )
  );
  const topics = new Set(
    parseList(process.env.DISCOVERY_FEATURED_TOPICS).map((value) =>
      value.replace(/^#+/, "")
    )
  );
  const contentTypes = new Set(parseList(process.env.DISCOVERY_FEATURED_CONTENT_TYPES));
  const boost = parseNumber(process.env.DISCOVERY_FEATURED_BOOST, DEFAULT_FEATURED_BOOST);
  const active =
    creatorIds.size > 0 || usernames.size > 0 || topics.size > 0 || contentTypes.size > 0;

  return {
    active,
    boost,
    creatorIds,
    usernames,
    topics,
    contentTypes,
  };
};

const getFeaturedDiscoverySignals = (candidate = {}) => {
  const config = getFeaturedDiscoveryCollections();
  if (!config.active) {
    return {
      matched: false,
      boost: 0,
      reasons: [],
    };
  }

  const reasons = [];
  const creatorId = normalizeText(candidate.creatorId);
  const authorUserId = normalizeText(candidate.authorUserId);
  const usernames = collectCandidateUsernames(candidate);
  const topics = collectCandidateTopics(candidate);
  const contentType = normalizeText(candidate.contentType || candidate.entityType, 40);
  const entityType = normalizeText(candidate.entityType, 40);

  if (
    (creatorId && config.creatorIds.has(creatorId)) ||
    (authorUserId && config.creatorIds.has(authorUserId))
  ) {
    reasons.push("featured_creator");
  }

  if (usernames.some((username) => config.usernames.has(username))) {
    reasons.push("featured_creator");
  }

  if (topics.some((topic) => config.topics.has(topic))) {
    reasons.push("featured_topic");
  }

  if (
    (contentType && config.contentTypes.has(contentType)) ||
    (entityType && config.contentTypes.has(entityType))
  ) {
    reasons.push("featured_format");
  }

  return {
    matched: reasons.length > 0,
    boost: reasons.length > 0 ? config.boost : 0,
    reasons: Array.from(new Set(reasons)),
  };
};

module.exports = {
  getFeaturedDiscoveryCollections,
  getFeaturedDiscoverySignals,
};
