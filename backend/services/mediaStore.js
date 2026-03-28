const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const { pipeline } = require("stream/promises");

const { incrementDailyMetric, logAnalyticsEvent } = require("./analyticsService");
const {
  PERMANENT_MEDIA_DIR,
  buildPermanentMediaFilename,
  buildPermanentMediaPublicId,
  buildPermanentMediaUrl,
  ensurePermanentMediaDir,
  inferContentTypeFromName,
} = require("./mediaStoragePaths");

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

const moveFile = async (sourcePath, destPath) => {
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  try {
    await fsp.rename(sourcePath, destPath);
  } catch (error) {
    if (!error || error.code !== "EXDEV") {
      throw error;
    }

    await fsp.copyFile(sourcePath, destPath);
    await fsp.unlink(sourcePath).catch(() => null);
  }
};

const persistUpload = async (file) => {
  if (!file) {
    return {
      url: "",
      public_id: "",
      resource_type: "raw",
    };
  }

  const sourcePath = file.path || "";
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error("Uploaded file could not be read from temporary storage");
  }

  const contentType = resolveContentType(file);
  const resourceType = contentType.startsWith("video/")
    ? "video"
    : contentType.startsWith("image/")
      ? "image"
      : "raw";

  await ensurePermanentMediaDir();

  const filename = buildPermanentMediaFilename({
    originalName: file.originalname || path.basename(sourcePath),
    contentType,
  });
  const destPath = path.join(PERMANENT_MEDIA_DIR, filename);
  await moveFile(sourcePath, destPath);

  return {
    url: buildPermanentMediaUrl(filename),
    public_id: buildPermanentMediaPublicId(filename),
    resource_type: resourceType,
  };
};

const saveUploadedFile = async (file) => {
  try {
    const payload = await persistUpload(file);
    return payload.url;
  } catch (err) {
    await incrementDailyMetric("uploadFailuresCount", 1).catch(() => null);
    await logAnalyticsEvent({
      type: "upload_failed",
      metadata: { message: err.message || "Upload failed", filename: file?.originalname || "" },
    }).catch(() => null);
    throw err;
  }
};

const saveUploadedMedia = async (file) => {
  try {
    return await persistUpload(file);
  } catch (err) {
    await incrementDailyMetric("uploadFailuresCount", 1).catch(() => null);
    await logAnalyticsEvent({
      type: "upload_failed",
      metadata: { message: err.message || "Upload failed", filename: file?.originalname || "" },
    }).catch(() => null);
    throw err;
  }
};

const saveUploadedMediaToGridFs = async (file) => {
  if (!file) {
    return {
      url: "",
      public_id: "",
      resource_type: "raw",
    };
  }

  const sourcePath = file.path || "";
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error("Uploaded file could not be read from temporary storage");
  }

  const contentType = resolveContentType(file);
  const resourceType = contentType.startsWith("video/")
    ? "video"
    : contentType.startsWith("image/")
      ? "image"
      : contentType.startsWith("audio/")
        ? "audio"
        : "raw";

  const bucket = getBucket();
  const filename = toSafeFilename(file.originalname || path.basename(sourcePath));
  const uploadStream = bucket.openUploadStream(filename, {
    contentType,
    metadata: {
      originalName: file.originalname || path.basename(sourcePath),
      source: "messenger",
      uploadedAt: new Date(),
    },
  });

  try {
    await pipeline(fs.createReadStream(sourcePath), uploadStream);
  } finally {
    await fsp.unlink(sourcePath).catch(() => null);
  }

  const publicId = uploadStream.id?.toString?.() || String(uploadStream.id || "");
  if (!publicId) {
    throw new Error("Failed to store uploaded media");
  }

  return {
    url: `/api/media/${publicId}`,
    public_id: publicId,
    resource_type: resourceType,
  };
};

module.exports = {
  getBucket,
  saveUploadedFile,
  saveUploadedMedia,
  saveUploadedMediaToGridFs,
  bucketName,
};
