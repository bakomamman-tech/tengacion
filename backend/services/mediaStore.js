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

const saveUploadedFile = async (file, { fallbackUrl = "" } = {}) => {
  if (!file) {
    return "";
  }

  const sourcePath = file.path || "";
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return fallbackUrl || "";
  }

  const bucket = getBucket();
  const filename = toSafeFilename(file.originalname || path.basename(sourcePath));
  const contentType = file.mimetype || "application/octet-stream";
  const uploadStream = bucket.openUploadStream(filename, {
    contentType,
    metadata: {
      source: "tengacion-upload",
      originalName: file.originalname || "",
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
