const mongoose = require("mongoose");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

const BUCKET_NAME = "summer_bootcamp_photos";

const getBucket = () => {
  if (!mongoose.connection?.db) {
    throw new Error("Database connection is not ready");
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: BUCKET_NAME,
  });
};

const safeFilename = (value = "photo") =>
  String(value || "photo")
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 180) || `photo_${Date.now()}`;

const savePrivateBootcampPhoto = async (file, metadata = {}) => {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new Error("Uploaded photo could not be read");
  }

  const filename = safeFilename(file.originalname || file.filename);
  const contentType = String(file.mimetype || "image/jpeg").toLowerCase();
  const uploadStream = getBucket().openUploadStream(filename, {
    contentType,
    metadata: {
      ...metadata,
      source: "summer_bootcamp_registration",
      originalName: file.originalname || filename,
      uploadedAt: new Date(),
      private: true,
    },
  });

  await pipeline(Readable.from(file.buffer), uploadStream);
  const fileId = uploadStream.id?.toString?.() || "";
  if (!fileId) {
    throw new Error("Failed to store registration photo");
  }

  return {
    fileId,
    filename,
    originalName: file.originalname || filename,
    contentType,
    sizeBytes: Number(file.size || file.buffer.length || 0),
    role: metadata.role === "parent" ? "parent" : "student",
  };
};

const deletePrivateBootcampPhoto = async (fileId = "") => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    return false;
  }
  try {
    await getBucket().delete(new mongoose.Types.ObjectId(fileId));
    return true;
  } catch (error) {
    return Boolean(error?.code === 26 || String(error?.message || "").includes("FileNotFound"));
  }
};

const getPrivateBootcampPhoto = async (fileId = "") => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    return null;
  }
  const [file] = await getBucket()
    .find({ _id: new mongoose.Types.ObjectId(fileId) })
    .limit(1)
    .toArray();
  return file || null;
};

const openPrivateBootcampPhotoStream = (fileId = "") => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new Error("Invalid photo id");
  }
  return getBucket().openDownloadStream(new mongoose.Types.ObjectId(fileId));
};

module.exports = {
  BUCKET_NAME,
  deletePrivateBootcampPhoto,
  getPrivateBootcampPhoto,
  openPrivateBootcampPhotoStream,
  savePrivateBootcampPhoto,
};
