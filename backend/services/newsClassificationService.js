const { normalizeSlug, normalizeWhitespace, stripHtml } = require("./newsNormalizeService");

const TOPIC_KEYWORD_MAP = {
  politics: ["election", "president", "governor", "parliament", "senate", "minister", "policy"],
  business: ["market", "stock", "company", "bank", "economy", "startup", "trade", "naira"],
  sports: ["match", "goal", "league", "coach", "cup", "olympic", "football", "basketball"],
  entertainment: ["music", "album", "movie", "actor", "actress", "festival", "celebrity"],
  technology: ["ai", "software", "app", "technology", "startup", "device", "cyber", "internet"],
  health: ["health", "hospital", "disease", "outbreak", "doctor", "medical", "vaccine"],
  world: ["world", "international", "foreign", "global", "embassy", "un", "diplomatic"],
  education: ["school", "university", "student", "teacher", "exam", "education"],
  climate: ["flood", "climate", "weather", "rainfall", "storm", "heatwave", "drought"],
  crime: ["court", "police", "arrest", "crime", "fraud", "attack", "security"],
};

const SENSITIVE_KEYWORDS = {
  elections: ["election", "ballot", "polling", "vote", "campaign"],
  violence: ["killed", "attack", "violence", "bomb", "gunmen", "shooting", "clash"],
  crisis: ["crisis", "disaster", "emergency", "outbreak", "flood", "war"],
  "misinformation-risk": ["rumour", "unverified", "viral claim", "fact check", "disputed"],
};

const extractNamedEntities = (payload = {}) => {
  const raw = normalizeWhitespace(
    `${payload.title || ""} ${payload.subtitle || ""} ${stripHtml(payload.summaryText || "")}`
  );
  if (!raw) {
    return [];
  }

  const matches = raw.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) || [];
  return [...new Set(matches.map((entry) => normalizeWhitespace(entry)).filter(Boolean))].slice(
    0,
    18
  );
};

const inferArticleType = (payload = {}) => {
  const haystack = normalizeWhitespace(
    `${payload.title || ""} ${payload.subtitle || ""} ${(payload.tags || []).join(" ")}`
  ).toLowerCase();

  if (/(breaking|just in|developing)/.test(haystack)) {
    return "breaking";
  }
  if (/(analysis|inside|deep dive|what it means)/.test(haystack)) {
    return "analysis";
  }
  if (/(opinion|editorial|column|viewpoint)/.test(haystack)) {
    return "opinion";
  }
  if (/(explainer|guide|faq|how it works)/.test(haystack)) {
    return "explainer";
  }
  return "report";
};

const detectTopics = (payload = {}) => {
  const text = normalizeWhitespace(
    `${payload.title || ""} ${payload.subtitle || ""} ${payload.summaryText || ""} ${
      stripHtml(payload.bodyHtml || "")
    } ${(Array.isArray(payload.tags) ? payload.tags : []).join(" ")}`
  ).toLowerCase();

  const found = new Set(
    (Array.isArray(payload.tags) ? payload.tags : [])
      .map((entry) => normalizeSlug(entry))
      .filter(Boolean)
  );

  Object.entries(TOPIC_KEYWORD_MAP).forEach(([topic, keywords]) => {
    if (keywords.some((keyword) => text.includes(keyword))) {
      found.add(topic);
    }
  });

  return [...found].slice(0, 8);
};

const detectSensitiveFlags = (payload = {}) => {
  const text = normalizeWhitespace(
    `${payload.title || ""} ${payload.subtitle || ""} ${payload.summaryText || ""} ${
      stripHtml(payload.bodyHtml || "")
    }`
  ).toLowerCase();

  return Object.entries(SENSITIVE_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
    .map(([flag]) => flag);
};

const classifyNewsPayload = (payload = {}) => ({
  articleType: inferArticleType(payload),
  topicTags: detectTopics(payload),
  namedEntities: extractNamedEntities(payload),
  sensitiveFlags: detectSensitiveFlags(payload),
});

module.exports = {
  TOPIC_KEYWORD_MAP,
  extractNamedEntities,
  inferArticleType,
  detectTopics,
  detectSensitiveFlags,
  classifyNewsPayload,
};
