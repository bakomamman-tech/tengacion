const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");

const { cloudinary, isCloudinaryConfigured } = require("../config/cloudinary");

let streamifier = null;
try {
  streamifier = require("streamifier");
} catch {
  streamifier = null;
}

const EMPTY_MEDIA = Object.freeze({
  publicId: "",
  public_id: "",
  url: "",
  secureUrl: "",
  secure_url: "",
  resourceType: "",
  resource_type: "",
  format: "",
  bytes: 0,
  width: 0,
  height: 0,
  duration: 0,
  originalFilename: "",
  folder: "",
  provider: "",
  legacyPath: "",
});

const SOURCE_FOLDER_MAP = Object.freeze({
  album_cover: "tengacion/creators/music-covers",
  album_preview: "tengacion/creators/audio",
  album_track: "tengacion/creators/audio",
  book_content: "tengacion/books/files",
  book_cover: "tengacion/books/covers",
  book_preview: "tengacion/books/previews",
  chat_attachment_audio: "tengacion/messages/audio",
  chat_attachment_document: "tengacion/messages/files",
  chat_attachment_image: "tengacion/messages/images",
  chat_attachment_video: "tengacion/messages/videos",
  creator_book_content: "tengacion/books/files",
  creator_book_cover: "tengacion/books/covers",
  creator_book_preview: "tengacion/books/previews",
  creator_music_audio: "tengacion/creators/audio",
  creator_music_cover: "tengacion/creators/music-covers",
  creator_music_preview: "tengacion/creators/audio",
  creator_podcast_audio: "tengacion/creators/audio",
  creator_podcast_cover: "tengacion/podcasts/covers",
  creator_podcast_preview: "tengacion/podcasts/previews",
  creator_podcast_transcript: "tengacion/podcasts/transcripts",
  creator_podcast_video: "tengacion/podcasts/videos",
  creator_video: "tengacion/creators/videos",
  creator_video_cover: "tengacion/creators/music-covers",
  creator_video_preview: "tengacion/creators/videos",
  post_image: "tengacion/posts/images",
  post_video: "tengacion/posts/videos",
  profile_avatar: "tengacion/profiles",
  profile_cover: "tengacion/covers",
  story_image: "tengacion/stories/images",
  story_video: "tengacion/stories/videos",
});

const toText = (value) => String(value || "").trim();

const createUploadConfigError = () => {
  const error = new Error(
    "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the backend."
  );
  error.statusCode = 503;
  return error;
};

const normalizeResourceType = (value = "") => {
  const normalized = toText(value).toLowerCase();
  if (!normalized) return "";
  if (normalized === "audio") return "video";
  if (["image", "video", "raw"].includes(normalized)) {
    return normalized;
  }
  return "";
};

const inferResourceTypeFromMime = (mimeType = "") => {
  const mime = toText(mimeType).toLowerCase();
  if (!mime) return "raw";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/") || mime.startsWith("audio/")) return "video";
  return "raw";
};

const inferResourceTypeFromUrl = (value = "") => {
  const url = toText(value).toLowerCase();
  if (!url) return "";
  if (/\.(mp4|mov|m4v|webm|avi|mkv|ogg)(?:$|\?)/i.test(url)) return "video";
  if (/\.(mp3|wav|aac|flac|m4a|oga)(?:$|\?)/i.test(url)) return "video";
  if (/\.(png|jpe?g|webp|gif|avif|bmp|svg)(?:$|\?)/i.test(url)) return "image";
  return "";
};

const inferCloudinaryPublicIdFromUrl = (value = "") => {
  const url = toText(value);
  if (!isCloudinaryUrl(url)) {
    return "";
  }

  const withoutQuery = url.split("?")[0];
  const match = withoutQuery.match(/\/upload\/(?:[^/]+\/)*(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
  return match?.[1] || "";
};

const resolveFolder = ({ folder = "", source = "", resourceType = "" } = {}) => {
  if (toText(folder)) {
    return toText(folder);
  }

  if (SOURCE_FOLDER_MAP[source]) {
    return SOURCE_FOLDER_MAP[source];
  }

  if (resourceType === "image") {
    return "tengacion/uploads/images";
  }
  if (resourceType === "video") {
    return "tengacion/uploads/videos";
  }
  return "tengacion/uploads/raw";
};

const createReadStream = (file = {}) => {
  if (Buffer.isBuffer(file.buffer) && file.buffer.length > 0) {
    if (streamifier?.createReadStream) {
      return streamifier.createReadStream(file.buffer);
    }
    return Readable.from(file.buffer);
  }

  if (file.path && fs.existsSync(file.path)) {
    return fs.createReadStream(file.path);
  }

  throw new Error("Uploaded file could not be read from request data");
};

const normalizeCloudinaryUpload = (
  result = {},
  { originalFilename = "", folder = "", resourceType = "" } = {}
) => {
  const publicId = toText(result.public_id);
  const secureUrl = toText(result.secure_url || result.url);
  const normalizedResourceType =
    normalizeResourceType(result.resource_type || resourceType)
    || inferResourceTypeFromUrl(secureUrl)
    || "raw";

  return {
    publicId,
    public_id: publicId,
    url: secureUrl,
    secureUrl: secureUrl,
    secure_url: secureUrl,
    resourceType: normalizedResourceType,
    resource_type: normalizedResourceType,
    format: toText(result.format),
    bytes: Number(result.bytes || 0) || 0,
    width: Number(result.width || 0) || 0,
    height: Number(result.height || 0) || 0,
    duration: Number(result.duration || 0) || 0,
    originalFilename: toText(originalFilename || result.original_filename),
    folder: toText(result.folder || folder),
    provider: "cloudinary",
    legacyPath: "",
  };
};

const uploadFileToCloudinary = async (file, options = {}) => {
  if (!file) {
    return { ...EMPTY_MEDIA };
  }

  if (!isCloudinaryConfigured()) {
    throw createUploadConfigError();
  }

  const originalFilename = path.basename(toText(file.originalname || file.filename || "upload"));
  const resourceType =
    normalizeResourceType(options.resourceType)
    || inferResourceTypeFromMime(file.mimetype)
    || "raw";
  const folder = resolveFolder({
    folder: options.folder,
    source: options.source,
    resourceType,
  });

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(
          normalizeCloudinaryUpload(result, {
            originalFilename,
            folder,
            resourceType,
          })
        );
      }
    );

    const source = createReadStream(file);
    source.on("error", reject);
    source.pipe(uploadStream);
  });
};

const deleteCloudinaryAsset = async (input = {}, options = {}) => {
  if (!isCloudinaryConfigured()) {
    return false;
  }

  const payload =
    typeof input === "string"
      ? {
          publicId: inferCloudinaryPublicIdFromUrl(input) || input,
          url: isCloudinaryUrl(input) ? input : "",
        }
      : input || {};
  const publicId = toText(
    payload.publicId || payload.public_id || inferCloudinaryPublicIdFromUrl(payload.secureUrl || payload.secure_url || payload.url)
  );
  if (!publicId) {
    return false;
  }

  const url = toText(payload.secureUrl || payload.secure_url || payload.url);
  const provider = toText(payload.provider).toLowerCase();
  const legacyPath = toText(payload.legacyPath);
  const isCloudinaryManaged =
    provider === "cloudinary" ||
    isCloudinaryUrl(url) ||
    (!legacyPath && publicId.startsWith("tengacion/"));
  if (!isCloudinaryManaged) {
    return false;
  }

  const resourceType =
    normalizeResourceType(payload.resourceType || payload.resource_type || options.resourceType)
    || inferResourceTypeFromUrl(payload.secureUrl || payload.secure_url || payload.url)
    || "image";

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });

  return ["ok", "not found"].includes(toText(result?.result).toLowerCase());
};

const deleteCloudinaryAssets = async (inputs = [], options = {}) => {
  const queue = Array.isArray(inputs) ? inputs : [inputs];
  const seen = new Set();
  const results = [];

  for (const entry of queue) {
    const payload = typeof entry === "string" ? { publicId: entry } : entry || {};
    const publicId = toText(
      payload.publicId
      || payload.public_id
      || inferCloudinaryPublicIdFromUrl(payload.secureUrl || payload.secure_url || payload.url)
    );
    const resourceType =
      normalizeResourceType(payload.resourceType || payload.resource_type || options.resourceType)
      || inferResourceTypeFromUrl(payload.secureUrl || payload.secure_url || payload.url)
      || "image";

    if (!publicId) {
      results.push({ publicId: "", resourceType, deleted: false, skipped: true });
      continue;
    }

    const dedupeKey = `${resourceType}:${publicId}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    try {
      const deleted = await deleteCloudinaryAsset(payload, options);
      results.push({ publicId, resourceType, deleted, skipped: false });
    } catch (error) {
      console.error("[cloudinary] asset cleanup failed", {
        publicId,
        resourceType,
        message: error?.message || "Unknown error",
      });
      results.push({
        publicId,
        resourceType,
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

const isCloudinaryUrl = (value = "") =>
  /(^https?:\/\/)?res\.cloudinary\.com\//i.test(toText(value));

module.exports = {
  EMPTY_MEDIA,
  createUploadConfigError,
  deleteCloudinaryAsset,
  deleteCloudinaryAssets,
  inferCloudinaryPublicIdFromUrl,
  inferResourceTypeFromMime,
  inferResourceTypeFromUrl,
  isCloudinaryConfigured,
  isCloudinaryUrl,
  normalizeCloudinaryUpload,
  normalizeResourceType,
  resolveFolder,
  uploadFileToCloudinary,
};
