const path = require("path");
const multer = require("multer");

const VOICEBRIDGE_AUDIO_MAX_BYTES = 25 * 1024 * 1024;

const AUDIO_FORMATS = Object.freeze({
  ".wav": {
    container: "wav",
    mimeTypes: new Set(["audio/wav", "audio/wave", "audio/x-wav", "audio/vnd.wave"]),
  },
  ".mp3": {
    container: "mp3",
    mimeTypes: new Set(["audio/mpeg", "audio/mp3", "audio/x-mp3"]),
  },
  ".mp4": {
    container: "mp4",
    mimeTypes: new Set(["video/mp4", "audio/mp4", "application/mp4"]),
  },
  ".m4a": {
    container: "mp4",
    mimeTypes: new Set(["audio/mp4", "audio/m4a", "audio/x-m4a"]),
  },
  ".ogg": {
    container: "ogg",
    mimeTypes: new Set(["audio/ogg", "application/ogg", "video/ogg"]),
  },
  ".webm": {
    container: "webm",
    mimeTypes: new Set(["audio/webm", "video/webm"]),
  },
  ".flac": {
    container: "flac",
    mimeTypes: new Set(["audio/flac", "audio/x-flac"]),
  },
});

const ALLOWED_MIME_TYPES = new Set(
  Object.values(AUDIO_FORMATS).flatMap((format) => [...format.mimeTypes])
);

const buildUploadError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

const startsWithBytes = (buffer, bytes) =>
  buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);

const detectAudioContainer = (buffer) => {
  if (!Buffer.isBuffer(buffer)) return "";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  ) return "wav";
  if (
    buffer.toString("ascii", 0, 3) === "ID3" ||
    (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  ) return "mp3";
  if (buffer.length >= 8 && buffer.toString("ascii", 4, 8) === "ftyp") return "mp4";
  if (buffer.toString("ascii", 0, 4) === "OggS") return "ogg";
  if (startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  if (buffer.toString("ascii", 0, 4) === "fLaC") return "flac";
  return "";
};

const validateCodeswitchAudioFile = (file) => {
  if (!file) {
    throw buildUploadError("An audio file is required.");
  }

  if (Number(file.size || 0) > VOICEBRIDGE_AUDIO_MAX_BYTES) {
    throw buildUploadError("VoiceBridge audio files must be 25MB or smaller.", 413);
  }

  const extension = path.extname(String(file.originalname || "")).toLowerCase();
  const mimeType = String(file.mimetype || "").trim().toLowerCase();
  const format = AUDIO_FORMATS[extension];
  if (!format || !format.mimeTypes.has(mimeType)) {
    throw buildUploadError(
      "Unsupported audio format. Use WAV, MP3, MP4, M4A, OGG, WebM, or FLAC."
    );
  }

  const detectedContainer = detectAudioContainer(file.buffer);
  if (!detectedContainer || detectedContainer !== format.container) {
    throw buildUploadError(
      "The uploaded file content does not match its declared audio format."
    );
  }

  return { detectedContainer, extension, mimeType };
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VOICEBRIDGE_AUDIO_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(String(file?.mimetype || "").trim().toLowerCase())) {
      callback(
        buildUploadError(
          "Unsupported audio format. Use WAV, MP3, MP4, M4A, OGG, WebM, or FLAC."
        )
      );
      return;
    }
    callback(null, true);
  },
});

const codeswitchAudioUpload = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  upload.single("audio")(req, res, (error) => {
    if (error?.name === "MulterError" && error.code === "LIMIT_FILE_SIZE") {
      next(buildUploadError("VoiceBridge audio files must be 25MB or smaller.", 413));
      return;
    }
    if (error?.name === "MulterError" && error.code === "LIMIT_FILE_COUNT") {
      next(buildUploadError("Upload exactly one audio file."));
      return;
    }
    if (error) {
      next(error);
      return;
    }

    try {
      if (req.file) {
        req.codeswitchAudioFormat = validateCodeswitchAudioFile(req.file);
      }
      next();
    } catch (validationError) {
      next(validationError);
    }
  });
};

module.exports = {
  ALLOWED_MIME_TYPES,
  AUDIO_FORMATS,
  VOICEBRIDGE_AUDIO_MAX_BYTES,
  codeswitchAudioUpload,
  detectAudioContainer,
  validateCodeswitchAudioFile,
};
