import { z } from "zod";

export const AUDIO_ACCEPT = ".mp3,.wav,.flac,.m4a,.aac,.ogg,audio/*";
export const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.avif,image/*";
export const BOOK_ACCEPT = ".pdf,.epub,.mobi,.txt";
export const TRANSCRIPT_ACCEPT = ".pdf,.txt,.doc,.docx";

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"];
const BOOK_EXTENSIONS = [".pdf", ".epub", ".mobi", ".txt"];
const TRANSCRIPT_EXTENSIONS = [".pdf", ".txt", ".doc", ".docx"];

const getExtension = (file) => {
  const name = String(file?.name || "");
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
};

const hasValidExtension = (file, extensions) => {
  const extension = getExtension(file);
  return extensions.includes(extension);
};

const fileField = (label, extensions, { required = false } = {}) =>
  z.any().superRefine((value, ctx) => {
    if (!value) {
      if (required) {
        ctx.addIssue({
          code: "custom",
          message: `${label} is required`,
        });
      }
      return;
    }

    if (!hasValidExtension(value, extensions)) {
      ctx.addIssue({
        code: "custom",
        message: `${label} must match ${extensions.map((entry) => entry.replace(".", "").toUpperCase()).join(", ")}`,
      });
    }
  });

const moneyField = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) {
    return 0;
  }
  return Number(value);
}, z.number().finite().min(0));

const optionalIntegerField = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }
  return Number(value);
}, z.number().int().min(0).optional());

export const splitCommaValues = (value = "") =>
  [...new Set(
    String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  )];

export const musicUploadSchema = z.object({
  trackTitle: z.string().trim().min(1, "Track title is required").max(180),
  artistName: z.string().trim().max(120).optional().default(""),
  genre: z.string().trim().min(1, "Genre is required").max(120),
  description: z.string().trim().max(2000).optional().default(""),
  price: moneyField,
  releaseType: z.enum(["single", "ep", "album"]),
  explicitContent: z.boolean(),
  featuringArtists: z.string().trim().max(240).optional().default(""),
  producerCredits: z.string().trim().max(320).optional().default(""),
  songwriterCredits: z.string().trim().max(320).optional().default(""),
  releaseDate: z.string().optional().default(""),
  lyrics: z.string().trim().max(12000).optional().default(""),
  coverImageFile: fileField("Cover image", IMAGE_EXTENSIONS),
  fullAudioFile: fileField("Full audio upload", AUDIO_EXTENSIONS, { required: true }),
  previewSampleFile: fileField("Preview sample", AUDIO_EXTENSIONS),
});

export const podcastUploadSchema = z
  .object({
    episodeTitle: z.string().trim().min(1, "Episode title is required").max(180),
    podcastSeriesName: z.string().trim().min(1, "Podcast series name is required").max(180),
    episodeDescription: z.string().trim().max(3000).optional().default(""),
    seasonNumber: optionalIntegerField,
    episodeNumber: optionalIntegerField,
    category: z.string().trim().min(1, "Category is required").max(120),
    episodeType: z.enum(["free", "premium"]),
    price: moneyField,
    explicitContent: z.boolean(),
    guestNames: z.string().trim().max(320).optional().default(""),
    showNotes: z.string().trim().max(12000).optional().default(""),
    episodeTags: z.string().trim().max(320).optional().default(""),
    coverImageFile: fileField("Cover image", IMAGE_EXTENSIONS),
    fullAudioFile: fileField("Episode audio", AUDIO_EXTENSIONS, { required: true }),
    previewSampleFile: fileField("Preview sample", AUDIO_EXTENSIONS),
    transcriptFile: fileField("Transcript upload", TRANSCRIPT_EXTENSIONS),
  })
  .superRefine((value, ctx) => {
    if (value.episodeType === "premium" && Number(value.price || 0) <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Premium podcast episodes must include a price",
      });
    }
  });

export const bookUploadSchema = z.object({
  bookTitle: z.string().trim().min(1, "Book title is required").max(180),
  authorName: z.string().trim().max(120).optional().default(""),
  subtitle: z.string().trim().max(180).optional().default(""),
  synopsis: z.string().trim().max(4000).optional().default(""),
  genre: z.string().trim().min(1, "Genre is required").max(120),
  language: z.string().trim().min(1, "Language is required").max(60),
  price: moneyField,
  pageCount: optionalIntegerField,
  isbn: z.string().trim().max(40).optional().default(""),
  edition: z.string().trim().max(40).optional().default(""),
  audience: z.string().trim().max(80).optional().default(""),
  readingAge: z.string().trim().max(80).optional().default(""),
  tableOfContents: z.string().trim().max(4000).optional().default(""),
  copyrightDeclaration: z.boolean(),
  coverImageFile: fileField("Cover image", IMAGE_EXTENSIONS),
  manuscriptFile: fileField("Manuscript upload", BOOK_EXTENSIONS, { required: true }),
});
