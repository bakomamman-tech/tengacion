const {
  normalizeHeadline,
  normalizeUrl,
  normalizeWhitespace,
} = require("./newsNormalizeService");

const toSet = (value = []) =>
  new Set(
    (Array.isArray(value) ? value : [])
      .map((entry) => normalizeWhitespace(entry).toLowerCase())
      .filter(Boolean)
  );

const jaccardSimilarity = (left = [], right = []) => {
  const leftSet = toSet(left);
  const rightSet = toSet(right);

  if (!leftSet.size || !rightSet.size) {
    return 0;
  }

  const intersection = [...leftSet].filter((entry) => rightSet.has(entry)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? intersection / union : 0;
};

const headlineTokens = (headline = "") =>
  normalizeHeadline(headline).split(" ").filter(Boolean);

const namedEntityOverlap = (left = [], right = []) => jaccardSimilarity(left, right);

const topicOverlap = (left = [], right = []) => jaccardSimilarity(left, right);

const hasCanonicalUrlMatch = (left = {}, right = {}) => {
  const leftUrl = normalizeUrl(left.canonicalUrl || "");
  const rightUrl = normalizeUrl(right.canonicalUrl || "");
  return Boolean(leftUrl && rightUrl && leftUrl === rightUrl);
};

const hasExternalIdMatch = (left = {}, right = {}) =>
  Boolean(
    left?.sourceSlug &&
      right?.sourceSlug &&
      String(left.sourceSlug) === String(right.sourceSlug) &&
      String(left.externalId || "").trim() &&
      String(left.externalId || "") === String(right.externalId || "")
  );

const isTimeProximate = (left = {}, right = {}, maxDeltaMs = 6 * 60 * 60 * 1000) => {
  const leftTime = new Date(left.publishedAt || 0).getTime();
  const rightTime = new Date(right.publishedAt || 0).getTime();
  if (!leftTime || !rightTime) {
    return false;
  }
  return Math.abs(leftTime - rightTime) <= maxDeltaMs;
};

const areStoriesDuplicates = (left = {}, right = {}, options = {}) => {
  if (!left || !right) {
    return false;
  }
  if (left === right) {
    return true;
  }
  if (hasExternalIdMatch(left, right) || hasCanonicalUrlMatch(left, right)) {
    return true;
  }

  const similarityThreshold = Number(options.similarityThreshold || 0.72);
  const entityThreshold = Number(options.entityThreshold || 0.5);
  const headlineSimilarity = jaccardSimilarity(
    headlineTokens(left.title),
    headlineTokens(right.title)
  );
  const entitySimilarity = namedEntityOverlap(
    left.namedEntities || [],
    right.namedEntities || []
  );
  const tagSimilarity = topicOverlap(left.topicTags || [], right.topicTags || []);

  if (headlineSimilarity >= 0.92) {
    return true;
  }

  if (
    headlineSimilarity >= similarityThreshold &&
    entitySimilarity >= entityThreshold &&
    isTimeProximate(left, right, options.maxDeltaMs)
  ) {
    return true;
  }

  if (
    headlineSimilarity >= 0.45 &&
    entitySimilarity >= entityThreshold &&
    tagSimilarity >= 0.34 &&
    isTimeProximate(left, right, options.maxDeltaMs)
  ) {
    return true;
  }

  return false;
};

const buildDuplicateGroups = (stories = [], options = {}) => {
  const groups = [];
  const list = Array.isArray(stories) ? stories : [];

  list.forEach((story) => {
    const match = groups.find((group) =>
      group.some((existingStory) => areStoriesDuplicates(existingStory, story, options))
    );
    if (match) {
      match.push(story);
      return;
    }
    groups.push([story]);
  });

  return groups;
};

module.exports = {
  headlineTokens,
  jaccardSimilarity,
  namedEntityOverlap,
  hasCanonicalUrlMatch,
  hasExternalIdMatch,
  isTimeProximate,
  areStoriesDuplicates,
  buildDuplicateGroups,
  topicOverlap,
};
