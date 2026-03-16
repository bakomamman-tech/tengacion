const path = require("path");
const { Readable } = require("stream");
const mongoose = require("mongoose");

const { getBucket, bucketName } = require("./mediaStore");

const MEDIA_ID_PATTERN = /\/api\/media\/([a-f0-9]{24})(?:$|[/?#])/i;

const toSafeLength = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value && typeof value === "object" && typeof value.toNumber === "function") {
    const converted = value.toNumber();
    if (Number.isFinite(converted)) {
      return converted;
    }
  }

  const raw = value && typeof value.toString === "function" ? value.toString() : "";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const inferContentTypeFromFilename = (filename = "") => {
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

const CONTENT_TYPE_EXTENSION_MAP = {
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

const sanitizeFilename = (value = "", fallback = "media") => {
  const base = String(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = base || fallback;
  return normalized.slice(0, 180);
};

const extensionFromContentType = (contentType = "") => {
  const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
  return CONTENT_TYPE_EXTENSION_MAP[normalized] || "";
};

const extractMediaObjectId = (sourceUrl = "") => {
  const raw = String(sourceUrl || "").trim();
  if (!raw) {
    return null;
  }

  const directMatch = raw.match(MEDIA_ID_PATTERN);
  if (directMatch?.[1] && mongoose.Types.ObjectId.isValid(directMatch[1])) {
    return new mongoose.Types.ObjectId(directMatch[1]);
  }

  try {
    const parsed = new URL(raw, "http://localhost");
    const nestedMatch = parsed.pathname.match(MEDIA_ID_PATTERN);
    if (nestedMatch?.[1] && mongoose.Types.ObjectId.isValid(nestedMatch[1])) {
      return new mongoose.Types.ObjectId(nestedMatch[1]);
    }
  } catch {
    return null;
  }

  return null;
};

const parseRange = (rangeHeader, fileSize) => {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
    return null;
  }

  const value = rangeHeader.replace("bytes=", "");
  if (value.includes(",")) {
    return null;
  }

  const [startRaw, endRaw] = value.split("-");
  const hasStart = startRaw !== undefined && startRaw !== "";
  const hasEnd = endRaw !== undefined && endRaw !== "";

  let start = 0;
  let end = fileSize - 1;

  if (hasStart) {
    start = Number.parseInt(startRaw, 10);
    end = hasEnd ? Number.parseInt(endRaw, 10) : fileSize - 1;
  } else if (hasEnd) {
    const suffixLength = Number.parseInt(endRaw, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    return null;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  if (start < 0 || end < start || start >= fileSize) {
    return null;
  }

  return { start, end: Math.min(end, fileSize - 1) };
};

const getMediaFileDoc = async (objectId) => {
  const filesCollection = mongoose.connection.db.collection(`${bucketName}.files`);
  return filesCollection.findOne({ _id: objectId });
};

const resolveFilenameFromFileDoc = (fileDoc = {}) =>
  sanitizeFilename(fileDoc?.metadata?.originalName || fileDoc?.filename || "media");

const setResponseHeaders = ({
  res,
  fileSize,
  mimeType,
  filename,
  disposition = "inline",
  cacheControl = "public, max-age=31536000, immutable",
  acceptRanges = true,
  contentRange = "",
  passthroughStatus = 200,
}) => {
  if (acceptRanges) {
    res.setHeader("Accept-Ranges", "bytes");
  }
  if (mimeType) {
    res.setHeader("Content-Type", mimeType);
  }
  if (filename) {
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${String(filename).replace(/"/g, "")}"`
    );
  }
  if (cacheControl) {
    res.setHeader("Cache-Control", cacheControl);
  }
  if (contentRange) {
    res.setHeader("Content-Range", contentRange);
  }
  if (Number.isFinite(fileSize) && fileSize >= 0) {
    res.setHeader("Content-Length", fileSize);
  }
  res.status(passthroughStatus);
};

const streamGridFsMedia = async ({
  req,
  res,
  objectId,
  disposition = "inline",
  cacheControl = "public, max-age=31536000, immutable",
  headOnly = false,
}) => {
  const fileDoc = await getMediaFileDoc(objectId);
  if (!fileDoc) {
    return false;
  }

  const fileSize = toSafeLength(fileDoc.length);
  const mimeType =
    fileDoc.contentType ||
    inferContentTypeFromFilename(fileDoc.filename || "") ||
    "application/octet-stream";
  const filename = resolveFilenameFromFileDoc(fileDoc);
  const bucket = getBucket();
  const range = parseRange(req.headers.range, fileSize);

  if (range) {
    const { start, end } = range;
    const chunkSize = end - start + 1;
    setResponseHeaders({
      res,
      fileSize: chunkSize,
      mimeType,
      filename,
      disposition,
      cacheControl,
      contentRange: `bytes ${start}-${end}/${fileSize}`,
      passthroughStatus: 206,
    });
    if (headOnly) {
      return res.end();
    }
    const stream = bucket.openDownloadStream(objectId, { start, end: end + 1 });
    stream.on("error", () => res.end());
    stream.pipe(res);
    return true;
  }

  if (req.headers.range) {
    res.status(416);
    res.setHeader("Content-Range", `bytes */${fileSize}`);
    res.end();
    return true;
  }

  setResponseHeaders({
    res,
    fileSize,
    mimeType,
    filename,
    disposition,
    cacheControl,
    passthroughStatus: 200,
  });

  if (headOnly) {
    return res.end();
  }

  const stream = bucket.openDownloadStream(objectId);
  stream.on("error", () => res.end());
  stream.pipe(res);
  return true;
};

const proxyRemoteMedia = async ({
  req,
  res,
  sourceUrl,
  disposition = "inline",
  cacheControl = "private, max-age=300, stale-while-revalidate=86400",
  headOnly = false,
}) => {
  const headers = {};
  if (req.headers.range) {
    headers.Range = req.headers.range;
  }

  const response = await fetch(sourceUrl, {
    method: headOnly ? "HEAD" : "GET",
    headers,
    redirect: "follow",
  });

  if (!response.ok) {
    return false;
  }

  const resolvedUrl = response.url || sourceUrl;
  const pathname = (() => {
    try {
      return new URL(resolvedUrl).pathname || "";
    } catch {
      return resolvedUrl;
    }
  })();

  const contentType =
    response.headers.get("content-type") ||
    inferContentTypeFromFilename(pathname) ||
    "application/octet-stream";
  const length = Number.parseInt(response.headers.get("content-length") || "", 10);
  const filename = sanitizeFilename(path.basename(pathname) || "media");
  const contentRange = response.headers.get("content-range") || "";
  const acceptRanges = String(response.headers.get("accept-ranges") || "bytes").toLowerCase() !== "none";

  setResponseHeaders({
    res,
    fileSize: Number.isFinite(length) ? length : undefined,
    mimeType: contentType,
    filename,
    disposition,
    cacheControl,
    acceptRanges,
    contentRange,
    passthroughStatus: response.status,
  });

  if (headOnly || !response.body) {
    return res.end();
  }

  Readable.fromWeb(response.body).pipe(res);
  return true;
};

const openMediaSourceStream = async (sourceUrl = "") => {
  const objectId = extractMediaObjectId(sourceUrl);
  if (objectId) {
    const fileDoc = await getMediaFileDoc(objectId);
    if (!fileDoc) {
      throw new Error("Media file not found");
    }

    return {
      stream: getBucket().openDownloadStream(objectId),
      filename: resolveFilenameFromFileDoc(fileDoc),
      contentType:
        fileDoc.contentType ||
        inferContentTypeFromFilename(fileDoc.filename || "") ||
        "application/octet-stream",
      length: toSafeLength(fileDoc.length),
    };
  }

  const response = await fetch(sourceUrl, {
    method: "GET",
    redirect: "follow",
  });

  if (!response.ok || !response.body) {
    throw new Error(`Could not fetch media source (${response.status || 0})`);
  }

  const finalUrl = response.url || sourceUrl;
  const pathname = (() => {
    try {
      return new URL(finalUrl).pathname || "";
    } catch {
      return finalUrl;
    }
  })();

  const filename = sanitizeFilename(path.basename(pathname) || "media");
  const contentType =
    response.headers.get("content-type") ||
    inferContentTypeFromFilename(filename) ||
    "application/octet-stream";
  const length = Number.parseInt(response.headers.get("content-length") || "", 10);

  return {
    stream: Readable.fromWeb(response.body),
    filename,
    contentType,
    length: Number.isFinite(length) ? length : 0,
  };
};

module.exports = {
  extractMediaObjectId,
  extensionFromContentType,
  inferContentTypeFromFilename,
  openMediaSourceStream,
  parseRange,
  proxyRemoteMedia,
  sanitizeFilename,
  streamGridFsMedia,
  toSafeLength,
};
