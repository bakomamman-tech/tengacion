const crypto = require("crypto");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { config } = require("../config/env");

const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
const ALLOWED_MIME_TYPES = new Set(["video/mp4", "video/webm"]);

const useLocalVideoMock = Boolean(config.USE_LOCAL_VIDEO_MOCK);
const localMockFileUrl = config.LOCAL_VIDEO_MOCK_URL || "";

let s3Client = null;

const ensureS3Config = () => {
  if (useLocalVideoMock) {
    return;
  }

  if (
    !config.AWS_ACCESS_KEY_ID ||
    !config.AWS_SECRET_ACCESS_KEY ||
    !config.AWS_REGION ||
    !config.AWS_S3_BUCKET
  ) {
    throw new Error("S3 bucket configuration is incomplete");
  }
};

const getS3Client = () => {
  if (s3Client) {
    return s3Client;
  }

  ensureS3Config();

  s3Client = new S3Client({
    region: config.AWS_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  });
  return s3Client;
};

const normalizeMimeType = (value) => {
  if (!value) return "";
  return value.toLowerCase();
};

const validateVideoUpload = ({ contentType, sizeBytes }) => {
  const mime = normalizeMimeType(contentType);
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new Error("Only MP4 and WebM videos are allowed");
  }

  if (typeof sizeBytes === "number" && sizeBytes > MAX_VIDEO_BYTES) {
    throw new Error("Video exceeds maximum allowed size (200MB)");
  }
};

const toSafeFilename = (name) => {
  const base = path.basename(name || "video");
  const clean = base.replace(/[^\w.-]+/g, "_");
  return clean || `video-${Date.now()}`;
};

const buildKey = (originalName) => {
  const sanitized = toSafeFilename(originalName);
  const ext = path.extname(sanitized) || ".mp4";
  const prefix = `videos/${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
  return `${prefix}${ext}`;
};

const resolveFileUrl = (key) => {
  if (!key) return "";
  const base = (config.AWS_S3_MEDIA_URL || "")
    .trim()
    .replace(/\/$/, "");

  if (base) {
    return `${base}/${key}`;
  }

  const regionSegment = config.AWS_REGION ? `.${config.AWS_REGION}` : "";
  return `https://${config.AWS_S3_BUCKET}.s3${regionSegment}.amazonaws.com/${key}`;
};

const createVideoUploadPayload = async ({ filename, contentType, sizeBytes }) => {
  validateVideoUpload({ contentType, sizeBytes });

  if (useLocalVideoMock) {
    return {
      uploadUrl: "",
      videoKey: `mock-${Date.now()}`,
      fileUrl: localMockFileUrl || "https://storage.googleapis.com/free-videos/sample.mp4",
      expiresAt: Date.now() + 60 * 1000,
      isMockUpload: true,
    };
  }

  const key = buildKey(filename);
  const normalizedMime = normalizeMimeType(contentType);

  const client = getS3Client();
  const uploadCommand = new PutObjectCommand({
    Bucket: config.AWS_S3_BUCKET,
    Key: key,
    ContentType: normalizedMime,
    Metadata: {
      source: "tengacion-video",
    },
  });

  const uploadUrl = await getSignedUrl(client, uploadCommand, {
    expiresIn: 300,
  });

  return {
    uploadUrl,
    videoKey: key,
    fileUrl: resolveFileUrl(key),
    expiresAt: Date.now() + 300 * 1000,
  };
};

module.exports = {
  MAX_VIDEO_BYTES,
  ALLOWED_MIME_TYPES,
  createVideoUploadPayload,
};
