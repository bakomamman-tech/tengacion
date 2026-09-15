const MAX_PAID_TRACK_PREVIEW_SECONDS = 30;
const PREVIEW_DURATION_TOLERANCE_SECONDS = 0.5;

const toText = (value = "") => String(value || "").trim();

const mediaAssetUrl = (asset = null) =>
  toText(asset?.secureUrl || asset?.secure_url || asset?.url || "");

const resolveFullTrackSources = (track = {}) =>
  new Set([
    mediaAssetUrl(track.audioMedia),
    track.audioUrl,
    track.fullAudioUrl,
    mediaAssetUrl(track.videoMedia),
    track.videoUrl,
  ].map(toText).filter(Boolean));

const resolvePreviewCandidates = (track = {}) => {
  const candidates = [];
  const seen = new Set();
  const add = (url, durationSec = 0) => {
    const normalizedUrl = toText(url);
    if (!normalizedUrl || seen.has(normalizedUrl)) return;
    seen.add(normalizedUrl);
    candidates.push({
      url: normalizedUrl,
      durationSec: Number(durationSec || 0),
    });
  };

  const previewMediaUrl = mediaAssetUrl(track.previewMedia);
  const previewClipMediaUrl = mediaAssetUrl(track.previewClipMedia);
  add(previewMediaUrl, track.previewMedia?.duration);
  add(track.previewUrl, previewMediaUrl === toText(track.previewUrl) ? track.previewMedia?.duration : 0);
  add(track.previewSampleUrl, previewMediaUrl === toText(track.previewSampleUrl) ? track.previewMedia?.duration : 0);
  add(previewClipMediaUrl, track.previewClipMedia?.duration);
  add(track.previewClipUrl, previewClipMediaUrl === toText(track.previewClipUrl) ? track.previewClipMedia?.duration : 0);

  return candidates;
};

const resolveSafeTrackPreview = (track = {}) => {
  const numericPrice = Number(track.price);
  const isExplicitlyFree = Number.isFinite(numericPrice) && numericPrice === 0;
  const requiresShortPreview = !isExplicitlyFree;
  const fullSources = resolveFullTrackSources(track);
  const candidate = resolvePreviewCandidates(track).find(
    (entry) => entry.url && !fullSources.has(entry.url)
  );

  if (!candidate) {
    if (isExplicitlyFree) {
      const fullUrl = [...fullSources][0] || "";
      return {
        ok: Boolean(fullUrl),
        sourceUrl: fullUrl,
        durationSec: Number(track.durationSec || 0),
        maxDurationSec: 0,
        reason: fullUrl ? "" : "Track media is unavailable",
      };
    }
    return {
      ok: false,
      sourceUrl: "",
      durationSec: 0,
      maxDurationSec: MAX_PAID_TRACK_PREVIEW_SECONDS,
      reason: "A separate 30-second preview is required for paid tracks",
    };
  }

  if (!requiresShortPreview) {
    return {
      ok: true,
      sourceUrl: candidate.url,
      durationSec: candidate.durationSec,
      maxDurationSec: 0,
      reason: "",
    };
  }

  // A paid/unknown-price preview must be independently verifiable as a short
  // asset. A frontend playback timer is not security because the browser still
  // receives the entire file. Cloudinary uploads persist their duration here.
  if (!Number.isFinite(candidate.durationSec) || candidate.durationSec <= 0) {
    return {
      ok: false,
      sourceUrl: "",
      durationSec: candidate.durationSec || 0,
      maxDurationSec: MAX_PAID_TRACK_PREVIEW_SECONDS,
      reason: "Paid preview duration could not be verified",
    };
  }

  if (candidate.durationSec > MAX_PAID_TRACK_PREVIEW_SECONDS + PREVIEW_DURATION_TOLERANCE_SECONDS) {
    return {
      ok: false,
      sourceUrl: "",
      durationSec: candidate.durationSec,
      maxDurationSec: MAX_PAID_TRACK_PREVIEW_SECONDS,
      reason: "Paid previews must be 30 seconds or shorter",
    };
  }

  return {
    ok: true,
    sourceUrl: candidate.url,
    durationSec: candidate.durationSec,
    maxDurationSec: MAX_PAID_TRACK_PREVIEW_SECONDS,
    reason: "",
  };
};

const resolveFullTrackSource = (track = {}) => [...resolveFullTrackSources(track)][0] || "";

module.exports = {
  MAX_PAID_TRACK_PREVIEW_SECONDS,
  resolveFullTrackSource,
  resolveFullTrackSources,
  resolveSafeTrackPreview,
};
