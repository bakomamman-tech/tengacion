const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { DeleteObjectCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");

const { config } = require("../config/env");
const {
  EMPTY_MEDIA,
  inferResourceTypeFromMime,
  normalizeResourceType,
  resolveFolder,
} = require("./cloudinaryMediaService");

let s3Client = null;

const toText = (value) => String(value || "").trim();

const trimSlashes = (value = "") => toText(value).replace(/^\/+|\/+$/g, "");

const normalizeBaseUrl = (value = "") => trimSlashes(value).replace(/\/+$/g, "");

const encodeKeyForUrl = (key = "") =>
  toText(key)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

const safeFilename = (value = "upload") => {
  const parsed = path.parse(toText(value) || "upload");
  const name = (parsed.name || "upload")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "upload";
  const ext = (parsed.ext || "").toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 12);
  return `${name}${ext}`;
};

const getContentType = (file = {}) => {
  const mime = toText(file.mimetype).toLowerCase();
  return mime || "application/octet-stream";
};

const createUploadConfigError = () => {
  const error = new Error(
    "S3 media storage is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET, and AWS_S3_MEDIA_URL on the backend."
  );
  error.statusCode = 503;
  return error;
};

const isS3Configured = () =>
  Boolean(
    config.awsAccessKeyId &&
      config.awsSecretAccessKey &&
      config.awsRegion &&
      config.awsS3Bucket &&
      config.awsS3MediaUrl
  );

const getS3Client = () => {
  if (!isS3Configured()) {
    throw createUploadConfigError();
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    });
  }

  return s3Client;
};

const createBody = (file = {}) => {
  if (Buffer.isBuffer(file.buffer) && file.buffer.length > 0) {
    return file.buffer;
  }

  if (file.path && fs.existsSync(file.path)) {
    return fs.createReadStream(file.path);
  }

  throw new Error("Uploaded file could not be read from request data");
};

const buildObjectKey = (file = {}, options = {}) => {
  const resourceType =
    normalizeResourceType(options.resourceType) || inferResourceTypeFromMime(file.mimetype) || "raw";
  const folder = trimSlashes(resolveFolder({
    folder: options.folder,
    source: options.source,
    resourceType,
  }));
  const now = new Date();
  const datePath = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("/");
  const randomId = crypto.randomBytes(8).toString("hex");
  const filename = safeFilename(file.originalname || file.filename || "upload");

  return [folder, datePath, `${Date.now()}-${randomId}-${filename}`]
    .filter(Boolean)
    .join("/");
};

const keyFromS3Media = (input = {}) => {
  const payload = typeof input === "string" ? { url: input } : input || {};
  const directKey = toText(payload.key || payload.publicId || payload.public_id);
  if (directKey) {
    return decodeURIComponent(directKey).replace(/^\/+/, "");
  }

  const url = toText(payload.secureUrl || payload.secure_url || payload.url);
  const baseUrl = normalizeBaseUrl(config.awsS3MediaUrl);
  if (url && baseUrl && url.startsWith(baseUrl)) {
    return decodeURIComponent(url.slice(baseUrl.length).replace(/^\/+/, ""));
  }

  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    return "";
  }
};

const uploadFileToS3 = async (file, options = {}) => {
  if (!file) {
    return { ...EMPTY_MEDIA };
  }

  const client = getS3Client();
  const key = buildObjectKey(file, options);
  const contentType = getContentType(file);
  const resourceType =
    normalizeResourceType(options.resourceType) || inferResourceTypeFromMime(contentType) || "raw";
  const baseUrl = normalizeBaseUrl(config.awsS3MediaUrl);

  await client.send(
    new PutObjectCommand({
      Bucket: config.awsS3Bucket,
      Key: key,
      Body: createBody(file),
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const url = `${baseUrl}/${encodeKeyForUrl(key)}`;

  return {
    assetId: key,
    publicId: key,
    public_id: key,
    key,
    url,
    secureUrl: url,
    secure_url: url,
    resourceType,
    resource_type: resourceType,
    mimeType: contentType,
    format: path.extname(key).replace(/^\./, ""),
    bytes: Number(file.size || file.buffer?.length || 0) || 0,
    width: 0,
    height: 0,
    duration: 0,
    originalFilename: toText(file.originalname || file.filename),
    folder: path.dirname(key),
    provider: "s3",
    legacyPath: "",
  };
};

const isS3MediaValue = (value = {}) => {
  const payload = typeof value === "string" ? { url: value } : value || {};
  const provider = toText(payload.provider).toLowerCase();
  const url = toText(payload.secureUrl || payload.secure_url || payload.url);
  const baseUrl = normalizeBaseUrl(config.awsS3MediaUrl);
  return provider === "s3" || Boolean(baseUrl && url.startsWith(baseUrl));
};

const deleteS3Asset = async (input = {}) => {
  if (!isS3Configured()) {
    return false;
  }

  if (!isS3MediaValue(input)) {
    return false;
  }

  const key = keyFromS3Media(input);
  if (!key) {
    return false;
  }

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: config.awsS3Bucket,
      Key: key,
    })
  );

  return true;
};

const deleteS3Assets = async (inputs = []) => {
  const queue = Array.isArray(inputs) ? inputs : [inputs];
  const seen = new Set();
  const results = [];

  for (const entry of queue) {
    const key = keyFromS3Media(entry);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);

    try {
      const deleted = await deleteS3Asset(entry);
      results.push({ publicId: key, resourceType: "raw", deleted, skipped: false });
    } catch (error) {
      results.push({
        publicId: key,
        resourceType: "raw",
        deleted: false,
        skipped: false,
        error: error?.message || "Unknown error",
      });
    }
  }

  return {
    attempted: results.filter((entry) => !entry.skipped).length,
    deleted: results.filter((entry) => entry.deleted).length,
    failed: results.filter((entry) => !entry.skipped && !entry.deleted).length,
    results,
  };
};

module.exports = {
  deleteS3Asset,
  deleteS3Assets,
  isS3Configured,
  isS3MediaValue,
  keyFromS3Media,
  uploadFileToS3,
};
