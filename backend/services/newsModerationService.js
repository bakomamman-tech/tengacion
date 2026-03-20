const { normalizeWhitespace } = require("./newsNormalizeService");

const PUBLIC_STATUSES = new Set(["approved", "limited"]);

const normalizeModerationInput = (payload = {}) => ({
  status: String(payload.status || "").trim().toLowerCase() || undefined,
  reason: normalizeWhitespace(payload.reason || ""),
  notes: normalizeWhitespace(payload.notes || ""),
  sensitiveFlags: Array.isArray(payload.sensitiveFlags)
    ? payload.sensitiveFlags.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [],
  misinformationRisk:
    payload.misinformationRisk === undefined || payload.misinformationRisk === null
      ? undefined
      : Math.max(0, Math.min(1, Number(payload.misinformationRisk) || 0)),
});

const isPubliclyVisible = (story = {}) =>
  PUBLIC_STATUSES.has(String(story?.moderation?.status || "").trim().toLowerCase());

const filterPublicStories = (stories = []) =>
  (Array.isArray(stories) ? stories : []).filter((story) => isPubliclyVisible(story));

const applyModerationToStory = (story, payload = {}, reviewerId = null) => {
  if (!story) {
    return story;
  }

  const next = normalizeModerationInput(payload);
  story.moderation = story.moderation || {};

  if (next.status) {
    story.moderation.status = next.status;
  }
  if (next.reason) {
    story.moderation.reason = next.reason;
  }
  if (payload.notes !== undefined) {
    story.moderation.notes = next.notes;
  }
  if (next.sensitiveFlags.length || Array.isArray(payload.sensitiveFlags)) {
    story.moderation.sensitiveFlags = next.sensitiveFlags;
  }
  if (next.misinformationRisk !== undefined) {
    story.moderation.misinformationRisk = next.misinformationRisk;
  }

  story.moderation.reviewedAt = new Date();
  story.moderation.reviewedBy = reviewerId || story.moderation.reviewedBy || null;
  return story;
};

module.exports = {
  PUBLIC_STATUSES,
  normalizeModerationInput,
  isPubliclyVisible,
  filterPublicStories,
  applyModerationToStory,
};
