const clampPreviewLimit = (value = 30) => Math.max(1, Math.min(30, Number(value) || 30));

export const isStoryMusicCandidate = (item = {}) => {
  const itemType = String(item?.itemType || item?.feedItemType || "").trim().toLowerCase();
  return ["track", "album"].includes(itemType) && Boolean(item?.previewUrl);
};

export const normalizeStoryMusicSelection = (item = {}) => ({
  itemType: String(item?.itemType || item?.feedItemType || "").trim().toLowerCase(),
  itemId: String(item?.id || item?.contentId || "").trim(),
  creatorId: String(item?.creatorId || "").trim(),
  creatorUserId: String(item?.creatorUserId || "").trim(),
  creatorName: String(item?.creatorName || "").trim(),
  creatorUsername: String(item?.creatorUsername || "").trim(),
  creatorAvatar: String(item?.creatorAvatar || "").trim(),
  title: String(item?.title || "").trim(),
  coverImage: String(item?.coverImage || "").trim(),
  previewStartSec: Math.max(0, Number(item?.previewStartSec || 0)),
  previewLimitSec: clampPreviewLimit(item?.previewLimitSec || 30),
  durationSec: Math.max(0, Number(item?.durationSec || 0)),
  summaryLabel: String(item?.summaryLabel || "Music").trim() || "Music",
});

export const getStoryMusicSubtitle = (item = {}) => {
  const creator = String(item?.creatorName || "").trim();
  const label = String(item?.summaryLabel || "Music").trim() || "Music";
  return [label, creator].filter(Boolean).join(" · ");
};
