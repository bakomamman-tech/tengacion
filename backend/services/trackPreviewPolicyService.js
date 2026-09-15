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

const resolvePreviewCandidates = (track = {}) => [
  {
    url: mediaAssetUrl(track.previewMedia) || toText(track.previewUrl || track.previewSampleUrl),
    durationSec: Number(track.previewMedia?.duration || 0),
  },
  {
    url: mediaAssetUrl(track.previewClipMedia) || toText(track.previewClipUrl),
    durationSec: Number(track.previewClipMedia?.duration || 0),
  },
].filter((entry) => entry.url);

const resolveSafeTrackPreview = (track = {}) => {
  const isPaid = Number(track.price || 0) > 0;
  const fullSources = resolveFullTrackSources(track);
  const candidate = resolvePreviewCandidates(track).find(
    (entry) => entry.url && !fullSources.has(entry.url)
  );

  if (!candidate) {
    if (!isPaid) {
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

  if (!isPaid) {
    return {
      ok: true,
      sourceUrl: candidate.url,
      durationSec: candidate.durationSec,
      maxDurationSec: 0,
      reason: "",
    };
  }

  // A paid preview must be independently verifiable as a short asset. A
  // frontend playback timer is not security because the browser still receives
  // the entire file. Cloudinary uploads persist their media duration here.
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
