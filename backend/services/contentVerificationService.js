const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");

const Album = require("../models/Album");
const Book = require("../models/Book");
const Track = require("../models/Track");
const Video = require("../models/Video");

const SCAN_STATUSES = ["pending_scan", "passed", "flagged", "blocked"];
const PUBLISHED_STATUSES = ["draft", "published", "under_review", "blocked"];

const SUSPICIOUS_KEYWORDS = [
  "reupload",
  "unofficial",
  "mirror",
  "bootleg",
  "leak",
  "leaked",
  "pirated",
  "unauthorized",
  "rip",
];

const BLOCKED_KEYWORDS = [
  "stolen",
  "stolen copy",
  "camrip",
  "screen recording",
  "unauthorized rip",
];

const escapeRegExp = (value = "") => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hashFileFromDisk = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });

const hashBuffer = async (buffer) =>
  createHash("sha256")
    .update(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || ""))
    .digest("hex");

const getFileHash = async (file) => {
  if (Buffer.isBuffer(file?.buffer) && file.buffer.length > 0) {
    try {
      return await hashBuffer(file.buffer);
    } catch {
      return createHash("sha256")
        .update([
          path.basename(String(file.originalname || "")),
          String(file.size || 0),
          String(file.mimetype || ""),
        ].join("|"))
        .digest("hex");
    }
  }

  if (!file?.path) {
    return "";
  }

  try {
    return await hashFileFromDisk(file.path);
  } catch {
    return createHash("sha256")
      .update([
        path.basename(String(file.originalname || "")),
        String(file.size || 0),
        String(file.mimetype || ""),
      ].join("|"))
      .digest("hex");
  }
};

const getVerificationTarget = ({ creatorCategory = "", contentType = "" }) => {
  const normalizedCategory = String(creatorCategory || "").trim().toLowerCase();
  const normalizedContentType = String(contentType || "").trim().toLowerCase();

  if (normalizedContentType === "album" || normalizedContentType === "ep") {
    return {
      model: Album,
      label: "album",
      titleField: "title",
      baseQuery: { archivedAt: null },
    };
  }

  if (normalizedContentType === "music_video") {
    return {
      model: Video,
      label: "music_video",
      titleField: "caption",
      baseQuery: { archivedAt: null },
    };
  }

  if (normalizedCategory === "books" || normalizedContentType === "ebook" || normalizedContentType === "pdf_book") {
    return {
      model: Book,
      label: "book",
      titleField: "title",
      baseQuery: { archivedAt: null },
    };
  }

  if (normalizedCategory === "podcasts" || normalizedContentType === "podcast_episode" || normalizedContentType === "series") {
    return {
      model: Track,
      label: "podcast_episode",
      titleField: "title",
      baseQuery: { archivedAt: null, kind: "podcast" },
    };
  }

  return {
    model: Track,
    label: "track",
    titleField: "title",
    baseQuery: { archivedAt: null, kind: { $in: ["music", null] } },
  };
};

const buildFingerprintHash = ({
  fileHash = "",
  title = "",
  description = "",
  creatorCategory = "",
  contentType = "",
  metadata = {},
}) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        fileHash,
        title: String(title || "").trim().toLowerCase(),
        description: String(description || "").trim().toLowerCase().slice(0, 400),
        creatorCategory: String(creatorCategory || "").trim().toLowerCase(),
        contentType: String(contentType || "").trim().toLowerCase(),
        metadata: metadata || {},
      })
    )
    .digest("hex");

const buildPublishedStatus = ({ requestedStatus = "published", scanStatus = "pending_scan", reviewRequired = false }) => {
  if (scanStatus === "blocked") {
    return "blocked";
  }
  if (requestedStatus === "draft") {
    return "draft";
  }
  if (reviewRequired || scanStatus === "flagged") {
    return "under_review";
  }
  return "published";
};

const collectKeywordSignals = (text = "") => {
  const normalized = String(text || "").trim().toLowerCase();
  const suspiciousMatches = SUSPICIOUS_KEYWORDS.filter((entry) => normalized.includes(entry));
  const blockedMatches = BLOCKED_KEYWORDS.filter((entry) => normalized.includes(entry));
  return { suspiciousMatches, blockedMatches };
};

const getDuplicateMatches = async ({
  creatorProfileId,
  title = "",
  creatorCategory = "",
  contentType = "",
  fileHash = "",
  fingerprintHash = "",
}) => {
  const target = getVerificationTarget({ creatorCategory, contentType });
  const titleRegex = title ? new RegExp(`^${escapeRegExp(title.trim())}$`, "i") : null;

  const [sameFingerprint, sameTitle] = await Promise.all([
    fileHash || fingerprintHash
      ? target.model
          .find({
            ...target.baseQuery,
            $or: [
              fileHash ? { contentFileHash: fileHash } : null,
              fingerprintHash ? { contentFingerprintHash: fingerprintHash } : null,
            ].filter(Boolean),
          })
          .select("_id creatorId creatorProfileId title caption")
          .lean()
      : [],
    titleRegex
      ? target.model
          .find({
            ...target.baseQuery,
            [target.titleField]: titleRegex,
          })
          .select("_id creatorId creatorProfileId title caption")
          .lean()
      : [],
  ]);

  const normalizedCreatorId = String(creatorProfileId || "");
  const exactCreatorMatch = sameFingerprint.find((entry) => {
    const ownerId = String(entry?.creatorId || entry?.creatorProfileId || "");
    return ownerId && ownerId === normalizedCreatorId;
  });
  const exactOtherCreatorMatch = sameFingerprint.find((entry) => {
    const ownerId = String(entry?.creatorId || entry?.creatorProfileId || "");
    return ownerId && ownerId !== normalizedCreatorId;
  });
  const duplicateTitleSameCreator = sameTitle.find((entry) => {
    const ownerId = String(entry?.creatorId || entry?.creatorProfileId || "");
    return ownerId && ownerId === normalizedCreatorId;
  });
  const duplicateTitleOtherCreator = sameTitle.find((entry) => {
    const ownerId = String(entry?.creatorId || entry?.creatorProfileId || "");
    return ownerId && ownerId !== normalizedCreatorId;
  });

  return {
    exactCreatorMatch,
    exactOtherCreatorMatch,
    duplicateTitleSameCreator,
    duplicateTitleOtherCreator,
  };
};

const evaluateVerification = async ({
  creatorProfileId,
  creatorCategory,
  contentType,
  requestedStatus = "published",
  title = "",
  description = "",
  primaryFile = null,
  metadata = {},
}) => {
  const textForScreening = [title, description, metadata?.authorName, metadata?.seriesName]
    .filter(Boolean)
    .join(" | ");

  const { suspiciousMatches, blockedMatches } = collectKeywordSignals(textForScreening);
  const fileHash = await getFileHash(primaryFile);
  const fingerprintHash = buildFingerprintHash({
    fileHash,
    title,
    description,
    creatorCategory,
    contentType,
    metadata,
  });

  const duplicates = await getDuplicateMatches({
    creatorProfileId,
    title,
    creatorCategory,
    contentType,
    fileHash,
    fingerprintHash,
  });

  const notes = ["Queued for metadata and duplicate screening."];
  let scanStatus = "pending_scan";
  let reviewRequired = false;

  if (blockedMatches.length) {
    scanStatus = "blocked";
    reviewRequired = true;
    notes.push(`Blocked keyword match detected: ${blockedMatches.join(", ")}.`);
  }

  if (duplicates.exactOtherCreatorMatch) {
    scanStatus = "blocked";
    reviewRequired = true;
    notes.push("A matching upload fingerprint already exists for another creator account.");
  }

  if (scanStatus !== "blocked" && duplicates.exactCreatorMatch) {
    scanStatus = "flagged";
    reviewRequired = true;
    notes.push("A matching upload fingerprint already exists in your catalog.");
  }

  if (scanStatus !== "blocked" && suspiciousMatches.length) {
    scanStatus = "flagged";
    reviewRequired = true;
    notes.push(`Suspicious rights-related wording detected: ${suspiciousMatches.join(", ")}.`);
  }

  if (scanStatus !== "blocked" && duplicates.duplicateTitleOtherCreator) {
    scanStatus = "flagged";
    reviewRequired = true;
    notes.push("A similar title already exists under another creator profile and should be reviewed.");
  }

  if (scanStatus !== "blocked" && duplicates.duplicateTitleSameCreator) {
    scanStatus = "flagged";
    reviewRequired = true;
    notes.push("A release with the same title already exists in your workspace.");
  }

  if (scanStatus === "pending_scan") {
    scanStatus = "passed";
    notes.push("Metadata screening passed and the upload is ready for publication.");
  }

  const publishedStatus = buildPublishedStatus({
    requestedStatus,
    scanStatus,
    reviewRequired,
  });

  return {
    scanStatus,
    reviewRequired,
    verificationNotes: notes.join(" "),
    publishedStatus,
    contentFingerprintHash: fingerprintHash,
    contentFileHash: fileHash,
    screeningSummary: {
      stage: "metadata_screening",
      queuedForDeepScan: true,
      suspiciousMatches,
      blockedMatches,
    },
  };
};

module.exports = {
  SCAN_STATUSES,
  PUBLISHED_STATUSES,
  evaluateVerification,
};
