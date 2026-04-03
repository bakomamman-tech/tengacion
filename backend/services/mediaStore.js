const fs = require("fs");
const mongoose = require("mongoose");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");

const { incrementDailyMetric, logAnalyticsEvent } = require("./analyticsService");
const {
  EMPTY_MEDIA,
  deleteCloudinaryAsset,
  deleteCloudinaryAssets,
  inferResourceTypeFromMime,
  uploadFileToCloudinary,
} = require("./cloudinaryMediaService");

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
  return "application/octet-stream";
};

const logUploadFailure = async (file, err) => {
  await incrementDailyMetric("uploadFailuresCount", 1).catch(() => null);
  await logAnalyticsEvent({
    type: "upload_failed",
    metadata: { message: err.message || "Upload failed", filename: file?.originalname || "" },
  }).catch(() => null);
};

const saveUploadedMedia = async (file, options = {}) => {
  if (!file) {
    return { ...EMPTY_MEDIA };
  }

  try {
    return await uploadFileToCloudinary(file, {
      source: options.source,
      folder: options.folder,
      resourceType: options.resourceType || inferResourceTypeFromMime(file.mimetype),
    });
  } catch (err) {
    await logUploadFailure(file, err);
    throw err;
  }
};

const saveUploadedFile = async (file, options = {}) => {
  const payload = await saveUploadedMedia(file, options);
  return payload.secureUrl || payload.url || "";
};

const openGridFsSourceStream = (file = {}) => {
  if (Buffer.isBuffer(file.buffer) && file.buffer.length > 0) {
    return Readable.from(file.buffer);
  }

  if (file.path && fs.existsSync(file.path)) {
    return fs.createReadStream(file.path);
  }

  throw new Error("Uploaded file could not be read from request data");
};

const saveUploadedMediaToGridFs = async (file, options = {}) => {
  if (!file) {
    return {
      url: "",
      public_id: "",
      resource_type: "raw",
    };
  }

  const { source = "messenger", metadata: extraMetadata = {} } = options || {};
  const contentType = resolveContentType(file);
  const resourceType = contentType.startsWith("video/")
    ? "video"
    : contentType.startsWith("image/")
      ? "image"
      : contentType.startsWith("audio/")
        ? "audio"
        : "raw";

  const bucket = getBucket();
  const filename = toSafeFilename(file.originalname || file.filename || "upload");
  const uploadStream = bucket.openUploadStream(filename, {
    contentType,
    metadata: {
      originalName: file.originalname || file.filename || filename,
      source,
      uploadedAt: new Date(),
      ...extraMetadata,
    },
  });

  await pipeline(openGridFsSourceStream(file), uploadStream);

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

const deleteUploadedMedia = async (media = {}, options = {}) => {
  try {
    return await deleteCloudinaryAsset(media, options);
  } catch {
    return false;
  }
};

const deleteUploadedMediaBatch = async (mediaList = [], options = {}) => {
  try {
    return await deleteCloudinaryAssets(mediaList, options);
  } catch {
    return {
      attempted: 0,
      deleted: 0,
      failed: 0,
      results: [],
    };
  }
};

module.exports = {
  bucketName,
  deleteUploadedMedia,
  deleteUploadedMediaBatch,
  getBucket,
  saveUploadedFile,
  saveUploadedMedia,
  saveUploadedMediaToGridFs,
};
