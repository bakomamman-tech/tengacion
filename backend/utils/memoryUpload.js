const fs = require("fs");
const multer = require("multer");
const os = require("os");
const path = require("path");

const { MEBIBYTE, UPLOAD_LIMITS } = require("../config/uploadLimits");

const IMAGE_MAX_BYTES = UPLOAD_LIMITS.IMAGE_BYTES;
const MEDIA_MAX_BYTES = UPLOAD_LIMITS.CREATOR_MEDIA_BYTES;
const MAX_UPLOAD_BYTES = MEDIA_MAX_BYTES;

const IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

const AUDIO_MIME_TYPES = new Set([
  "application/ogg",
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp3",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/webm",
  "audio/wav",
  "audio/wave",
  "audio/x-aac",
  "audio/x-flac",
  "audio/x-m4a",
  "audio/x-wav",
]);

const DOCUMENT_MIME_TYPES = new Set([
  "application/epub+zip",
  "application/msword",
  "application/octet-stream",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-mobipocket-ebook",
  "text/plain",
]);

const DOCUMENT_EXTENSIONS = new Set([
  ".doc",
  ".docx",
  ".epub",
  ".mobi",
  ".pdf",
  ".txt",
]);

const tryEnsureWritableDir = (targetDir) => {
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.accessSync(targetDir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

const buildUploadDir = (candidates = [], fallbackDirName = "tengacion-uploads") => {
  const filtered = candidates.filter(Boolean);
  let uploadDir = filtered.find((dir) => tryEnsureWritableDir(dir));
  if (!uploadDir) {
    uploadDir = path.join(os.tmpdir(), fallbackDirName);
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

const toText = (value) => String(value || "").trim();

const getExtension = (file = {}) => path.extname(toText(file.originalname)).toLowerCase();
const isFileLike = (value) =>
  Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && (
      typeof value.originalname === "string"
      || typeof value.mimetype === "string"
      || typeof value.fieldname === "string"
      || Buffer.isBuffer(value.buffer)
    )
  );

const describeSizeLimit = (maxBytes = 0) => {
  const sizeInMb = Number(maxBytes || 0) / MEBIBYTE;
  return Number.isInteger(sizeInMb) ? `${sizeInMb}MB` : `${sizeInMb.toFixed(1)}MB`;
};

const buildUploadError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const classifyFile = (file = {}) => {
  const mimeType = toText(file.mimetype).toLowerCase();
  const extension = getExtension(file);

  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return { category: "image", mimeType, maxBytes: IMAGE_MAX_BYTES };
  }

  if (VIDEO_MIME_TYPES.has(mimeType)) {
    return { category: "video", mimeType, maxBytes: MEDIA_MAX_BYTES };
  }

  if (AUDIO_MIME_TYPES.has(mimeType)) {
    return { category: "audio", mimeType, maxBytes: MEDIA_MAX_BYTES };
  }

  if (DOCUMENT_MIME_TYPES.has(mimeType) && DOCUMENT_EXTENSIONS.has(extension)) {
    return { category: "document", mimeType, maxBytes: MEDIA_MAX_BYTES };
  }

  return null;
};

const flattenFiles = (files) => {
  if (!files) return [];
  if (Array.isArray(files)) return files.filter(Boolean);
  if (isFileLike(files)) return [files];
  if (typeof files === "object") {
    return Object.values(files).flatMap((entry) =>
      (Array.isArray(entry) ? entry : [entry]).filter(Boolean)
    );
  }
  return [];
};

const resolveCategoryLimit = (classification, { maxBytesByCategory = {} } = {}) => {
  const configuredLimit = Number(maxBytesByCategory?.[classification.category] || 0);
  return configuredLimit > 0 ? configuredLimit : classification.maxBytes;
};

const validateFilePayload = (file = {}, options = {}) => {
  const classification = classifyFile(file);
  if (!classification) {
    throw buildUploadError(
      "Unsupported file type. Upload an image, video, audio file, PDF, EPUB, MOBI, TXT, DOC, or DOCX."
    );
  }

  const size = Number(file.size || 0);
  const maxBytes = resolveCategoryLimit(classification, options);
  if (size > maxBytes) {
    const label =
      classification.category === "image"
        ? "Image uploads"
        : ["video", "audio"].includes(classification.category)
          ? "Video and audio uploads"
          : "Document uploads";
    throw buildUploadError(
      `${label} must be ${describeSizeLimit(maxBytes)} or smaller.`,
      413
    );
  }

  return {
    ...classification,
    maxBytes,
  };
};

const createUploadedFilesValidator = (options = {}) => (req, _res, next) => {
  try {
    const files = flattenFiles(req.files || req.file);
    files.forEach((file) => validateFilePayload(file, options));
    next();
  } catch (error) {
    next(error);
  }
};

const validateUploadedFiles = createUploadedFilesValidator();

const wrapMulterMiddleware = (middleware, options = {}) => [
  (req, res, next) => {
    middleware(req, res, (error) => {
      if (error?.name === "MulterError" && error.code === "LIMIT_FILE_SIZE") {
        return next(
          buildUploadError(
            `Upload exceeds the maximum allowed size of ${describeSizeLimit(options.maxFileBytes)}.`,
            413
          )
        );
      }
      return next(error);
    });
  },
  createUploadedFilesValidator(options),
];

const createConfiguredUpload = ({
  candidates = [],
  fallbackDirName = "tengacion-uploads",
  maxFileBytes = MAX_UPLOAD_BYTES,
  maxBytesByCategory = {},
} = {}) => {
  const uploadDir = buildUploadDir(candidates, fallbackDirName);
  const validationOptions = {
    maxFileBytes,
    maxBytesByCategory,
  };
  const instance = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileBytes,
      files: 60,
    },
    fileFilter: (_req, file, cb) => {
      try {
        validateFilePayload({
          originalname: file?.originalname,
          mimetype: file?.mimetype,
          size: 0,
        }, validationOptions);
        cb(null, true);
      } catch (error) {
        cb(error);
      }
    },
  });

  const upload = {
    single(fieldName) {
      return wrapMulterMiddleware(instance.single(fieldName), validationOptions);
    },
    array(fieldName, maxCount) {
      return wrapMulterMiddleware(instance.array(fieldName, maxCount), validationOptions);
    },
    fields(fieldList) {
      return wrapMulterMiddleware(instance.fields(fieldList), validationOptions);
    },
    any() {
      return wrapMulterMiddleware(instance.any(), validationOptions);
    },
    none() {
      return wrapMulterMiddleware(instance.none(), validationOptions);
    },
    maxBytesByCategory: { ...maxBytesByCategory },
    maxFileBytes,
    memoryStorage: instance.storage,
    uploadDir,
  };

  return upload;
};

module.exports = {
  AUDIO_MIME_TYPES,
  DOCUMENT_EXTENSIONS,
  DOCUMENT_MIME_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_MIME_TYPES,
  MEDIA_MAX_BYTES,
  MAX_UPLOAD_BYTES,
  VIDEO_MIME_TYPES,
  classifyFile,
  createConfiguredUpload,
  createUploadedFilesValidator,
  describeSizeLimit,
  validateFilePayload,
  validateUploadedFiles,
};
