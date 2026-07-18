const Album = require("../models/Album");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const { buildSignedMediaUrl } = require("./mediaSigner");
const { normalizeMediaValue, sanitizeLegacyMediaFieldsForNewWrite } = require("../utils/userMedia");
const { createPublicModerationFilter } = require("../utils/publicModeration");

const ACTIVE_TRACK_FILTER = { isPublished: { $ne: false }, archivedAt: null, ...createPublicModerationFilter() };
const ACTIVE_ALBUM_FILTER = { status: "published", isPublished: { $ne: false }, archivedAt: null, ...createPublicModerationFilter() };
const MUSIC_ITEM_TYPES = new Set(["track", "album"]);
const DEFAULT_PREVIEW_LIMIT = 30;
const REGISTERED_MUSIC_CREATOR_FILTER = {
  isCreator: true,
  status: "active",
  creatorTypes: "music",
  $or: [{ onboardingComplete: true }, { onboardingCompleted: true }],
};

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

const isRegisteredMusicCreator = async (creatorId) => {
  if (!creatorId) {
    return false;
  }
  return Boolean(
    await CreatorProfile.exists({
      _id: creatorId,
      ...REGISTERED_MUSIC_CREATOR_FILTER,
    })
  );
};

const resolveTrackAttachment = async (selection, { sanitizeForWrite = true } = {}) => {
  const track = await Track.findOne({ _id: selection.itemId, ...ACTIVE_TRACK_FILTER }).lean();
  if (!track) {
    return null;
  }

  if (!(await isRegisteredMusicCreator(track.creatorId))) {
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

  const attachment = {
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

  if (sanitizeForWrite) {
    sanitizeLegacyMediaFieldsForNewWrite(attachment, {
      clearLegacyStringPaths: ["creatorAvatar", "coverImage", "sourceUrl"],
    });
  }

  return attachment;
};

const escapeRegExp = (value = "") =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildStoryMusicCatalog = async ({ req, viewerId = "", page = 1, limit = 30, search = "" } = {}) => {
  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.max(1, Math.min(50, Number.parseInt(limit, 10) || 30));
  const query = toCleanString(search).slice(0, 80);

  const creators = await CreatorProfile.find(REGISTERED_MUSIC_CREATOR_FILTER)
    .select("displayName fullName coverImageUrl heroBannerUrl userId")
    .populate("userId", "name username avatar")
    .lean();
  const creatorIds = creators.map((creator) => creator._id);
  const creatorById = new Map(creators.map((creator) => [String(creator._id), creator]));

  if (!creatorIds.length) {
    return { page: pageNumber, limit: pageSize, total: 0, hasMore: false, items: [] };
  }

  const trackMatch = {
    ...ACTIVE_TRACK_FILTER,
    kind: "music",
    creatorId: { $in: creatorIds },
    $or: [
      { previewUrl: { $exists: true, $type: "string", $ne: "" } },
      { previewSampleUrl: { $exists: true, $type: "string", $ne: "" } },
      { previewClipUrl: { $exists: true, $type: "string", $ne: "" } },
    ],
  };

  if (query) {
    const pattern = new RegExp(escapeRegExp(query), "i");
    const matchingCreatorIds = creators
      .filter((creator) =>
        [
          creator.displayName,
          creator.fullName,
          creator.userId?.name,
          creator.userId?.username,
        ].some((value) => pattern.test(String(value || "")))
      )
      .map((creator) => creator._id);

    trackMatch.$and = [{
      $or: [
        { title: pattern },
        { artistName: pattern },
        { genre: pattern },
        { description: pattern },
        ...(matchingCreatorIds.length ? [{ creatorId: { $in: matchingCreatorIds } }] : []),
      ],
    }];
  }

  const [total, tracks] = await Promise.all([
    Track.countDocuments(trackMatch),
    Track.find(trackMatch)
      .sort({ createdAt: -1, updatedAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  const items = tracks.map((track) => {
    const creator = creatorById.get(String(track.creatorId)) || {};
    const creatorUser = creator.userId || {};
    const itemId = String(track._id || "");
    const previewSource = toCleanString(
      track.previewUrl || track.previewSampleUrl || track.previewClipUrl
    );
    const previewUrl = buildSignedMediaUrl({
      sourceUrl: previewSource,
      itemType: "track",
      itemId,
      userId: viewerId,
      req,
      expiresInSec: 10 * 60,
    });

    return {
      id: itemId,
      contentId: itemId,
      itemType: "track",
      feedItemType: "track",
      creatorId: String(creator._id || track.creatorId || ""),
      creatorUserId: String(creatorUser._id || ""),
      creatorName: toCleanString(
        creator.displayName || creator.fullName || creatorUser.name || track.artistName || "Tengacion creator"
      ),
      creatorUsername: toCleanString(creatorUser.username),
      creatorAvatar: toCleanString(
        creator.coverImageUrl || creator.heroBannerUrl || normalizeMediaValue(creatorUser.avatar).url
      ),
      title: toCleanString(track.title || "Untitled song"),
      coverImage: toCleanString(track.coverImageUrl || track.coverUrl || creator.coverImageUrl),
      previewUrl,
      previewAudioUrl: previewUrl,
      previewStartSec: Math.max(0, Number(track.previewStartSec || 0)),
      previewLimitSec: clampPreviewLimit(track.previewLimitSec || DEFAULT_PREVIEW_LIMIT),
      durationSec: Math.max(0, Number(track.durationSec || 0)),
      summaryLabel: "Song",
      createdAt: track.createdAt || track.updatedAt || null,
    };
  });

  return {
    page: pageNumber,
    limit: pageSize,
    total,
    hasMore: pageNumber * pageSize < total,
    items,
  };
};

const resolveAlbumAttachment = async (selection, { sanitizeForWrite = true } = {}) => {
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

  const attachment = {
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

  if (sanitizeForWrite) {
    sanitizeLegacyMediaFieldsForNewWrite(attachment, {
      clearLegacyStringPaths: ["creatorAvatar", "coverImage", "sourceUrl"],
    });
  }

  return attachment;
};

const resolveStoryMusicSelection = async (value, { sanitizeForWrite = true } = {}) => {
  const selection = normalizeSelection(value);
  if (!selection) {
    return null;
  }

  if (selection.itemType === "track") {
    return resolveTrackAttachment(selection, { sanitizeForWrite });
  }

  if (selection.itemType === "album") {
    return resolveAlbumAttachment(selection, { sanitizeForWrite });
  }

  return null;
};

const hydrateStoryMusicAttachment = async (attachment = {}, { req, viewerId = "" } = {}) => {
  if (!attachment || typeof attachment !== "object") {
    return null;
  }

  const liveAttachment =
    (!toCleanString(attachment.sourceUrl) || !toCleanString(attachment.coverImage))
      ? await resolveStoryMusicSelection(attachment, { sanitizeForWrite: false })
      : null;
  const effectiveAttachment = liveAttachment || attachment;

  const sourceUrl = toCleanString(effectiveAttachment.sourceUrl || attachment.sourceUrl);
  const previewUrl =
    sourceUrl && req
      ? buildSignedMediaUrl({
          sourceUrl,
          itemType: effectiveAttachment.itemType || attachment.itemType || "track",
          itemId: effectiveAttachment.itemId || attachment.itemId || "",
          userId: viewerId,
          req,
          expiresInSec: 10 * 60,
        })
      : "";

  return {
    itemType: toCleanString(effectiveAttachment.itemType || attachment.itemType),
    itemId: toCleanString(effectiveAttachment.itemId || attachment.itemId),
    creatorId: toCleanString(effectiveAttachment.creatorId || attachment.creatorId),
    creatorUserId: toCleanString(effectiveAttachment.creatorUserId || attachment.creatorUserId),
    creatorName: toCleanString(effectiveAttachment.creatorName || attachment.creatorName),
    creatorUsername: toCleanString(effectiveAttachment.creatorUsername || attachment.creatorUsername),
    creatorAvatar: toCleanString(effectiveAttachment.creatorAvatar || attachment.creatorAvatar),
    title: toCleanString(effectiveAttachment.title || attachment.title),
    coverImage: toCleanString(effectiveAttachment.coverImage || attachment.coverImage),
    previewStartSec: Math.max(0, Number(effectiveAttachment.previewStartSec || attachment.previewStartSec || 0)),
    previewLimitSec: clampPreviewLimit(
      effectiveAttachment.previewLimitSec || attachment.previewLimitSec || DEFAULT_PREVIEW_LIMIT
    ),
    durationSec: Math.max(0, Number(effectiveAttachment.durationSec || attachment.durationSec || 0)),
    releaseType: toCleanString(effectiveAttachment.releaseType || attachment.releaseType || "music") || "music",
    summaryLabel: toCleanString(effectiveAttachment.summaryLabel || attachment.summaryLabel || "Music") || "Music",
    previewUrl,
  };
};

module.exports = {
  buildStoryMusicCatalog,
  hydrateStoryMusicAttachment,
  normalizeStoryMusicSelection,
  resolveStoryMusicSelection,
};
