const CreatorProfile = require("../models/CreatorProfile");
const { hasEntitlement } = require("./entitlementService");
const { resolvePurchasableItem } = require("./catalogService");

const TRACK_MEDIA_ACCESS_TYPES = Object.freeze({
  DOWNLOAD: "download",
  PREVIEW: "preview",
  STREAM: "stream",
});
const MAX_PAID_PREVIEW_SECONDS = 30;
const PREVIEW_DURATION_TOLERANCE_SECONDS = 0.5;

const toText = (value = "") => String(value || "").trim();
const mediaAssetUrl = (asset = null) => toText(asset?.secureUrl || asset?.secure_url || asset?.url || "");
const uniqueUrls = (...values) => new Set(values.flat().map(toText).filter(Boolean));

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

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatTransformNumber = (value = 0) => {
  const normalized = Math.max(0, safeNumber(value, 0));
  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(3).replace(/0+$/g, "").replace(/\.$/g, "");
};

const isCloudinaryMediaUrl = (value = "") =>
  /^https?:\/\/res\.cloudinary\.com\//i.test(toText(value));

const buildCloudinaryBoundedPreviewUrl = ({
  sourceUrl,
  startSec = 0,
  limitSec = MAX_PAID_PREVIEW_SECONDS,
} = {}) => {
  const raw = toText(sourceUrl);
  if (!isCloudinaryMediaUrl(raw)) {
    return "";
  }

  const start = Math.max(0, safeNumber(startSec, 0));
  const duration = Math.max(
    1,
    Math.min(MAX_PAID_PREVIEW_SECONDS, safeNumber(limitSec, MAX_PAID_PREVIEW_SECONDS))
  );

  try {
    const parsed = new URL(raw);
    const marker = "/video/upload/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) {
      return "";
    }

    const prefix = parsed.pathname.slice(0, markerIndex + marker.length);
    const suffix = parsed.pathname.slice(markerIndex + marker.length);
    if (!suffix) {
      return "";
    }

    parsed.pathname = `${prefix}so_${formatTransformNumber(start)},du_${formatTransformNumber(duration)}/${suffix}`;
    return parsed.toString();
  } catch {
    return "";
  }
};

const resolveFullTrackSource = (track = {}) =>
  toText(
    mediaAssetUrl(track.audioMedia)
      || track.audioUrl
      || track.fullAudioUrl
      || mediaAssetUrl(track.videoMedia)
      || track.videoUrl
  );

const resolveDedicatedPreview = (track = {}) => {
  const previewMediaUrl = mediaAssetUrl(track.previewMedia);
  if (previewMediaUrl) {
    return {
      sourceUrl: previewMediaUrl,
      durationSec: safeNumber(track.previewMedia?.duration, 0),
    };
  }

  const previewUrl = toText(track.previewUrl || track.previewSampleUrl);
  if (previewUrl) {
    return { sourceUrl: previewUrl, durationSec: 0 };
  }

  const previewClipMediaUrl = mediaAssetUrl(track.previewClipMedia);
  if (previewClipMediaUrl) {
    return {
      sourceUrl: previewClipMediaUrl,
      durationSec: safeNumber(track.previewClipMedia?.duration, 0),
    };
  }

  const previewClipUrl = toText(track.previewClipUrl);
  return previewClipUrl
    ? { sourceUrl: previewClipUrl, durationSec: 0 }
    : { sourceUrl: "", durationSec: 0 };
};

const resolveDedicatedPreviewSource = (track = {}) => resolveDedicatedPreview(track).sourceUrl;

const isVerifiedShortPreview = ({ durationSec = 0 } = {}) => {
  const duration = safeNumber(durationSec, 0);
  return duration > 0 && duration <= MAX_PAID_PREVIEW_SECONDS + PREVIEW_DURATION_TOLERANCE_SECONDS;
};

const resolveProtectedTrackPreviewSource = (track = {}, { price = 0 } = {}) => {
  const fullSource = resolveFullTrackSource(track);
  const dedicatedPreview = resolveDedicatedPreview(track);
  const dedicatedPreviewSource = dedicatedPreview.sourceUrl;
  const isPaid = Number(price ?? track.price ?? 0) > 0;

  if (!isPaid) {
    return dedicatedPreviewSource || fullSource;
  }

  const previewStartSec = Math.max(0, safeNumber(track.previewStartSec, 0));
  const previewLimitSec = Math.max(
    1,
    Math.min(
      MAX_PAID_PREVIEW_SECONDS,
      safeNumber(track.previewLimitSec, MAX_PAID_PREVIEW_SECONDS)
    )
  );

  if (dedicatedPreviewSource && dedicatedPreviewSource !== fullSource) {
    const boundedCloudinaryPreview = buildCloudinaryBoundedPreviewUrl({
      sourceUrl: dedicatedPreviewSource,
      startSec: previewStartSec,
      limitSec: previewLimitSec,
    });
    if (boundedCloudinaryPreview) {
      return boundedCloudinaryPreview;
    }

    // Non-Cloudinary paid previews cannot be time-bounded by Tengacion's
    // delivery proxy. Only permit them when storage metadata independently
    // proves the preview asset itself is 30 seconds or shorter.
    return isVerifiedShortPreview(dedicatedPreview) ? dedicatedPreviewSource : "";
  }

  if (fullSource) {
    // The paid master may only double as a preview when Cloudinary can create a
    // server-bounded derivative. Never send an unbounded master to an unpaid user.
    return buildCloudinaryBoundedPreviewUrl({
      sourceUrl: fullSource,
      startSec: previewStartSec,
      limitSec: previewLimitSec,
    });
  }

  return "";
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

    const sourceUrl = resolveProtectedTrackPreviewSource(item.payload, { price: item.price });
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

    return { protected: true, accessType, item, sourceUrl, previewOnly: !isFree };
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
    return { protected: true, accessType, item, ownerAccess, paidAccess, sourceUrl };
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
  return { protected: true, accessType, item, ownerAccess, paidAccess, sourceUrl };
};

module.exports = {
  MAX_PAID_PREVIEW_SECONDS,
  TRACK_MEDIA_ACCESS_TYPES,
  authorizeTrackMediaDelivery,
  buildCloudinaryBoundedPreviewUrl,
  resolveDedicatedPreviewSource,
  resolveProtectedTrackPreviewSource,
  resolveTrackSources,
};
