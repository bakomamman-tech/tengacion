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
  isCloudinaryUrl,
  uploadFileToCloudinary,
} = require("./cloudinaryMediaService");
const {
  deleteS3Asset,
  deleteS3Assets,
  isS3MediaValue,
  uploadFileToS3,
} = require("./s3MediaService");

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

const getMediaStorageProvider = () => {
  const provider = String(process.env.MEDIA_STORAGE_PROVIDER || "cloudinary").trim().toLowerCase();
  return ["s3", "aws", "aws-s3"].includes(provider) ? "s3" : "cloudinary";
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
    if (getMediaStorageProvider() === "s3") {
      return await uploadFileToS3(file, {
        source: options.source,
        folder: options.folder,
        resourceType: options.resourceType || inferResourceTypeFromMime(file.mimetype),
      });
    }

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
    if (isS3MediaValue(media)) {
      return await deleteS3Asset(media);
    }

    return await deleteCloudinaryAsset(media, options);
  } catch {
    return false;
  }
};

const deleteUploadedMediaBatch = async (mediaList = [], options = {}) => {
  try {
    const list = Array.isArray(mediaList) ? mediaList : [mediaList];
    const s3Media = list.filter((entry) => isS3MediaValue(entry));
    const cloudinaryMedia = list.filter((entry) => {
      if (isS3MediaValue(entry)) {
        return false;
      }
      const value = typeof entry === "string" ? entry : entry?.secureUrl || entry?.secure_url || entry?.url || "";
      return entry?.provider === "cloudinary" || isCloudinaryUrl(value) || entry?.publicId || entry?.public_id;
    });

    const [s3Result, cloudinaryResult] = await Promise.all([
      s3Media.length ? deleteS3Assets(s3Media) : Promise.resolve({ attempted: 0, deleted: 0, failed: 0, results: [] }),
      cloudinaryMedia.length
        ? deleteCloudinaryAssets(cloudinaryMedia, options)
        : Promise.resolve({ attempted: 0, deleted: 0, failed: 0, results: [] }),
    ]);

    return {
      attempted: s3Result.attempted + cloudinaryResult.attempted,
      deleted: s3Result.deleted + cloudinaryResult.deleted,
      failed: s3Result.failed + cloudinaryResult.failed,
      results: [...s3Result.results, ...cloudinaryResult.results],
    };
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
  getMediaStorageProvider,
  saveUploadedFile,
  saveUploadedMedia,
  saveUploadedMediaToGridFs,
};
