const Album = require("../models/Album");
const Track = require("../models/Track");
const { buildSignedMediaUrl } = require("./mediaSigner");

const ACTIVE_TRACK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_ALBUM_FILTER = { status: "published", isPublished: { $ne: false }, archivedAt: null };
const MUSIC_ITEM_TYPES = new Set(["track", "album"]);
const DEFAULT_PREVIEW_LIMIT = 30;

const toCleanString = (value = "") => String(value || "").trim();

const clampPreviewLimit = (value = DEFAULT_PREVIEW_LIMIT) =>
  Math.max(1, Math.min(DEFAULT_PREVIEW_LIMIT, Number(value) || DEFAULT_PREVIEW_LIMIT));

const parseMaybeJson = (value) => {
  if (!value || typeof value === "object") {
    return value || null;
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeSelection = (value) => {
  const raw = parseMaybeJson(value);
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const itemType = toCleanString(raw.itemType || raw.feedItemType || raw.type).toLowerCase();
  const itemId = toCleanString(raw.itemId || raw.contentId || raw.id);

  if (!MUSIC_ITEM_TYPES.has(itemType) || !itemId) {
    return null;
  }

  return {
    itemType,
    itemId,
    creatorId: toCleanString(raw.creatorId),
    creatorUserId: toCleanString(raw.creatorUserId),
    creatorName: toCleanString(raw.creatorName || raw.creator),
    creatorUsername: toCleanString(raw.creatorUsername),
    creatorAvatar: toCleanString(raw.creatorAvatar || raw.avatar),
    title: toCleanString(raw.title),
    coverImage: toCleanString(raw.coverImage || raw.coverUrl || raw.imageUrl),
    previewStartSec: Math.max(0, Number(raw.previewStartSec || 0)),
    previewLimitSec: clampPreviewLimit(raw.previewLimitSec || DEFAULT_PREVIEW_LIMIT),
    durationSec: Math.max(0, Number(raw.durationSec || 0)),
    summaryLabel: toCleanString(raw.summaryLabel || "Music") || "Music",
  };
};

const normalizeStoryMusicSelection = normalizeSelection;

const resolveTrackAttachment = async (selection) => {
  const track = await Track.findOne({ _id: selection.itemId, ...ACTIVE_TRACK_FILTER }).lean();
  if (!track) {
    return null;
  }

  const previewSource = toCleanString(
    track.previewUrl ||
      track.previewSampleUrl ||
      track.previewClipUrl
  );

  if (!previewSource) {
    return null;
  }

  return {
    itemType: "track",
    itemId: String(track._id),
    creatorId: toCleanString(track.creatorId?.toString?.() || track.creatorId || selection.creatorId),
    creatorUserId: selection.creatorUserId || "",
    creatorName: toCleanString(track.artistName || selection.creatorName || track.title),
    creatorUsername: selection.creatorUsername || "",
    creatorAvatar: selection.creatorAvatar || "",
    title: toCleanString(track.title || selection.title),
    coverImage: toCleanString(track.coverImageUrl || track.coverUrl || selection.coverImage),
    sourceUrl: previewSource,
    previewStartSec: Math.max(0, Number(track.previewStartSec || 0)),
    previewLimitSec: clampPreviewLimit(track.previewLimitSec || selection.previewLimitSec),
    durationSec: Math.max(0, Number(track.durationSec || selection.durationSec || 0)),
    releaseType: toCleanString(track.releaseType || "single") || "single",
    summaryLabel: "Music",
  };
};

const resolveAlbumAttachment = async (selection) => {
  const album = await Album.findOne({ _id: selection.itemId, ...ACTIVE_ALBUM_FILTER }).lean();
  if (!album) {
    return null;
  }

  const firstTrack = Array.isArray(album.tracks) ? album.tracks[0] || null : null;
  const previewSource = toCleanString(
    firstTrack?.previewUrl ||
      firstTrack?.previewClipUrl
  );

  if (!previewSource) {
    return null;
  }

  return {
    itemType: "album",
    itemId: String(album._id),
    creatorId: toCleanString(album.creatorId?.toString?.() || album.creatorId || selection.creatorId),
    creatorUserId: selection.creatorUserId || "",
    creatorName: toCleanString(selection.creatorName || album.title),
    creatorUsername: selection.creatorUsername || "",
    creatorAvatar: selection.creatorAvatar || "",
    title: toCleanString(album.title || selection.title),
    coverImage: toCleanString(album.coverUrl || selection.coverImage),
    sourceUrl: previewSource,
    previewStartSec: 0,
    previewLimitSec: clampPreviewLimit(selection.previewLimitSec),
    durationSec: Math.max(0, Number(firstTrack?.duration || selection.durationSec || 0)),
    releaseType: toCleanString(album.releaseType || "album") || "album",
    summaryLabel: "Music",
  };
};

const resolveStoryMusicSelection = async (value) => {
  const selection = normalizeSelection(value);
  if (!selection) {
    return null;
  }

  if (selection.itemType === "track") {
    return resolveTrackAttachment(selection);
  }

  if (selection.itemType === "album") {
    return resolveAlbumAttachment(selection);
  }

  return null;
};

const hydrateStoryMusicAttachment = (attachment = {}, { req, viewerId = "" } = {}) => {
  if (!attachment || typeof attachment !== "object") {
    return null;
  }

  const sourceUrl = toCleanString(attachment.sourceUrl);
  const previewUrl =
    sourceUrl && req
      ? buildSignedMediaUrl({
          sourceUrl,
          itemType: attachment.itemType || "track",
          itemId: attachment.itemId || "",
          userId: viewerId,
          req,
          expiresInSec: 10 * 60,
        })
      : "";

  return {
    itemType: toCleanString(attachment.itemType),
    itemId: toCleanString(attachment.itemId),
    creatorId: toCleanString(attachment.creatorId),
    creatorUserId: toCleanString(attachment.creatorUserId),
    creatorName: toCleanString(attachment.creatorName),
    creatorUsername: toCleanString(attachment.creatorUsername),
    creatorAvatar: toCleanString(attachment.creatorAvatar),
    title: toCleanString(attachment.title),
    coverImage: toCleanString(attachment.coverImage),
    previewStartSec: Math.max(0, Number(attachment.previewStartSec || 0)),
    previewLimitSec: clampPreviewLimit(attachment.previewLimitSec || DEFAULT_PREVIEW_LIMIT),
    durationSec: Math.max(0, Number(attachment.durationSec || 0)),
    releaseType: toCleanString(attachment.releaseType || "music") || "music",
    summaryLabel: toCleanString(attachment.summaryLabel || "Music") || "Music",
    previewUrl,
  };
};

module.exports = {
  hydrateStoryMusicAttachment,
  normalizeStoryMusicSelection,
  resolveStoryMusicSelection,
};
