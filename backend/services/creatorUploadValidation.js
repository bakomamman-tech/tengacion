const path = require("path");
const { z } = require("zod");

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"];
const AUDIO_MIME_TYPES = [
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp3",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-aac",
  "audio/x-flac",
  "audio/x-m4a",
  "audio/x-wav",
  "application/ogg",
];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"];
const IMAGE_MIME_TYPES = [
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const BOOK_EXTENSIONS = [".pdf", ".epub", ".mobi", ".txt"];
const BOOK_MIME_TYPES = [
  "application/epub+zip",
  "application/pdf",
  "application/x-mobipocket-ebook",
  "application/octet-stream",
  "text/plain",
];
const TRANSCRIPT_EXTENSIONS = [".pdf", ".txt", ".doc", ".docx"];
const TRANSCRIPT_MIME_TYPES = [
  "application/msword",
  "application/octet-stream",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const parseBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(normalized);
};

const parseList = (value, { maxItems = 8, maxLength = 80 } = {}) => {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(
    source
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
      .map((entry) => entry.slice(0, maxLength))
  )].slice(0, maxItems);
};

const parseNumber = (value, { fallback = 0 } = {}) => {
  if (value === "" || value === undefined || value === null) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const parseDate = (value) => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.NaN : date;
};

const boundedString = (maxLength) =>
  z.string().trim().max(maxLength).optional().default("");

const nonNegativeMoney = z.preprocess(
  (value) => parseNumber(value, { fallback: 0 }),
  z.number().finite().min(0)
);

const nonNegativeInteger = z.preprocess(
  (value) => parseNumber(value, { fallback: 0 }),
  z.number().int().min(0)
);

const optionalInteger = z.preprocess(
  (value) => {
    if (value === "" || value === undefined || value === null) {
      return undefined;
    }
    return parseNumber(value, { fallback: Number.NaN });
  },
  z.number().int().min(0).optional()
);

const optionalDate = z.preprocess(parseDate, z.date().optional());

const stringListField = (options) =>
  z.preprocess((value) => parseList(value, options), z.array(z.string()));

const statusField = z.enum(["draft", "published"]).default("published");

const musicUploadSchema = z
  .object({
    title: z.string().trim().min(1, "Track title is required").max(180),
    artistName: boundedString(120),
    genre: boundedString(120),
    description: boundedString(2000),
    price: nonNegativeMoney,
    publishedStatus: statusField,
    releaseType: z.enum(["single", "ep", "album"]).default("single"),
    explicitContent: z.preprocess(parseBoolean, z.boolean()).default(false),
    featuringArtists: stringListField({ maxItems: 6, maxLength: 80 }).default([]),
    producerCredits: stringListField({ maxItems: 8, maxLength: 80 }).default([]),
    songwriterCredits: stringListField({ maxItems: 8, maxLength: 80 }).default([]),
    releaseDate: optionalDate,
    lyrics: boundedString(12000),
    durationSec: nonNegativeInteger.default(0),
  })
  .strict();

const podcastUploadSchema = z
  .object({
    title: z.string().trim().min(1, "Episode title is required").max(180),
    podcastSeries: z.string().trim().min(1, "Podcast series name is required").max(180),
    description: boundedString(3000),
    seasonNumber: nonNegativeInteger.default(0),
    episodeNumber: nonNegativeInteger.default(0),
    category: z.string().trim().min(1, "Podcast category is required").max(120),
    episodeType: z.enum(["free", "premium"]).default("free"),
    price: nonNegativeMoney,
    publishedStatus: statusField,
    explicitContent: z.preprocess(parseBoolean, z.boolean()).default(false),
    guestNames: stringListField({ maxItems: 10, maxLength: 80 }).default([]),
    showNotes: boundedString(12000),
    episodeTags: stringListField({ maxItems: 12, maxLength: 40 }).default([]),
    durationSec: nonNegativeInteger.default(0),
  })
  .strict();

const bookUploadSchema = z
  .object({
    title: z.string().trim().min(1, "Book title is required").max(180),
    authorName: boundedString(120),
    subtitle: boundedString(180),
    description: boundedString(4000),
    genre: boundedString(120),
    language: boundedString(60),
    price: nonNegativeMoney,
    pageCount: optionalInteger,
    isbn: boundedString(40),
    edition: boundedString(40),
    audience: boundedString(80),
    readingAge: boundedString(80),
    tableOfContents: boundedString(4000),
    fileFormat: z.enum(["pdf", "epub", "mobi", "txt"]).optional(),
    publishedStatus: statusField,
    copyrightDeclared: z.preprocess(parseBoolean, z.boolean()).default(false),
  })
  .strict();

const getExtension = (file) => path.extname(String(file?.originalname || "")).toLowerCase();

const describeAllowedFormats = (extensions = []) =>
  extensions.map((entry) => entry.replace(".", "").toUpperCase()).join(", ");

const validateFile = (file, { label, allowedExtensions, allowedMimeTypes }) => {
  if (!file) {
    return null;
  }
  const extension = getExtension(file);
  const mime = String(file.mimetype || "").toLowerCase();
  const validExtension = allowedExtensions.includes(extension);
  const validMime = allowedMimeTypes.includes(mime);

  if (!validExtension && !validMime) {
    return `${label} must be one of: ${describeAllowedFormats(allowedExtensions)}`;
  }

  return null;
};

const parsePayload = (schema, body) => {
  const result = schema.safeParse(body || {});
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues[0]?.message || "Invalid upload payload",
    };
  }

  return {
    ok: true,
    data: result.data,
  };
};

const inferBookFormatFromFile = (file) => {
  const extension = getExtension(file);
  return BOOK_EXTENSIONS.includes(extension) ? extension.slice(1) : "";
};

module.exports = {
  AUDIO_EXTENSIONS,
  AUDIO_MIME_TYPES,
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
  BOOK_EXTENSIONS,
  BOOK_MIME_TYPES,
  TRANSCRIPT_EXTENSIONS,
  TRANSCRIPT_MIME_TYPES,
  parsePayload,
  musicUploadSchema,
  podcastUploadSchema,
  bookUploadSchema,
  validateFile,
  inferBookFormatFromFile,
  getExtension,
};
