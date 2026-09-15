const CreatorProfile = require("../models/CreatorProfile");
const { hasEntitlement } = require("./entitlementService");
const { resolvePurchasableItem } = require("./catalogService");
const {
  resolveFullTrackSource,
  resolveSafeTrackPreview,
} = require("./trackPreviewPolicyService");

const TRACK_MEDIA_ACCESS_TYPES = Object.freeze({
  DOWNLOAD: "download",
  PREVIEW: "preview",
  STREAM: "stream",
});

const toText = (value = "") => String(value || "").trim();

const isTrackItemType = (value = "") =>
  ["track", "song", "podcast"].includes(toText(value).toLowerCase());

const deny = (message, status = 403) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const hasOwnerAccess = async ({ userId, creatorId }) => {
  if (!userId || !creatorId) {
    return false;
  }

  const creator = await CreatorProfile.findById(creatorId).select("userId").lean();
  return String(creator?.userId || "") === String(userId);
};

const attachAuthorizedSource = (payload, sourceUrl) => {
  // This mutation happens only after signature verification and entitlement
  // checks. It keeps the physical storage URL off the client-visible token while
  // preserving compatibility with the existing media delivery route.
  payload.src = sourceUrl;
  return sourceUrl;
};

const authorizeTrackMediaDelivery = async (payload = {}) => {
  if (!isTrackItemType(payload.itemType)) {
    return {
      protected: false,
      sourceUrl: toText(payload.src),
    };
  }

  const accessType = toText(payload.accessType).toLowerCase();
  if (!Object.values(TRACK_MEDIA_ACCESS_TYPES).includes(accessType)) {
    deny("Track media link is no longer valid");
  }

  const item = await resolvePurchasableItem("track", payload.itemId);
  if (!item) {
    deny("Track is unavailable", 404);
  }

  const track = item.payload || {};
  const unavailable =
    track.isPublished === false ||
    Boolean(track.archivedAt) ||
    ["draft", "under_review", "blocked"].includes(
      toText(track.publishedStatus).toLowerCase()
    );
  if (unavailable) {
    deny("Track is unavailable", 404);
  }

  if (accessType === TRACK_MEDIA_ACCESS_TYPES.PREVIEW) {
    if (payload.dl) {
      deny("Preview links cannot be used for downloads");
    }

    const preview = resolveSafeTrackPreview(track);
    if (!preview.ok || !preview.sourceUrl) {
      deny(preview.reason || "Track preview is unavailable", 404);
    }

    attachAuthorizedSource(payload, preview.sourceUrl);
    return {
      protected: true,
      accessType,
      item,
      sourceUrl: preview.sourceUrl,
      previewDurationSec: preview.durationSec,
      previewLimitSec: preview.maxDurationSec,
    };
  }

  const fullSourceUrl = resolveFullTrackSource(track);
  if (!fullSourceUrl) {
    deny("Full track media is unavailable", 404);
  }

  const userId = toText(payload.uid);
  const ownerAccess = await hasOwnerAccess({
    userId,
    creatorId: item.creatorId || track.creatorId,
  });
  const paidAccess = userId
    ? await hasEntitlement({
        userId,
        itemType: "track",
        itemId: item.itemId,
        creatorId: item.creatorId || track.creatorId,
      })
    : false;
  const numericPrice = Number(track.price);
  const isFree = Number.isFinite(numericPrice) && numericPrice === 0;

  if (accessType === TRACK_MEDIA_ACCESS_TYPES.DOWNLOAD) {
    if (!payload.dl || (!ownerAccess && !paidAccess)) {
      deny("A verified purchase is required to download this song");
    }
    attachAuthorizedSource(payload, fullSourceUrl);
    return {
      protected: true,
      accessType,
      item,
      ownerAccess,
      paidAccess,
      sourceUrl: fullSourceUrl,
    };
  }

  if (payload.dl) {
    deny("Playback links cannot be used for downloads");
  }
  if (!isFree && !ownerAccess && !paidAccess) {
    deny("A verified purchase is required to play the full song");
  }

  attachAuthorizedSource(payload, fullSourceUrl);
  return {
    protected: true,
    accessType,
    item,
    ownerAccess,
    paidAccess,
    sourceUrl: fullSourceUrl,
  };
};

module.exports = {
  TRACK_MEDIA_ACCESS_TYPES,
  authorizeTrackMediaDelivery,
};
