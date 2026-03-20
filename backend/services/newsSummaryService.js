const { normalizeWhitespace, stripHtml } = require("./newsNormalizeService");

const truncateSummary = (value = "", maxLength = 260) => {
  const text = normalizeWhitespace(value);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const buildSummary = (payload = {}, { maxLength = 260 } = {}) => {
  const direct = normalizeWhitespace(payload.summaryText || payload.summary || "");
  if (direct) {
    return truncateSummary(direct, maxLength);
  }

  const subtitle = normalizeWhitespace(payload.subtitle || "");
  if (subtitle) {
    return truncateSummary(subtitle, maxLength);
  }

  const fromBody = stripHtml(payload.bodyHtml || payload.body || "");
  if (fromBody) {
    return truncateSummary(fromBody, maxLength);
  }

  return truncateSummary(payload.title || "", maxLength);
};

const buildClusterSummary = (stories = [], options = {}) => {
  const list = Array.isArray(stories) ? stories : [];
  if (!list.length) {
    return "";
  }

  const candidate =
    list.find((story) => normalizeWhitespace(story.summaryText || story.subtitle || "")) ||
    list[0];

  return buildSummary(candidate, options);
};

module.exports = {
  buildSummary,
  buildClusterSummary,
  truncateSummary,
};
