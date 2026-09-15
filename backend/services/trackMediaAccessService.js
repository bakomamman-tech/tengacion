const CreatorProfile = require("../models/CreatorProfile");
const { hasEntitlement } = require("./entitlementService");
const { resolvePurchasableItem } = require("./catalogService");
const {
  resolveFullTrackSource,
  resolveProtectedTrackPreviewSource,
} = require("./trackPreviewSourceService");

const TRACK_MEDIA_ACCESS_TYPES = Object.freeze({
  DOWNLOAD: "download",
  PREVIEW: "preview",
  STREAM: "stream",
});

const toText = (value = "") => String(value || "").trim();

const mediaAssetUrl = (asset = null) =>
  toText(asset?.secureUrl || asset?.secure_url || asset?.url || "");

const uniqueUrls = (...values) =>
  new Set(values.flat().map(toText).filter(Boolean));

const resolveTrackSources = (track = {}) => ({
  full: uniqueUrls(
    mediaAssetUrl(track.audioMedia),
    track.audioUrl,
    track.fullAudioUrl,
    mediaAssetUrl(track.videoMedia),
    track.videoUrl
  ),
  preview: uniqueUrls(
    mediaAssetUrl(track.previewMedia),
    track.previewUrl,
    track.previewSampleUrl,
    mediaAssetUrl(track.previewClipMedia),
    track.previewClipUrl
  ),
});

const isTrackItemType = (value = "") =>
  ["track", "song", "podcast"].includes(toText(value).toLowerCase());

const deny = (message) => {
  const error = new Error(message);
  error.status = 403;
  throw error;
};

const hasOwnerAccess = async ({ userId, creatorId }) => {
  if (!userId || !creatorId) {
    return false;
  }

  const creator = await CreatorProfile.findById(creatorId).select("userId").lean();
  return String(creator?.userId || "") === String(userId);
};

const resolveFullSourceForDelivery = (item = {}) => {
  const sourceUrl = resolveFullTrackSource(item.payload || {});
  if (!sourceUrl) {
    deny("Full-song media is unavailable");
  }
  return sourceUrl;
};

const authorizeTrackMediaDelivery = async (payload = {}) => {
  if (!isTrackItemType(payload.itemType)) {
    return { protected: false };
  }

  const accessType = toText(payload.accessType).toLowerCase();
  if (!Object.values(TRACK_MEDIA_ACCESS_TYPES).includes(accessType)) {
    deny("Track media link is no longer valid");
  }

  const item = await resolvePurchasableItem("track", payload.itemId);
  if (!item) {
    deny("Track is unavailable");
  }

  const isFree = Number(item.price || 0) <= 0;

  if (accessType === TRACK_MEDIA_ACCESS_TYPES.PREVIEW) {
    if (payload.dl) {
      deny("Preview links cannot be used for downloads");
    }

    const sourceUrl = resolveProtectedTrackPreviewSource(item.payload, {
      price: item.price,
    });

    if (!sourceUrl) {
      deny(
        isFree
          ? "Track preview is unavailable"
          : "This paid song does not yet have a protected 30-second preview"
      );
    }

    payload.src = sourceUrl;
    payload.disposition = "inline";
    payload.dl = false;

    return {
      protected: true,
      accessType,
      item,
      sourceUrl,
      previewOnly: !isFree,
    };
  }

  const sourceUrl = resolveFullSourceForDelivery(item);
  const sources = resolveTrackSources(item.payload);
  const legacySourceUrl = toText(payload.src);

  if (legacySourceUrl && !sources.full.has(legacySourceUrl)) {
    deny("Full-song access requires the current original track source");
  }

  const userId = toText(payload.uid);
  const ownerAccess = await hasOwnerAccess({
    userId,
    creatorId: item.creatorId || item.payload?.creatorId,
  });
  const paidAccess = userId
    ? await hasEntitlement({
        userId,
        itemType: "track",
        itemId: item.itemId,
        creatorId: item.creatorId || item.payload?.creatorId,
      })
    : false;

  if (accessType === TRACK_MEDIA_ACCESS_TYPES.DOWNLOAD) {
    if (!payload.dl || (!ownerAccess && !paidAccess)) {
      deny("A verified purchase is required to download this song");
    }

    payload.src = sourceUrl;
    payload.disposition = "attachment";

    return {
      protected: true,
      accessType,
      item,
      ownerAccess,
      paidAccess,
      sourceUrl,
    };
  }

  if (payload.dl) {
    deny("Playback links cannot be used for downloads");
  }
  if (!isFree && !ownerAccess && !paidAccess) {
    deny("A verified purchase is required to play the full song");
  }

  payload.src = sourceUrl;
  payload.disposition = "inline";
  payload.dl = false;

  return {
    protected: true,
    accessType,
    item,
    ownerAccess,
    paidAccess,
    sourceUrl,
  };
};

module.exports = {
  TRACK_MEDIA_ACCESS_TYPES,
  authorizeTrackMediaDelivery,
  resolveTrackSources,
};
