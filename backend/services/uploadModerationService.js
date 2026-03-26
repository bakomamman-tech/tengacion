const mongoose = require("mongoose");
const path = require("path");
const ModerationCase = require("../models/ModerationCase");
const Post = require("../models/Post");
const Video = require("../models/Video");
const { writeAuditLog } = require("./auditLogService");
const { sendModerationMessengerWarning } = require("./moderationMessengerService");
const {
  buildPrivateFileUrl,
  deleteStoredMedia,
  moveToQuarantineStorage,
  promoteToPermanentStorage,
  resolvePrivateMediaPath,
} = require("./storageQuarantineService");

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (typeof value.toString === "function") return value.toString();
  return "";
};

const uniqueStrings = (values = []) => [...new Set(values.filter(Boolean).map((entry) => String(entry)))];

const normalizeText = (value = "", maxLength = 2000) =>
  String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);

const toMediaType = (mimeType = "", fallback = "") => {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return fallback || "file";
};

const extractMediaId = (value = "") => {
  const match = String(value || "").match(/\/api\/media\/([a-f0-9]{24})(?:$|[/?#])/i);
  return match?.[1] || "";
};

const inferSeverity = ({ status = "pending", labels = [] } = {}) => {
  const normalizedLabels = uniqueStrings(labels).map((entry) => entry.toLowerCase());
  if (normalizedLabels.includes("suspected_child_exploitation")) return "CRITICAL";
  if (normalizedLabels.includes("explicit_pornography")) return "CRITICAL";
  if (normalizedLabels.includes("graphic_gore") || normalizedLabels.includes("animal_cruelty")) {
    return status === "quarantined" ? "HIGH" : "HIGH";
  }
  if (status === "approved") return "LOW";
  if (status === "pending") return "MEDIUM";
  return "HIGH";
};

const inferPriority = ({ confidence = 0, status = "pending" } = {}) => {
  const score = Math.round(Math.max(0, Math.min(1, Number(confidence) || 0)) * 100);
  if (status === "approved") return Math.min(score, 20);
  if (status === "pending") return Math.max(score, 35);
  return Math.max(score, 60);
};

const inferVisibilityDecision = (status = "pending") => {
  if (status === "approved") return "allowed";
  if (status === "quarantined") return "review";
  return "blocked";
};

const inferWorkflowState = (status = "pending") => {
  if (status === "pending") return "OPEN";
  return "RESOLVED";
};

const inferQuarantine = (status = "pending") => ({
  isQuarantined: status !== "approved",
  quarantinedAt: status !== "approved" ? new Date() : null,
  neverGeneratePreview: ["rejected", "BLOCK_SUSPECTED_CHILD_EXPLOITATION", "BLOCK_EXPLICIT_ADULT"].includes(status),
});

const normalizeAsset = (asset = {}, fallback = {}) => {
  const fileUrl = normalizeText(asset.fileUrl || asset.sourceUrl || fallback.fileUrl || "", 1200);
  const mimeType = normalizeText(asset.mimeType || fallback.mimeType || "", 120);
  const mediaType = normalizeText(asset.mediaType || toMediaType(mimeType), 40);
  const originalFilename = normalizeText(
    asset.originalFilename || fallback.originalFilename || "",
    260
  );
  const fileSizeBytes = Number(asset.fileSizeBytes || fallback.fileSizeBytes || 0);
  return {
    role: normalizeText(asset.role || "primary", 40),
    mediaId: normalizeText(asset.mediaId || extractMediaId(fileUrl), 120),
    mediaType,
    mimeType,
    sourceUrl: fileUrl,
    previewUrl: normalizeText(asset.previewUrl || fileUrl, 1200),
    restrictedPreviewUrl: normalizeText(asset.restrictedPreviewUrl || "", 1200),
    originalFilename,
    fileSizeBytes,
  };
};

const buildCaseDTO = (caseDoc = {}) => {
  const media = Array.isArray(caseDoc.media) ? caseDoc.media : [];
  const firstAsset = media[0] || {};
  const previewUrl =
    String(firstAsset.previewUrl || firstAsset.restrictedPreviewUrl || "").trim() ||
    (String(caseDoc.fileUrl || "").startsWith("private://")
      ? `/api/admin/moderation/items/${toId(caseDoc._id)}/preview`
      : String(caseDoc.fileUrl || ""));

  return {
    _id: toId(caseDoc._id),
    queue: String(caseDoc.queue || ""),
    targetType: String(caseDoc.targetType || caseDoc.subject?.targetType || ""),
    targetId: String(caseDoc.targetId || caseDoc.subject?.targetId || ""),
    status: String(caseDoc.status || "pending"),
    visibility: String(caseDoc.visibility || "private"),
    storageStage: String(caseDoc.storageStage || "temporary"),
    fileUrl: String(caseDoc.fileUrl || ""),
    mimeType: String(caseDoc.mimeType || firstAsset.mimeType || ""),
    labels: Array.isArray(caseDoc.labels) ? caseDoc.labels : Array.isArray(caseDoc.riskLabels) ? caseDoc.riskLabels : [],
    reason: String(caseDoc.reason || caseDoc.internalNotes || ""),
    confidence: Number(caseDoc.confidence || 0),
    createdAt: caseDoc.createdAt || null,
    updatedAt: caseDoc.updatedAt || null,
    reviewedAt: caseDoc.reviewedAt || null,
    reviewedBy: caseDoc.reviewedBy
      ? {
          _id: toId(caseDoc.reviewedBy._id || caseDoc.reviewedBy),
          name: caseDoc.reviewedBy.name || "",
          username: caseDoc.reviewedBy.username || "",
          email: caseDoc.reviewedBy.email || "",
          role: caseDoc.reviewedBy.role || "",
        }
      : null,
    uploader: {
      userId: toId(caseDoc.uploader?.userId),
      email: String(caseDoc.uploader?.email || ""),
      username: String(caseDoc.uploader?.username || ""),
      displayName: String(caseDoc.uploader?.displayName || ""),
    },
    subject: {
      targetType: String(caseDoc.subject?.targetType || caseDoc.targetType || ""),
      targetId: String(caseDoc.subject?.targetId || caseDoc.targetId || ""),
      title: String(caseDoc.subject?.title || ""),
      description: String(caseDoc.subject?.description || ""),
      mediaType: String(caseDoc.subject?.mediaType || firstAsset.mediaType || ""),
      createdAt: caseDoc.subject?.createdAt || null,
    },
    media: media.map((asset) => ({
      role: String(asset.role || ""),
      mediaId: String(asset.mediaId || ""),
      mediaType: String(asset.mediaType || ""),
      mimeType: String(asset.mimeType || ""),
      sourceUrl: String(asset.sourceUrl || ""),
      previewUrl: String(asset.previewUrl || ""),
      restrictedPreviewUrl: String(asset.restrictedPreviewUrl || ""),
      originalFilename: String(asset.originalFilename || ""),
      fileSizeBytes: Number(asset.fileSizeBytes || 0),
    })),
    previewUrl,
    previewKind: firstAsset.mediaType || toMediaType(caseDoc.mimeType || firstAsset.mimeType || "", "file"),
    adminActionHistory: Array.isArray(caseDoc.adminActionHistory)
      ? caseDoc.adminActionHistory.map((entry) => ({
          action: String(entry.action || ""),
          actorId: toId(entry.actorId),
          actorEmail: String(entry.actorEmail || ""),
          reason: String(entry.reason || ""),
          previousStatus: String(entry.previousStatus || ""),
          newStatus: String(entry.newStatus || ""),
          createdAt: entry.createdAt || null,
        }))
      : [],
    visibilityDecision: String(caseDoc.visibilityDecision || inferVisibilityDecision(caseDoc.status)),
    severity: String(caseDoc.severity || inferSeverity({ status: caseDoc.status, labels: caseDoc.labels || caseDoc.riskLabels || [] })),
    priorityScore: Number(caseDoc.priorityScore || inferPriority({ confidence: caseDoc.confidence, status: caseDoc.status })),
    workflowState: String(caseDoc.workflowState || inferWorkflowState(caseDoc.status)),
    quarantine: caseDoc.quarantine || inferQuarantine(caseDoc.status),
    latestDecisionSummary: caseDoc.latestDecisionSummary || null,
  };
};

const buildQueueQuery = ({ status = "", search = "" } = {}) => {
  const query = { queue: "upload_moderation" };
  if (status) {
    query.status = String(status);
  }
  const normalizedSearch = normalizeText(search, 160);
  if (normalizedSearch) {
    const regex = new RegExp(normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [
      { targetId: regex },
      { fileUrl: regex },
      { mimeType: regex },
      { reason: regex },
      { labels: regex },
      { "uploader.email": regex },
      { "uploader.username": regex },
      { "uploader.displayName": regex },
      { "subject.title": regex },
      { "subject.description": regex },
    ];
  }
  return query;
};

const isHardBlockedCsamRisk = (caseDoc = {}) => {
  const labels = uniqueStrings([
    ...(Array.isArray(caseDoc.labels) ? caseDoc.labels : []),
    ...(Array.isArray(caseDoc.riskLabels) ? caseDoc.riskLabels : []),
  ]).map((entry) => String(entry).toLowerCase());
  const text = normalizeText([caseDoc.reason, caseDoc.internalNotes, caseDoc.subject?.title, caseDoc.subject?.description]
    .filter(Boolean)
    .join(" "), 2000).toLowerCase();
  return (
    String(caseDoc.status || "") === "BLOCK_SUSPECTED_CHILD_EXPLOITATION" ||
    labels.some((entry) => entry.includes("suspected_child_exploitation") || entry.includes("csam")) ||
    text.includes("child sexual abuse") ||
    text.includes("child pornography") ||
    text.includes("csam") ||
    text.includes("underage explicit")
  );
};

const createUploadModerationCase = async ({
  targetType = "",
  targetId = "",
  uploader = {},
  fileUrl = "",
  mimeType = "",
  labels = [],
  reason = "",
  confidence = 0,
  status = "pending",
  visibility = "",
  storageStage = "",
  reviewedBy = null,
  reviewedAt = null,
  req = null,
  queue = "upload_moderation",
  subject = {},
  media = [],
  file = null,
  detectionSource = "automated_upload_scan",
}) => {
  const normalizedTargetType = normalizeText(targetType, 40);
  const normalizedTargetId = normalizeText(targetId, 120);
  const normalizedStatus = normalizeText(status, 40) || "pending";
  const normalizedLabels = uniqueStrings(labels).slice(0, 30);
  const normalizedReason = normalizeText(reason, 2000);
  const normalizedMimeType = normalizeText(mimeType || media[0]?.mimeType || "", 120);
  const normalizedFileUrl = normalizeText(fileUrl || media[0]?.fileUrl || media[0]?.sourceUrl || "", 1200);
  const primaryAsset = normalizeAsset(media[0] || {}, {
    fileUrl: normalizedFileUrl,
    mimeType: normalizedMimeType,
    originalFilename: file?.originalname || "",
    fileSizeBytes: Number(file?.size || 0),
  });
  const nextMedia = (Array.isArray(media) && media.length > 0 ? media : [primaryAsset]).map((asset, index) =>
    normalizeAsset(asset, index === 0 ? primaryAsset : {})
  );
  const nextVisibility =
    normalizeText(visibility, 20) ||
    (normalizedStatus === "approved" ? "public" : normalizedStatus === "quarantined" ? "private" : "blocked");
  const nextStorageStage =
    normalizeText(storageStage, 20) ||
    (normalizedStatus === "approved" ? "permanent" : normalizedStatus === "quarantined" ? "quarantine" : "quarantine");
  const nextSeverity = inferSeverity({ status: normalizedStatus, labels: normalizedLabels });
  const nextPriorityScore = inferPriority({ confidence, status: normalizedStatus });
  const nextWorkflowState = inferWorkflowState(normalizedStatus);
  const nextVisibilityDecision = inferVisibilityDecision(normalizedStatus);
  const uploaderId = uploader.userId || uploader.userId === 0 ? uploader.userId : null;
  const sourceMediaType = nextMedia[0]?.mediaType || toMediaType(normalizedMimeType, "image");

  const nextPayload = {
    queue: String(queue || "upload_moderation"),
    targetType: normalizedTargetType,
    targetId: normalizedTargetId,
    fileUrl: normalizedFileUrl,
    mimeType: normalizedMimeType,
    labels: normalizedLabels,
    reason: normalizedReason,
    confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
    status: normalizedStatus,
    visibility: nextVisibility,
    storageStage: nextStorageStage,
    reviewedBy: reviewedBy || null,
    reviewedAt: reviewedAt || null,
    adminActionHistory: [],
    riskLabels: normalizedLabels,
    detectionSource,
    severity: nextSeverity,
    priorityScore: nextPriorityScore,
    workflowState: nextWorkflowState,
    visibilityDecision: nextVisibilityDecision,
    subject: {
      targetType: normalizedTargetType,
      targetId: normalizedTargetId,
      title: normalizeText(subject.title || pathFallbackLabel(file, normalizedFileUrl), 240),
      description: normalizeText(subject.description || normalizedReason, 3000),
      mediaType: normalizeText(subject.mediaType || sourceMediaType, 40),
      createdAt: subject.createdAt || new Date(),
      baselineAccess: subject.baselineAccess || {
        isPublished: false,
        publishedStatus: "",
        albumStatus: "",
      },
    },
    uploader: {
      userId: uploaderId && mongoose.Types.ObjectId.isValid(uploaderId) ? uploaderId : null,
      email: normalizeText(uploader.email || "", 160).toLowerCase(),
      username: normalizeText(uploader.username || "", 80),
      displayName: normalizeText(uploader.displayName || uploader.name || "", 160),
    },
    media: nextMedia,
    quarantine: {
      isQuarantined: normalizedStatus !== "approved",
      quarantinedAt: normalizedStatus !== "approved" ? new Date() : null,
      neverGeneratePreview:
        normalizedLabels.some((entry) =>
          ["suspected_child_exploitation", "explicit_pornography"].includes(String(entry || "").toLowerCase())
        ) || normalizedStatus === "rejected",
    },
    escalation: {
      required: normalizedLabels.some((entry) => String(entry || "").toLowerCase().includes("suspected_child_exploitation")),
      status: normalizedLabels.some((entry) => String(entry || "").toLowerCase().includes("suspected_child_exploitation"))
        ? "pending_review"
        : "not_required",
      escalatedAt: null,
      escalatedBy: null,
      notes: normalizedReason,
    },
    publicWarningLabel: normalizedStatus === "approved" ? "" : normalizedReason || "Sensitive content under review",
    internalNotes: normalizedReason,
    latestDecisionSummary: {
      actionType: normalizedStatus,
      adminUserId: reviewedBy || null,
      adminEmail: normalizeText(uploader.email || "", 160).toLowerCase(),
      previousStatus: "pending",
      newStatus: normalizedStatus,
      reason: normalizedReason,
      decidedAt: reviewedAt || null,
    },
  };

  const moderationCase = await ModerationCase.findOneAndUpdate(
    {
      queue: "upload_moderation",
      targetType: normalizedTargetType,
      targetId: normalizedTargetId,
    },
    {
      $set: nextPayload,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  moderationCase.adminActionHistory = Array.isArray(moderationCase.adminActionHistory)
    ? moderationCase.adminActionHistory
    : [];
  moderationCase.media = nextMedia;
  moderationCase.labels = normalizedLabels;
  moderationCase.riskLabels = normalizedLabels;
  moderationCase.reason = normalizedReason;
  moderationCase.confidence = Math.max(0, Math.min(1, Number(confidence) || 0));
  moderationCase.fileUrl = normalizedFileUrl;
  moderationCase.mimeType = normalizedMimeType;
  moderationCase.targetType = normalizedTargetType;
  moderationCase.targetId = normalizedTargetId;
  moderationCase.visibility = nextVisibility;
  moderationCase.storageStage = nextStorageStage;
  moderationCase.reviewedBy = reviewedBy || null;
  moderationCase.reviewedAt = reviewedAt || null;
  moderationCase.subject = nextPayload.subject;
  moderationCase.uploader = nextPayload.uploader;
  moderationCase.quarantine = nextPayload.quarantine;
  moderationCase.visibilityDecision = nextVisibilityDecision;
  moderationCase.workflowState = nextWorkflowState;
  moderationCase.severity = nextSeverity;
  moderationCase.priorityScore = nextPriorityScore;
  moderationCase.detectionSource = detectionSource;
  moderationCase.publicWarningLabel = nextPayload.publicWarningLabel;
  moderationCase.internalNotes = normalizedReason;
  moderationCase.latestDecisionSummary = nextPayload.latestDecisionSummary;
  await moderationCase.save();

  return moderationCase;
};

const pathFallbackLabel = (file = null, fileUrl = "") =>
  normalizeText(file?.originalname || path.basename(String(fileUrl || "")) || "Uploaded media", 240);

const listModerationItems = async ({ status = "", page = 1, limit = 20, search = "" } = {}) => {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const skip = (normalizedPage - 1) * normalizedLimit;
  const query = buildQueueQuery({ status, search });

  const [rows, total] = await Promise.all([
    ModerationCase.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(normalizedLimit)
      .populate("reviewedBy", "_id name username email role")
      .populate("uploader.userId", "_id name username email role")
      .lean(),
    ModerationCase.countDocuments(query),
  ]);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    total,
    items: rows.map((row) => buildCaseDTO(row)),
  };
};

const getModerationItem = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid moderation item id");
    error.status = 400;
    throw error;
  }

  const item = await ModerationCase.findOne({ _id: id, queue: "upload_moderation" })
    .populate("reviewedBy", "_id name username email role")
    .populate("uploader.userId", "_id name username email role")
    .lean();
  if (!item) {
    const error = new Error("Moderation item not found");
    error.status = 404;
    throw error;
  }

  return buildCaseDTO(item);
};

const resolveTargetModel = (targetType = "") => {
  const normalized = String(targetType || "").trim().toLowerCase();
  if (normalized === "post") return Post;
  if (normalized === "video") return Video;
  return null;
};

const applyCaseStateToTarget = async ({ moderationCase, status, actorId = null }) => {
  const model = resolveTargetModel(moderationCase.targetType || moderationCase.subject?.targetType);
  if (!model || !mongoose.Types.ObjectId.isValid(moderationCase.targetId || moderationCase.subject?.targetId)) {
    return null;
  }

  const targetId = moderationCase.targetId || moderationCase.subject?.targetId;
  const target = await model.findById(targetId);
  if (!target) {
    return null;
  }

  const nextStatus = String(status || moderationCase.status || "pending");
  const nextVisibility =
    nextStatus === "approved"
      ? "public"
      : nextStatus === "quarantined"
        ? "private"
        : "blocked";
  const nextStage =
    nextStatus === "approved"
      ? "permanent"
      : nextStatus === "quarantined"
        ? "quarantine"
        : "quarantine";

  target.visibility = nextVisibility;
  target.moderationStatus = nextStatus;
  target.moderationLabels = Array.isArray(moderationCase.labels) ? moderationCase.labels : [];
  target.moderationReason = String(moderationCase.reason || "");
  target.moderationConfidence = Number(moderationCase.confidence || 0);
  target.reviewedBy = actorId || moderationCase.reviewedBy || null;
  target.reviewedAt = new Date();
  target.storageStage = nextStage;
  target.moderationCaseId = moderationCase._id;

  const fileUrl = String(moderationCase.fileUrl || "").trim();
  if (target instanceof Post) {
    if (fileUrl) {
      const firstMedia = Array.isArray(target.media) && target.media.length > 0 ? target.media[0] : null;
      if (firstMedia) {
        target.media[0].url = fileUrl;
        if (firstMedia.type === "video") {
          target.video = {
            ...(target.video || {}),
            url: fileUrl,
            playbackUrl: fileUrl,
            thumbnailUrl: target.video?.thumbnailUrl || "",
            mimeType: moderationCase.mimeType || target.video?.mimeType || "",
          };
        }
      } else if (fileUrl) {
        target.media = [{ public_id: "", url: fileUrl, type: toMediaType(moderationCase.mimeType, "image") }];
      }
    }
  }

  if (target instanceof Video && fileUrl) {
    target.videoUrl = fileUrl;
    if (!target.coverImageUrl && moderationCase.media?.[0]?.previewUrl) {
      target.coverImageUrl = moderationCase.media[0].previewUrl;
    }
    if (!target.previewClipUrl && moderationCase.media?.[1]?.fileUrl) {
      target.previewClipUrl = moderationCase.media[1].fileUrl;
    }
    target.videoFormat = target.videoFormat || path.extname(fileUrl).replace(/^\./, "");
  }

  await target.save();
  return target;
};

const applyModerationAction = async ({
  itemId,
  action,
  reason = "",
  actor = {},
  req = null,
}) => {
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    const error = new Error("Invalid moderation item id");
    error.status = 400;
    throw error;
  }

  const normalizedAction = String(action || "").trim().toLowerCase();
  const moderationCase = await ModerationCase.findOne({ _id: itemId, queue: "upload_moderation" });
  if (!moderationCase) {
    const error = new Error("Moderation item not found");
    error.status = 404;
    throw error;
  }

  const previousStatus = String(moderationCase.status || "pending");
  const normalizedReason = normalizeText(reason, 1000);
  const actorId = actor?._id || actor?.id || null;
  const actorEmail = String(actor?.email || "").toLowerCase();

  let nextStatus = previousStatus;
  let nextVisibility = String(moderationCase.visibility || "private");
  let nextStorageStage = String(moderationCase.storageStage || "temporary");

  if (normalizedAction === "approve") {
    if (isHardBlockedCsamRisk(moderationCase) && String(actor?.role || "").toLowerCase() !== "super_admin") {
      const error = new Error("This item cannot be approved without elevated review");
      error.status = 403;
      throw error;
    }

    nextStatus = "approved";
    nextVisibility = "public";
    nextStorageStage = "permanent";
    if (String(moderationCase.fileUrl || "").startsWith("private://")) {
      const promoted = await promoteToPermanentStorage({
        fileUrl: moderationCase.fileUrl,
      });
      moderationCase.fileUrl = promoted.url;
      moderationCase.media = (Array.isArray(moderationCase.media) ? moderationCase.media : []).map((asset, index) =>
        index === 0
          ? {
              ...asset,
              sourceUrl: promoted.url,
              previewUrl: promoted.url,
              mediaId: promoted.public_id || asset.mediaId || "",
              mimeType: promoted.resource_type === "video" ? "video/mp4" : promoted.resource_type === "image" ? "image/jpeg" : asset.mimeType,
            }
          : asset
      );
    }
  } else if (normalizedAction === "quarantine") {
    nextStatus = "quarantined";
    nextVisibility = "private";
    nextStorageStage = "quarantine";
    if (String(moderationCase.fileUrl || "").startsWith("private://")) {
      const quarantined = await moveToQuarantineStorage({
        fileUrl: moderationCase.fileUrl,
        caseId: toId(moderationCase._id),
        stage: "quarantine",
      });
      moderationCase.fileUrl = quarantined.fileUrl;
    }
  } else if (normalizedAction === "reject") {
    nextStatus = "rejected";
    nextVisibility = "blocked";
    nextStorageStage = "quarantine";
  } else if (normalizedAction === "remove") {
    nextStatus = "rejected";
    nextVisibility = "blocked";
    nextStorageStage = "quarantine";
    await deleteStoredMedia({
      fileUrl: moderationCase.fileUrl,
    });
  } else {
    const error = new Error("Unsupported moderation action");
    error.status = 400;
    throw error;
  }

  moderationCase.status = nextStatus;
  moderationCase.visibility = nextVisibility;
  moderationCase.storageStage = nextStorageStage;
  moderationCase.reviewedBy = actorId || null;
  moderationCase.reviewedAt = new Date();
  moderationCase.reason = normalizedReason || moderationCase.reason || "";
  moderationCase.labels = Array.isArray(moderationCase.labels) ? moderationCase.labels : [];
  moderationCase.adminActionHistory = Array.isArray(moderationCase.adminActionHistory)
    ? moderationCase.adminActionHistory
    : [];
  moderationCase.adminActionHistory.push({
    action: normalizedAction,
    actorId: actorId || null,
    actorEmail,
    reason: normalizedReason,
    previousStatus,
    newStatus: nextStatus,
    createdAt: new Date(),
  });
  moderationCase.history = Array.isArray(moderationCase.history) ? moderationCase.history : [];
  moderationCase.history.push({
    actionType: normalizedAction,
    adminUserId: actorId || null,
    adminEmail: actorEmail,
    previousStatus,
    newStatus: nextStatus,
    reason: normalizedReason,
    createdAt: new Date(),
  });
  moderationCase.latestDecisionSummary = {
    actionType: normalizedAction,
    adminUserId: actorId || null,
    adminEmail: actorEmail,
    previousStatus,
    newStatus: nextStatus,
    reason: normalizedReason,
    decidedAt: new Date(),
  };

  await moderationCase.save();
  await applyCaseStateToTarget({
    moderationCase,
    status: nextStatus,
    actorId,
  });

  await writeAuditLog({
    req,
    actorId,
    action: `admin.upload_moderation.${normalizedAction}`,
    targetType: "ModerationCase",
    targetId: toId(moderationCase._id),
    reason: normalizedReason,
    metadata: {
      previousStatus,
      newStatus: nextStatus,
      targetType: moderationCase.targetType || moderationCase.subject?.targetType || "",
      targetId: moderationCase.targetId || moderationCase.subject?.targetId || "",
    },
  }).catch(() => null);

  await sendModerationMessengerWarning({
    req,
    actor,
    recipientId: moderationCase.uploader?.userId || "",
    action: normalizedAction,
    reason: normalizedReason || moderationCase.reason || "",
    scope: "content",
    subjectTitle: moderationCase.subject?.title || moderationCase.targetId || moderationCase.subject?.targetId || "",
    subjectDescription: moderationCase.subject?.description || "",
    labels: Array.isArray(moderationCase.labels) ? moderationCase.labels : [],
    clientSeed: toId(moderationCase._id),
  }).catch(() => null);

  return buildCaseDTO(moderationCase.toObject());
};

module.exports = {
  applyModerationAction,
  applyCaseStateToTarget,
  buildCaseDTO,
  createUploadModerationCase,
  getModerationItem,
  isHardBlockedCsamRisk,
  listModerationItems,
  moveToQuarantineStorage,
  promoteToPermanentStorage,
  resolvePrivateMediaPath,
};
