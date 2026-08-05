const path = require("path");

const AUDIO_FORMATS = {
  aac: { extension: ".aac", contentType: "audio/aac" },
  flac: { extension: ".flac", contentType: "audio/flac" },
  m4a: { extension: ".m4a", contentType: "audio/mp4" },
  mp3: { extension: ".mp3", contentType: "audio/mpeg" },
  oga: { extension: ".oga", contentType: "audio/ogg" },
  ogg: { extension: ".ogg", contentType: "audio/ogg" },
  opus: { extension: ".opus", contentType: "audio/opus" },
  wav: { extension: ".wav", contentType: "audio/wav" },
  webm: { extension: ".webm", contentType: "audio/webm" },
};

const toText = (value = "") => String(value || "").trim();

const sanitizeTrackFilename = (value = "", fallback = "song") => {
  const filename = path.basename(toText(value || fallback))
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (filename || fallback).slice(0, 180);
};

const resolveTrackFormat = (track = {}) => {
  const media = track.audioMedia || {};
  const originalFilename = toText(media.originalFilename);
  const extension = path.extname(originalFilename).replace(/^\./, "").toLowerCase();
  const candidates = [extension, media.format, track.audioFormat]
    .map((value) => toText(value).replace(/^\./, "").toLowerCase())
    .filter(Boolean);
  return candidates.find((value) => AUDIO_FORMATS[value]) || "mp3";
};

const resolveTrackDownloadMetadata = (track = {}) => {
  const media = track.audioMedia || {};
  const format = resolveTrackFormat(track);
  const formatMetadata = AUDIO_FORMATS[format] || AUDIO_FORMATS.mp3;
  const originalFilename = toText(media.originalFilename);

  // The upload name is authoritative. Only legacy records without one receive
  // a single inferred extension so browsers can store a usable audio file.
  const filename = originalFilename
    ? sanitizeTrackFilename(originalFilename)
    : `${sanitizeTrackFilename(track.title || "song")}${formatMetadata.extension}`;

  return {
    filename,
    contentType: formatMetadata.contentType,
  };
};

module.exports = {
  resolveTrackDownloadMetadata,
  resolveTrackFormat,
  sanitizeTrackFilename,
};
