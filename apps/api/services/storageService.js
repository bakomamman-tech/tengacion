const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const ApiError = require("../utils/ApiError");
const { config } = require("../config/env");

const createClient = () => {
  if (!config.AWS_ACCESS_KEY_ID || !config.AWS_SECRET_ACCESS_KEY || !config.AWS_REGION) {
    return null;
  }

  return new S3Client({
    region: config.AWS_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  });
};

const s3Client = createClient();
const ensureConfigured = () => {
  if (!config.AWS_S3_BUCKET || !s3Client) {
    throw ApiError.serviceUnavailable("AWS S3 storage is not configured");
  }
};

const buildMediaUrl = (key) => {
  if (!key) return "";
  if (config.AWS_S3_MEDIA_URL) {
    return `${config.AWS_S3_MEDIA_URL.replace(/\/$/, "")}/${key}`;
  }
  if (config.AWS_REGION && config.AWS_S3_BUCKET) {
    return `https://${config.AWS_S3_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com/${key}`;
  }
  return key;
};

const uploadAudio = async ({ key, body, contentType = "audio/mpeg" }) => {
  ensureConfigured();
  const command = new PutObjectCommand({
    Bucket: config.AWS_S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await s3Client.send(command);
  return buildMediaUrl(key);
};

module.exports = {
  uploadAudio,
  buildMediaUrl,
};
