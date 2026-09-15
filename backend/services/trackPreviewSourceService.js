const MAX_PAID_PREVIEW_SECONDS = 30;

const toText = (value = "") => String(value || "").trim();

const mediaAssetUrl = (asset = null) =>
  toText(asset?.secureUrl || asset?.secure_url || asset?.url || "");

const normalizeUrlForCompare = (value = "") => {
  const raw = toText(value);
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw, "https://tengacion.invalid");
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return raw;
  }
};

const sameSource = (left, right) => {
  const normalizedLeft = normalizeUrlForCompare(left);
  const normalizedRight = normalizeUrlForCompare(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const isCloudinaryMediaUrl = (value = "") =>
  /^https?:\/\/res\.cloudinary\.com\//i.test(toText(value));

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

    const transformation = `so_${formatTransformNumber(start)},du_${formatTransformNumber(duration)}`;
    parsed.pathname = `${prefix}${transformation}/${suffix}`;
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

const resolveDedicatedPreviewSource = (track = {}) =>
  toText(
    mediaAssetUrl(track.previewMedia)
      || track.previewUrl
      || track.previewSampleUrl
      || mediaAssetUrl(track.previewClipMedia)
      || track.previewClipUrl
  );

const resolveProtectedTrackPreviewSource = (track = {}, { price = 0 } = {}) => {
  const fullSource = resolveFullTrackSource(track);
  const dedicatedPreview = resolveDedicatedPreviewSource(track);
  const isPaid = Number(price ?? track.price ?? 0) > 0;

  if (!isPaid) {
    return dedicatedPreview || fullSource;
  }

  const previewStartSec = Math.max(0, safeNumber(track.previewStartSec, 0));
  const previewLimitSec = Math.max(
    1,
    Math.min(
      MAX_PAID_PREVIEW_SECONDS,
      safeNumber(track.previewLimitSec, MAX_PAID_PREVIEW_SECONDS)
    )
  );

  if (dedicatedPreview && !sameSource(dedicatedPreview, fullSource)) {
    return (
      buildCloudinaryBoundedPreviewUrl({
        sourceUrl: dedicatedPreview,
        startSec: previewStartSec,
        limitSec: previewLimitSec,
      }) || dedicatedPreview
    );
  }

  if (fullSource) {
    return buildCloudinaryBoundedPreviewUrl({
      sourceUrl: fullSource,
      startSec: previewStartSec,
      limitSec: previewLimitSec,
    });
  }

  return "";
};

module.exports = {
  MAX_PAID_PREVIEW_SECONDS,
  buildCloudinaryBoundedPreviewUrl,
  resolveDedicatedPreviewSource,
  resolveFullTrackSource,
  resolveProtectedTrackPreviewSource,
  sameSource,
};
