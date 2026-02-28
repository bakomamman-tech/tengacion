const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const { pipeline } = require("stream/promises");

const bucketName = "uploads";

const getBucket = () => {
  if (!mongoose.connection?.db) {
    throw new Error("Database connection is not ready");
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });
};

const toSafeFilename = (value = "") => {
  const base = String(value || "upload").trim();
  const safe = base.replace(/[^\w.\-]+/g, "_");
  return safe || `upload_${Date.now()}`;
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
  return "";
};

const resolveContentType = (file) => {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (mime && mime !== "application/octet-stream") {
    return mime;
  }

  return (
    inferContentTypeFromName(file?.originalname || "") ||
    inferContentTypeFromName(file?.filename || "") ||
    "application/octet-stream"
  );
};

const saveUploadedFile = async (file) => {
  if (!file) {
    return "";
  }

  const sourcePath = file.path || "";
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error("Uploaded file could not be read from temporary storage");
  }

  const bucket = getBucket();
  const filename = toSafeFilename(file.originalname || path.basename(sourcePath));
  const contentType = resolveContentType(file);
  const uploadStream = bucket.openUploadStream(filename, {
    contentType,
    metadata: {
      source: "tengacion-upload",
      originalName: file.originalname || "",
      contentDisposition: "inline",
    },
  });

  await pipeline(fs.createReadStream(sourcePath), uploadStream);

  try {
    await fsp.unlink(sourcePath);
  } catch {
    // Non-fatal: local temp cleanup best-effort.
  }

  return `/api/media/${uploadStream.id.toString()}`;
};

module.exports = {
  getBucket,
  saveUploadedFile,
  bucketName,
};
