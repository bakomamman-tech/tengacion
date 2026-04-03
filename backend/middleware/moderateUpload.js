const crypto = require("crypto");
const fsp = require("fs/promises");
const { analyzeImage } = require("../services/moderationService");
const { analyzeVideo } = require("../services/videoModerationService");
const {
  createUploadModerationCase,
} = require("../services/uploadModerationService");
const {
  moveToQuarantineStorage,
} = require("../services/storageQuarantineService");
const {
  cleanupUploadTempFiles,
  ensureUploadTempFile,
} = require("../utils/uploadTempFile");

const toMediaType = (file = {}) => {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
};

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

const flattenFiles = (files) => {
  if (!files) return [];
  if (Array.isArray(files)) return files.filter(Boolean);
  if (isFileLike(files)) return [files];
  if (typeof files === "object") {
    return Object.entries(files).flatMap(([fieldName, list]) =>
      (Array.isArray(list) ? list : [list])
        .filter(Boolean)
        .map((file) => ({ ...file, fieldname: file?.fieldname || fieldName }))
    );
  }
  return [];
};

const normalizeValue = (value = "", maxLength = 1000) =>
  String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);

const uniqueStrings = (values = []) => [...new Set(values.filter(Boolean).map((entry) => String(entry)))];

const toFileDescriptor = (file = {}) => {
  const mime = String(file?.mimetype || "").toLowerCase();
  const mediaType = mime.startsWith("video/")
    ? "video"
    : mime.startsWith("image/")
      ? "image"
      : "image";
  return {
    role: file?.fieldname || "primary",
    mediaType,
    mimeType: file?.mimetype || "",
    originalFilename: file?.originalname || file?.filename || "",
    fileSizeBytes: Number(file?.size || 0),
    file,
  };
};

const chooseWorstDecision = (results = []) => {
  const normalized = Array.isArray(results) ? results.filter(Boolean) : [];
  if (normalized.length === 0) {
    return {
      decision: "approve",
      labels: [],
      reason: "No media file to moderate.",
      confidence: 0,
      perFile: [],
    };
  }

  const labels = uniqueStrings(normalized.flatMap((entry) => entry.labels || []));
  const confidence = Math.max(...normalized.map((entry) => Number(entry.confidence || 0)), 0);
  const reject = normalized.find((entry) => entry.decision === "reject");
  const quarantine = normalized.find((entry) => entry.decision === "quarantine");
  const decision = reject ? "reject" : quarantine ? "quarantine" : "approve";
  const reason =
    (reject && reject.reason) ||
    (quarantine && quarantine.reason) ||
    normalized[0].reason ||
    "Content passed moderation checks.";

  return {
    decision,
    labels,
    reason,
    confidence,
    perFile: normalized,
  };
};

const analyzeUploadFile = async (file = {}, uploaderId = "") => {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (mime.startsWith("video/")) {
    return analyzeVideo({ localPath: file?.path || "", mimeType: mime, uploaderId });
  }
  if (mime.startsWith("image/")) {
    return analyzeImage({ localPath: file?.path || "", mimeType: mime, uploaderId });
  }
  return analyzeImage({ localPath: file?.path || "", mimeType: mime, uploaderId });
};

const cleanupFiles = async (files = []) => {
  await Promise.all(
    (Array.isArray(files) ? files : [])
      .filter((entry) => entry?.path)
      .map((entry) => fsp.unlink(entry.path).catch(() => null))
  );
};

const moderateUpload = ({
  sourceType = "upload",
  titleFields = ["title", "caption", "text"],
  descriptionFields = ["description", "details", "lyrics", "showNotes"],
  deferDecisionResponse = false,
} = {}) =>
  async (req, res, next) => {
    if (String(process.env.MODERATION_ENABLED || "true").toLowerCase() === "false") {
      return next();
    }

    try {
      const files = flattenFiles(req.files || req.file);
      if (files.length === 0) {
        return next();
      }

      await Promise.all(
        files.map((file) => ensureUploadTempFile(file, { prefix: "moderation" }))
      );

      const title =
        titleFields
          .map((field) => normalizeValue(req.body?.[field], 240))
          .find(Boolean) || "";
      const description =
        descriptionFields
          .map((field) => normalizeValue(req.body?.[field], 3000))
          .find(Boolean) || "";

      const perFileResults = [];
      for (const file of files) {
        perFileResults.push({
          ...toFileDescriptor(file),
          ...(await analyzeUploadFile(file, req.user?.id || req.user?._id || "")),
        });
      }
      const moderationUpload = chooseWorstDecision(perFileResults);
      req.moderationUpload = {
        ...moderationUpload,
        sourceType,
        files,
        generatedAt: new Date().toISOString(),
      };

      if (deferDecisionResponse || moderationUpload.decision === "approve") {
        return next();
      }

      const uploader = {
        userId: req.user?.id || req.user?._id || null,
        email: req.user?.email || "",
        username: req.user?.username || "",
        displayName: req.user?.name || "",
      };
      const tempTargetId = `pending:${sourceType}:${req.user?.id || "anonymous"}:${crypto.randomUUID()}`;
      const movedMedia = [];
      for (const file of files) {
        const quarantined = await moveToQuarantineStorage({
          file,
          caseId: tempTargetId,
          stage: "quarantine",
        });
        movedMedia.push({
          role: file?.fieldname || "primary",
          mediaType: file?.mimetype?.startsWith("video/") ? "video" : "image",
          mimeType: file?.mimetype || "",
          sourceUrl: quarantined.fileUrl,
          previewUrl: quarantined.fileUrl,
          originalFilename: file?.originalname || file?.filename || "",
          fileSizeBytes: Number(file?.size || 0),
        });
      }

      const moderationCase = await createUploadModerationCase({
        targetType: sourceType,
        targetId: tempTargetId,
        uploader,
        fileUrl: movedMedia[0]?.sourceUrl || "",
        mimeType: movedMedia[0]?.mimeType || "",
        labels: moderationUpload.labels || [],
        reason: moderationUpload.reason || "",
        confidence: moderationUpload.confidence || 0,
        status: moderationUpload.decision === "quarantine" ? "quarantined" : "rejected",
        visibility: moderationUpload.decision === "quarantine" ? "private" : "blocked",
        storageStage: "quarantine",
        subject: {
          title,
          description,
          mediaType: movedMedia[0]?.mediaType || "image",
          createdAt: new Date(),
        },
        media: movedMedia,
        file: files[0] || null,
      });

      req.moderationUpload = {
        ...req.moderationUpload,
        moderationCaseId: moderationCase?._id?.toString() || "",
      };

      return res.status(moderationUpload.decision === "quarantine" ? 202 : 422).json({
        error:
          moderationUpload.decision === "quarantine"
            ? undefined
            : "This upload violates Tengacion safety rules and could not be published.",
        message:
          moderationUpload.decision === "quarantine"
            ? "Your upload is under review by the Tengacion moderation team."
            : undefined,
        moderationStatus: moderationUpload.decision === "quarantine" ? "quarantined" : "rejected",
        reviewRequired: moderationUpload.decision === "quarantine",
      });
    } catch (error) {
      return next(error);
    } finally {
      const files = flattenFiles(req.files || req.file);
      await cleanupUploadTempFiles(files);
    }
  };

module.exports = moderateUpload;
