const crypto = require("crypto");
const fsp = require("fs/promises");
const { createOrUpdateModerationCase } = require("../services/moderationService");

const toMediaType = (file = {}) => {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
};

const flattenFiles = (files) => {
  if (!files) return [];
  if (Array.isArray(files)) return files.filter(Boolean);
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

      const title = titleFields
        .map((field) => normalizeValue(req.body?.[field], 240))
        .find(Boolean) || "";
      const description = descriptionFields
        .map((field) => normalizeValue(req.body?.[field], 3000))
        .find(Boolean) || "";
      const uploader = {
        userId: req.user?.id || req.user?._id || null,
        email: req.user?.email || "",
        username: req.user?.username || "",
        displayName: req.user?.name || "",
      };
      const targetId = `pending:${sourceType}:${req.user?.id || "anonymous"}:${crypto.randomUUID()}`;

      const { moderationDecision, moderationCase } = await createOrUpdateModerationCase({
        targetType: sourceType,
        targetId,
        title,
        description,
        metadata: req.body || {},
        media: files.map((file) => ({
          role: file?.fieldname || "primary",
          mediaType: toMediaType(file),
          mimeType: file?.mimetype || "",
          originalFilename: file?.originalname || file?.filename || "",
          fileSizeBytes: Number(file?.size || 0),
          file,
        })),
        uploader,
        detectionSource: "automated_upload_scan",
        req,
      });

      req.moderationUpload = {
        moderationDecision,
        moderationCaseId: moderationCase?._id?.toString() || "",
      };

      if (moderationDecision?.status === "ALLOW") {
        return next();
      }

      if (
        moderationDecision?.status === "BLOCK_SUSPECTED_CHILD_EXPLOITATION"
        || moderationDecision?.status === "BLOCK_EXPLICIT_ADULT"
      ) {
        await cleanupFiles(files);
        return res.status(422).json({
          error: "This upload violates Tengacion's safety rules and cannot be published.",
          moderationStatus: moderationDecision.status,
          reviewRequired: false,
        });
      }

      await cleanupFiles(files);
      return res.status(202).json({
        message: "This media is under review because it may contain sensitive or prohibited content.",
        moderationStatus: moderationDecision?.status || "HOLD_FOR_REVIEW",
        reviewRequired: true,
      });
    } catch (error) {
      return next(error);
    }
  };

module.exports = moderateUpload;
