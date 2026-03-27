const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const upload = require("../utils/upload");

const PERMANENT_MEDIA_DIR = path.join(upload.uploadDir, "media");
const PERMANENT_MEDIA_URL_PREFIX = "/uploads/media";

const ensurePermanentMediaDir = async () => {
  await fs.promises.mkdir(PERMANENT_MEDIA_DIR, { recursive: true });
  return PERMANENT_MEDIA_DIR;
};

const toSafeFilename = (value = "", fallback = "media") => {
  const base = String(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = base || fallback;
  return normalized.slice(0, 180);
};

const inferContentTypeFromName = (filename = "") => {
  const lower = String(filename || "").toLowerCase();
  if (/\.(mp4|m4v)$/i.test(lower)) return "video/mp4";
  if (/\.webm$/i.test(lower)) return "video/webm";
  if (/\.ogg$/i.test(lower)) return "video/ogg";
  if (/\.mov$/i.test(lower)) return "video/quicktime";
  if (/\.avi$/i.test(lower)) return "video/x-msvideo";
  if (/\.mkv$/i.test(lower)) return "video/x-matroska";
  if (/\.png$/i.test(lower)) return "image/png";
  if (/\.(jpg|jpeg)$/i.test(lower)) return "image/jpeg";
  if (/\.gif$/i.test(lower)) return "image/gif";
  if (/\.webp$/i.test(lower)) return "image/webp";
  if (/\.bmp$/i.test(lower)) return "image/bmp";
  if (/\.svg$/i.test(lower)) return "image/svg+xml";
  if (/\.avif$/i.test(lower)) return "image/avif";
  if (/\.mp3$/i.test(lower)) return "audio/mpeg";
  if (/\.wav$/i.test(lower)) return "audio/wav";
  if (/\.pdf$/i.test(lower)) return "application/pdf";
  if (/\.epub$/i.test(lower)) return "application/epub+zip";
  if (/\.mobi$/i.test(lower)) return "application/x-mobipocket-ebook";
  if (/\.txt$/i.test(lower)) return "text/plain; charset=utf-8";
  return "application/octet-stream";
};

const extensionFromContentType = (contentType = "") => {
  const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
  const map = {
    "application/epub+zip": ".epub",
    "application/json": ".json",
    "application/pdf": ".pdf",
    "application/x-mobipocket-ebook": ".mobi",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/wave": ".wav",
    "audio/webm": ".webm",
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
    "text/plain": ".txt",
    "text/plain; charset=utf-8": ".txt",
    "video/mp4": ".mp4",
    "video/ogg": ".ogg",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/x-matroska": ".mkv",
    "video/x-msvideo": ".avi",
  };

  return map[normalized] || "";
};

const buildPermanentMediaFilename = ({ originalName = "", contentType = "" } = {}) => {
  const safeOriginal = toSafeFilename(originalName || "media");
  const parsedExt = path.extname(safeOriginal);
  const inferredExt = parsedExt || extensionFromContentType(contentType) || "";
  const stem = toSafeFilename(path.basename(safeOriginal, parsedExt), "media");
  const uniquePrefix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return `${uniquePrefix}-${stem}${inferredExt}`;
};

const buildPermanentMediaUrl = (filename = "") =>
  `${PERMANENT_MEDIA_URL_PREFIX}/${encodeURIComponent(String(filename || "").trim())}`;

const buildPermanentMediaPublicId = (filename = "") => `media/${String(filename || "").trim()}`;

const resolvePermanentMediaPath = (source = "") => {
  const raw = String(source || "").trim();
  if (!raw) {
    return "";
  }

  const parsePath = (candidate = "") => {
    const normalized = String(candidate || "").trim().replace(/^\/+/, "");
    if (!normalized) {
      return "";
    }

    const decoded = normalized
      .split("/")
      .map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch {
          return segment;
        }
      })
      .join(path.sep);

    const resolved = path.resolve(path.join(PERMANENT_MEDIA_DIR, decoded.replace(/^media[\\/]/i, "")));
    const root = path.resolve(PERMANENT_MEDIA_DIR);
    if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) {
      return "";
    }
    return resolved;
  };

  if (raw.startsWith(PERMANENT_MEDIA_URL_PREFIX)) {
    return parsePath(raw.slice(PERMANENT_MEDIA_URL_PREFIX.length));
  }

  if (raw.startsWith("media/") || raw.startsWith("media\\")) {
    return parsePath(raw);
  }

  if (path.isAbsolute(raw)) {
    const resolved = path.resolve(raw);
    const root = path.resolve(PERMANENT_MEDIA_DIR);
    if (resolved.startsWith(`${root}${path.sep}`) || resolved === root) {
      return resolved;
    }
    return "";
  }

  try {
    const parsed = new URL(raw);
    const pathname = String(parsed.pathname || "");
    if (pathname.startsWith(PERMANENT_MEDIA_URL_PREFIX)) {
      return parsePath(pathname.slice(PERMANENT_MEDIA_URL_PREFIX.length));
    }
  } catch {
    // Relative URLs are handled below.
  }

  if (raw.startsWith("/")) {
    return parsePath(raw);
  }

  return "";
};

module.exports = {
  PERMANENT_MEDIA_DIR,
  PERMANENT_MEDIA_URL_PREFIX,
  buildPermanentMediaFilename,
  buildPermanentMediaPublicId,
  buildPermanentMediaUrl,
  ensurePermanentMediaDir,
  extensionFromContentType,
  inferContentTypeFromName,
  resolvePermanentMediaPath,
  toSafeFilename,
};
