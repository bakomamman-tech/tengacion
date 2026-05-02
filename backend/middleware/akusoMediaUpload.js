const multer = require("multer");

const {
  AUDIO_MIME_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_MIME_TYPES,
} = require("../utils/memoryUpload");

const AKUSO_AUDIO_MAX_BYTES = 25 * 1024 * 1024;
const AKUSO_MAX_FILES = 4;

const toText = (value) => String(value || "").trim();

const buildUploadError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const classifyAkusoFile = (file = {}) => {
  const mimeType = toText(file.mimetype).toLowerCase();
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return {
      type: "image",
      maxBytes: IMAGE_MAX_BYTES,
    };
  }
  if (AUDIO_MIME_TYPES.has(mimeType)) {
    return {
      type: "audio",
      maxBytes: AKUSO_AUDIO_MAX_BYTES,
    };
  }
  return null;
};

const flattenFiles = (files) => {
  if (!files) return [];
  if (Array.isArray(files)) return files.filter(Boolean);
  if (typeof files === "object") {
    return Object.values(files).flatMap((entry) =>
      (Array.isArray(entry) ? entry : [entry]).filter(Boolean)
    );
  }
  return [];
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: AKUSO_AUDIO_MAX_BYTES,
    files: AKUSO_MAX_FILES,
  },
  fileFilter: (_req, file, callback) => {
    if (!classifyAkusoFile(file)) {
      callback(
        buildUploadError(
          "Akuso can only assess images and voice messages right now."
        )
      );
      return;
    }
    callback(null, true);
  },
});

const handleMulterUpload = upload.fields([
  { name: "attachments", maxCount: AKUSO_MAX_FILES },
  { name: "images", maxCount: AKUSO_MAX_FILES },
  { name: "voice", maxCount: 1 },
  { name: "audio", maxCount: 1 },
]);

const validateAkusoMediaPayload = (req, _res, next) => {
  try {
    const files = flattenFiles(req.files);
    const counts = files.reduce(
      (totals, file) => {
        const classification = classifyAkusoFile(file);
        if (!classification) {
          throw buildUploadError(
            "Akuso can only assess images and voice messages right now."
          );
        }

        const size = Number(file.size || 0);
        if (size > classification.maxBytes) {
          throw buildUploadError(
            classification.type === "image"
              ? "Akuso image uploads must be 10MB or smaller."
              : "Akuso voice messages must be 25MB or smaller.",
            413
          );
        }

        totals[classification.type] += 1;
        return totals;
      },
      { image: 0, audio: 0 }
    );

    if (counts.image > 3) {
      throw buildUploadError("Akuso can assess up to 3 images at a time.");
    }
    if (counts.audio > 1) {
      throw buildUploadError("Akuso can reply to one voice message at a time.");
    }

    req.akusoHasMediaAttachments = files.length > 0;
    next();
  } catch (error) {
    next(error);
  }
};

const akusoMediaUpload = [
  (req, res, next) => {
    handleMulterUpload(req, res, (error) => {
      if (error?.name === "MulterError") {
        if (error.code === "LIMIT_FILE_SIZE") {
          return next(
            buildUploadError(
              "Akuso voice messages must be 25MB or smaller, and images must be 10MB or smaller.",
              413
            )
          );
        }
        if (error.code === "LIMIT_FILE_COUNT") {
          return next(
            buildUploadError("Akuso can assess up to 4 media files at a time.")
          );
        }
      }
      return next(error);
    });
  },
  validateAkusoMediaPayload,
];

module.exports = {
  akusoMediaUpload,
  classifyAkusoFile,
  flattenFiles,
};
