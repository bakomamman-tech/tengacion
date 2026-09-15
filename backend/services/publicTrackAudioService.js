const { mediaDocumentToUrl } = require("../utils/cloudinaryMedia");

// Feed audio is public for every viewer, including creators and paying buyers.
function buildPublicTrackAudio(track = {}) {
  const price = typeof track.price === "number" && Number.isFinite(track.price) ? track.price : null;
  const fullSources = new Set([
    mediaDocumentToUrl(track.audioMedia, track.audioUrl || track.fullAudioUrl || ""),
    track.audioUrl, track.fullAudioUrl, track.videoUrl, mediaDocumentToUrl(track.videoMedia, ""),
  ].filter(Boolean));
  const fullUrl = [...fullSources][0] || "";
  const previewCandidate = mediaDocumentToUrl(track.previewMedia, track.previewUrl || track.previewSampleUrl || "") || mediaDocumentToUrl(track.previewClipMedia, track.previewClipUrl || "");
  const previewUrl = fullSources.has(previewCandidate) ? "" : previewCandidate;
  return {
    trackId: track._id || track.trackId,
    url: price === 0 ? fullUrl : previewUrl,
    previewUrl,
    price,
    title: track.title || "",
    durationSec: Number.isFinite(track.durationSec) ? track.durationSec : 0,
    coverImageUrl: mediaDocumentToUrl(track.coverMedia, track.coverImageUrl || ""),
  };
}

// Rebuild legacy feed audio from canonical track data, never stale post URLs.
async function sanitizePublicPostAudio(result) {
  const posts = (Array.isArray(result) ? result : [result]).filter(post => post?.audio?.trackId);
  if (!posts.length) return;
  const Track = require("../models/Track");
  const ids = [...new Set(posts.map(post => String(post.audio.trackId)))];
  const tracks = await Track.find({_id: {$in: ids}})
    .select("price title durationSec coverMedia coverImageUrl audioMedia audioUrl fullAudioUrl videoUrl videoMedia previewMedia previewUrl previewSampleUrl previewClipMedia previewClipUrl isPublished publishedStatus archivedAt")
    .lean();
  const byId = new Map(tracks.map(track => [String(track._id), track]));
  for (const post of posts) {
    const track = byId.get(String(post.audio.trackId));
    const unavailable = !track || track.isPublished === false || track.archivedAt || ["draft", "under_review", "blocked"].includes(track.publishedStatus);
    post.audio = unavailable
      ? {trackId: post.audio.trackId, title: post.audio.title || "", url: "", previewUrl: "", price: null}
      : buildPublicTrackAudio(track);
  }
}
module.exports = {buildPublicTrackAudio, sanitizePublicPostAudio};
