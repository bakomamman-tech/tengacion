const asyncHandler = require("../middleware/asyncHandler");
const {
  createUploadModerationCase,
} = require("../services/uploadModerationService");
const {
  moveToQuarantineStorage,
} = require("../services/storageQuarantineService");
const User = require("../models/User");
const Video = require("../models/Video");
const { saveUploadedMedia } = require("../services/mediaStore");
const { logAnalyticsEvent } = require("../services/analyticsService");
const { evaluateVerification } = require("../services/contentVerificationService");
const { creatorHasCategory } = require("../services/creatorProfileService");
const { cleanupReplacedMedia, mediaDocumentToUrl, toMediaDocument } = require("../utils/cloudinaryMedia");
const {
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
  VIDEO_EXTENSIONS,
  VIDEO_MIME_TYPES,
  getExtension,
  validateFile,
} = require("../services/creatorUploadValidation");

const sendBadRequest = (res, error) => res.status(400).json({ error });

const persistUploadAsset = async ({ file = null, decision = "approve", caseId = "" }) => {
  if (!file) {
    return { url: "", fileUrl: "", media: null, storageStage: "temporary" };
  }

  if (decision === "approve") {
    const uploaded = await saveUploadedMedia(file, {
      source: file?.mimetype?.startsWith("image/") ? "creator_video_cover" : "creator_video",
      resourceType: file?.mimetype?.startsWith("image/") ? "image" : "video",
    });
    return {
      url: mediaDocumentToUrl(uploaded),
      fileUrl: mediaDocumentToUrl(uploaded),
      media: toMediaDocument(uploaded),
      storageStage: "permanent",
    };
  }

  const quarantined = await moveToQuarantineStorage({
    file,
    caseId,
    stage: "quarantine",
  });
  return {
    url: quarantined.fileUrl,
    fileUrl: quarantined.fileUrl,
    media: null,
    storageStage: "quarantine",
  };
};

const parseNonNegativeNumber = (value, { fallback = 0 } = {}) => {
  if (value === "" || value === undefined || value === null) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Number.NaN;
  }
  return parsed;
};

const inferUploadedFormat = (file) => {
  const extension = getExtension(file);
  return extension ? extension.slice(1) : String(file?.mimetype || "").split("/")[1] || "";
};

const resolveRequestedStatus = (body = {}) => {
  const value = String(body?.publishedStatus || body?.publishMode || body?.status || "")
    .trim()
    .toLowerCase();
  if (value === "draft" || body?.saveAsDraft === true || body?.saveAsDraft === "true") {
    return "draft";
  }
  return "published";
};

const toVideoPayload = (video) => ({
  _id: String(video?._id || ""),
  title: String(video?.caption || "Music video"),
  description: String(video?.description || video?.caption || ""),
  videoUrl: mediaDocumentToUrl(video?.videoMedia, video?.videoUrl || ""),
  coverImageUrl: mediaDocumentToUrl(video?.coverMedia, video?.coverImageUrl || ""),
  previewClipUrl: mediaDocumentToUrl(video?.previewClipMedia, video?.previewClipUrl || ""),
  price: Number(video?.price || 0),
  isFree: Boolean(video?.isFree),
  durationSec: Number(video?.durationSec || 0),
  videoFormat: String(video?.videoFormat || ""),
  creatorCategory: String(video?.creatorCategory || "music"),
  contentType: String(video?.contentType || "music_video"),
  publishedStatus: String(video?.publishedStatus || (video?.isPublished ? "published" : "draft")),
  copyrightScanStatus: String(video?.copyrightScanStatus || "pending_scan"),
  verificationNotes: String(video?.verificationNotes || ""),
  reviewRequired: Boolean(video?.reviewRequired),
  viewsCount: Number(video?.viewsCount || 0),
  createdAt: video?.createdAt || video?.time || null,
  updatedAt: video?.updatedAt || video?.time || null,
});

const resolveUploadFields = async ({ req, current = null }) => {
  let videoUrl = String(req.body?.videoUrl || current?.videoUrl || "").trim();
  let coverImageUrl = String(req.body?.coverImageUrl || current?.coverImageUrl || "").trim();
  let previewClipUrl = String(req.body?.previewClipUrl || current?.previewClipUrl || "").trim();

  const videoFile = req.files?.video?.[0] || null;
  const thumbnailFile = req.files?.thumbnail?.[0] || null;
  const previewClipFile = req.files?.previewClip?.[0] || null;

  return {
    videoUrl,
    coverImageUrl,
    previewClipUrl,
    videoFile,
    thumbnailFile,
    previewClipFile,
  };
};

exports.createCreatorVideo = asyncHandler(async (req, res) => {
  if (!creatorHasCategory(req.creatorProfile, "music")) {
    return res.status(403).json({ error: "Music publishing is not enabled on this creator profile" });
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const title = String(req.body?.title || req.body?.caption || "").trim();
  const description = String(req.body?.description || "").trim();
  const price = parseNonNegativeNumber(req.body?.price, { fallback: 0 });
  const durationSec = parseNonNegativeNumber(req.body?.durationSec, { fallback: 0 });
  const requestedStatus = resolveRequestedStatus(req.body);
  let {
    videoUrl,
    coverImageUrl,
    previewClipUrl,
    videoFile,
    thumbnailFile,
    previewClipFile,
  } = await resolveUploadFields({
    req,
  });
  let videoMedia = null;
  let coverMedia = null;
  let previewClipMedia = null;

  if (!videoUrl && !videoFile) {
    return sendBadRequest(res, "Video file or videoUrl is required");
  }
  if (!Number.isFinite(price)) {
    return sendBadRequest(res, "price must be a valid non-negative number");
  }
  if (!Number.isFinite(durationSec)) {
    return sendBadRequest(res, "durationSec must be a valid non-negative number");
  }

  const videoError = validateFile(videoFile, {
    label: "Video upload",
    allowedExtensions: VIDEO_EXTENSIONS,
    allowedMimeTypes: VIDEO_MIME_TYPES,
  });
  if (videoError) {
    return sendBadRequest(res, videoError);
  }

  const previewError = validateFile(previewClipFile, {
    label: "Preview clip",
    allowedExtensions: VIDEO_EXTENSIONS,
    allowedMimeTypes: VIDEO_MIME_TYPES,
  });
  if (previewError) {
    return sendBadRequest(res, previewError);
  }

  const thumbnailError = validateFile(thumbnailFile, {
    label: "Thumbnail image",
    allowedExtensions: IMAGE_EXTENSIONS,
    allowedMimeTypes: IMAGE_MIME_TYPES,
  });
  if (thumbnailError) {
    return sendBadRequest(res, thumbnailError);
  }

  const moderationUploadDecision = req.moderationUpload || {
    decision: "approve",
    labels: [],
    reason: "",
    confidence: 0,
  };

  if (videoFile || thumbnailFile || previewClipFile) {
    if (moderationUploadDecision.decision !== "approve") {
      const tempTargetId = `pending:creator_video_upload:${req.user.id}:${new Date().getTime()}`;
      const videoAsset = videoFile
        ? await persistUploadAsset({
            file: videoFile,
            decision: "quarantine",
            caseId: tempTargetId,
          })
        : { url: videoUrl, fileUrl: videoUrl };
      const coverAsset = thumbnailFile
        ? await persistUploadAsset({
            file: thumbnailFile,
            decision: "quarantine",
            caseId: tempTargetId,
          })
        : { url: coverImageUrl, fileUrl: coverImageUrl };
      const previewAsset = previewClipFile
        ? await persistUploadAsset({
            file: previewClipFile,
            decision: "quarantine",
            caseId: tempTargetId,
          })
        : { url: previewClipUrl, fileUrl: previewClipUrl };

      await createUploadModerationCase({
        targetType: "creator_video_upload",
        targetId: tempTargetId,
        uploader: {
          userId: req.user.id,
          email: user.email || "",
          username: user.username || "",
          displayName: user.name || "",
        },
        fileUrl: videoAsset.fileUrl || coverAsset.fileUrl || previewAsset.fileUrl || "",
        mimeType: videoFile?.mimetype || thumbnailFile?.mimetype || previewClipFile?.mimetype || "",
        labels: moderationUploadDecision.labels || [],
        reason: moderationUploadDecision.reason || "",
        confidence: moderationUploadDecision.confidence || 0,
        status: moderationUploadDecision.decision === "quarantine" ? "quarantined" : "rejected",
        visibility: moderationUploadDecision.decision === "quarantine" ? "private" : "blocked",
        storageStage: "quarantine",
        subject: {
          title: title || description || "Music video",
          description,
          mediaType: "video",
          createdAt: new Date(),
        },
        media: [
          {
            role: "primary",
            mediaType: "video",
            mimeType: videoFile?.mimetype || "",
            sourceUrl: videoAsset.fileUrl || "",
            previewUrl: previewAsset.fileUrl || videoAsset.fileUrl || "",
            originalFilename: videoFile?.originalname || videoFile?.filename || "",
            fileSizeBytes: Number(videoFile?.size || 0),
          },
          ...(thumbnailFile
            ? [
                {
                  role: "thumbnail",
                  mediaType: "image",
                  mimeType: thumbnailFile.mimetype || "",
                  sourceUrl: coverAsset.fileUrl || "",
                  previewUrl: coverAsset.fileUrl || "",
                  originalFilename: thumbnailFile.originalname || thumbnailFile.filename || "",
                  fileSizeBytes: Number(thumbnailFile.size || 0),
                },
              ]
            : []),
          ...(previewClipFile
            ? [
                {
                  role: "preview_clip",
                  mediaType: "video",
                  mimeType: previewClipFile.mimetype || "",
                  sourceUrl: previewAsset.fileUrl || "",
                  previewUrl: previewAsset.fileUrl || "",
                  originalFilename: previewClipFile.originalname || previewClipFile.filename || "",
                  fileSizeBytes: Number(previewClipFile.size || 0),
                },
              ]
            : []),
        ],
        file: videoFile || thumbnailFile || previewClipFile || null,
      });

      return res.status(moderationUploadDecision.decision === "quarantine" ? 202 : 422).json({
        error:
          moderationUploadDecision.decision === "quarantine"
            ? undefined
            : "This upload violates Tengacion safety rules and could not be published.",
        message:
          moderationUploadDecision.decision === "quarantine"
            ? "Your upload is under review by the Tengacion moderation team."
            : undefined,
        moderationStatus: moderationUploadDecision.decision === "quarantine" ? "quarantined" : "rejected",
        reviewRequired: moderationUploadDecision.decision === "quarantine",
      });
    }

    if (videoFile) {
      const persisted = await persistUploadAsset({
        file: videoFile,
        decision: "approve",
        caseId: `approved:creator_video_upload:${req.user.id}:${new Date().getTime()}`,
      });
      videoUrl = persisted.url;
      videoMedia = persisted.media;
    }
    if (thumbnailFile) {
      const persisted = await persistUploadAsset({
        file: thumbnailFile,
        decision: "approve",
        caseId: `approved:creator_video_upload:${req.user.id}:${new Date().getTime()}`,
      });
      coverImageUrl = persisted.url;
      coverMedia = persisted.media;
    }
    if (previewClipFile) {
      const persisted = await persistUploadAsset({
        file: previewClipFile,
        decision: "approve",
        caseId: `approved:creator_video_upload:${req.user.id}:${new Date().getTime()}`,
      });
      previewClipUrl = persisted.url;
      previewClipMedia = persisted.media;
    }
  }

  if (!videoUrl) {
    return sendBadRequest(res, "Video file or videoUrl is required");
  }
  if (requestedStatus === "published" && price > 0 && !previewClipUrl) {
    return sendBadRequest(res, "A preview clip is required before publishing a paid music video");
  }

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory: "music",
    contentType: "music_video",
    requestedStatus,
    title,
    description,
    primaryFile: videoFile || thumbnailFile || null,
    metadata: {
      creatorId: req.creatorProfile?._id?.toString?.() || "",
      hasPreviewClip: Boolean(previewClipUrl),
      durationSec,
    },
  });

  const video = await Video.create({
    userId: user._id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    creatorProfileId: req.creatorProfile?._id || null,
    videoUrl,
    videoMedia,
    coverImageUrl,
    coverMedia,
    previewClipUrl,
    previewClipMedia,
    caption: title || description || "",
    description,
    durationSec,
    videoFormat: inferUploadedFormat(videoFile),
    price,
    isFree: price <= 0,
    creatorCategory: "music",
    contentType: "music_video",
    publishedStatus: verification.publishedStatus,
    copyrightScanStatus: verification.scanStatus,
    verificationNotes: verification.verificationNotes,
    reviewRequired: verification.reviewRequired,
    contentFingerprintHash: verification.contentFingerprintHash,
    contentFileHash: verification.contentFileHash,
    isPublished: verification.publishedStatus === "published",
    visibility: verification.publishedStatus === "published" ? "public" : "private",
    moderationStatus: "approved",
    moderationLabels: moderationUploadDecision.labels || [],
    moderationReason: moderationUploadDecision.reason || "",
    moderationConfidence: Number(moderationUploadDecision.confidence || 0),
    reviewedBy: null,
    reviewedAt: null,
    storageStage: "permanent",
    archivedAt: null,
    likes: [],
    comments: [],
  });

  await createUploadModerationCase({
    targetType: "video",
    targetId: video._id.toString(),
    uploader: {
      userId: req.user.id,
      email: user.email || "",
      username: user.username || "",
      displayName: user.name || "",
    },
    fileUrl: video.videoUrl || "",
    mimeType: videoFile?.mimetype || video.videoFormat || "",
    labels: moderationUploadDecision.labels || [],
    reason: moderationUploadDecision.reason || "",
    confidence: moderationUploadDecision.confidence || 0,
    status: "approved",
    visibility: verification.publishedStatus === "published" ? "public" : "private",
    storageStage: "permanent",
    subject: {
      title: video.caption || title || description || "Music video",
      description: video.description || description || "",
      mediaType: "video",
      createdAt: video.createdAt || new Date(),
      baselineAccess: {
        isPublished: verification.publishedStatus === "published",
        publishedStatus: verification.publishedStatus,
        albumStatus: "",
      },
    },
    media: [
      {
        role: "primary",
        mediaType: "video",
        mimeType: videoFile?.mimetype || video.videoFormat || "",
        sourceUrl: video.videoUrl || "",
        previewUrl: video.coverImageUrl || video.videoUrl || "",
        originalFilename: videoFile?.originalname || videoFile?.filename || "",
        fileSizeBytes: Number(videoFile?.size || 0),
      },
    ],
    file: videoFile || null,
  });

  await logAnalyticsEvent({
    type: "video_uploaded",
    userId: req.user.id,
    actorRole: req.user.role,
    targetId: video._id,
    targetType: "video",
    contentType: "video",
    metadata: {
      creatorId: req.creatorProfile?._id?.toString?.() || "",
      price: Number(video.price || 0),
      title: video.caption || "",
    },
  }).catch(() => null);

  return res.status(201).json(toVideoPayload(video));
});

exports.listCreatorVideos = asyncHandler(async (req, res) => {
  const videos = await Video.find({
    creatorProfileId: req.creatorProfile?._id || null,
    archivedAt: null,
  }).sort({ time: -1 });

  return res.json(videos.map(toVideoPayload));
});

exports.updateCreatorVideo = asyncHandler(async (req, res) => {
  if (!creatorHasCategory(req.creatorProfile, "music")) {
    return res.status(403).json({ error: "Music publishing is not enabled on this creator profile" });
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const video = await Video.findById(req.params.id);
  if (!video || String(video.creatorProfileId || "") !== String(req.creatorProfile?._id || "")) {
    return res.status(404).json({ error: "Video not found" });
  }

  const title = String(req.body?.title || req.body?.caption || video.caption || "").trim();
  const description = String(req.body?.description ?? video.description ?? video.caption ?? "").trim();
  const price = parseNonNegativeNumber(req.body?.price, { fallback: Number(video.price || 0) });
  const durationSec = parseNonNegativeNumber(req.body?.durationSec, { fallback: Number(video.durationSec || 0) });
  const requestedStatus = resolveRequestedStatus(req.body);
  const {
    videoUrl,
    coverImageUrl,
    previewClipUrl,
    videoFile,
    thumbnailFile,
    previewClipFile,
  } = await resolveUploadFields({
    req,
    current: video,
  });
  let nextVideoUrl = videoUrl;
  let nextCoverImageUrl = coverImageUrl;
  let nextPreviewClipUrl = previewClipUrl;
  let videoMedia = video.videoMedia || null;
  let coverMedia = video.coverMedia || null;
  let previewClipMedia = video.previewClipMedia || null;
  const previousVideoMedia = video.videoMedia || null;
  const previousCoverMedia = video.coverMedia || null;
  const previousPreviewClipMedia = video.previewClipMedia || null;

  if (!Number.isFinite(price)) {
    return sendBadRequest(res, "price must be a valid non-negative number");
  }
  if (!Number.isFinite(durationSec)) {
    return sendBadRequest(res, "durationSec must be a valid non-negative number");
  }

  const videoError = validateFile(videoFile, {
    label: "Video upload",
    allowedExtensions: VIDEO_EXTENSIONS,
    allowedMimeTypes: VIDEO_MIME_TYPES,
  });
  if (videoError) {
    return sendBadRequest(res, videoError);
  }

  const previewError = validateFile(previewClipFile, {
    label: "Preview clip",
    allowedExtensions: VIDEO_EXTENSIONS,
    allowedMimeTypes: VIDEO_MIME_TYPES,
  });
  if (previewError) {
    return sendBadRequest(res, previewError);
  }

  const thumbnailError = validateFile(thumbnailFile, {
    label: "Thumbnail image",
    allowedExtensions: IMAGE_EXTENSIONS,
    allowedMimeTypes: IMAGE_MIME_TYPES,
  });
  if (thumbnailError) {
    return sendBadRequest(res, thumbnailError);
  }

  const moderationUploadDecision = req.moderationUpload || {
    decision: "approve",
    labels: [],
    reason: "",
    confidence: 0,
  };

  if (videoFile || thumbnailFile || previewClipFile) {
    if (moderationUploadDecision.decision !== "approve") {
      const tempTargetId = `pending:creator_video_upload:${req.user.id}:${new Date().getTime()}`;
      const videoAsset = videoFile
        ? await persistUploadAsset({
            file: videoFile,
            decision: "quarantine",
            caseId: tempTargetId,
          })
        : { url: videoUrl, fileUrl: videoUrl };
      const coverAsset = thumbnailFile
        ? await persistUploadAsset({
            file: thumbnailFile,
            decision: "quarantine",
            caseId: tempTargetId,
          })
        : { url: coverImageUrl, fileUrl: coverImageUrl };
      const previewAsset = previewClipFile
        ? await persistUploadAsset({
            file: previewClipFile,
            decision: "quarantine",
            caseId: tempTargetId,
          })
        : { url: previewClipUrl, fileUrl: previewClipUrl };

      await createUploadModerationCase({
        targetType: "creator_video_upload",
        targetId: tempTargetId,
        uploader: {
          userId: req.user.id,
          email: user.email || "",
          username: user.username || "",
          displayName: user.name || "",
        },
        fileUrl: videoAsset.fileUrl || coverAsset.fileUrl || previewAsset.fileUrl || "",
        mimeType: videoFile?.mimetype || thumbnailFile?.mimetype || previewClipFile?.mimetype || "",
        labels: moderationUploadDecision.labels || [],
        reason: moderationUploadDecision.reason || "",
        confidence: moderationUploadDecision.confidence || 0,
        status: moderationUploadDecision.decision === "quarantine" ? "quarantined" : "rejected",
        visibility: moderationUploadDecision.decision === "quarantine" ? "private" : "blocked",
        storageStage: "quarantine",
        subject: {
          title: title || description || "Music video",
          description,
          mediaType: "video",
          createdAt: new Date(),
        },
        media: [
          {
            role: "primary",
            mediaType: "video",
            mimeType: videoFile?.mimetype || "",
            sourceUrl: videoAsset.fileUrl || "",
            previewUrl: previewAsset.fileUrl || videoAsset.fileUrl || "",
            originalFilename: videoFile?.originalname || videoFile?.filename || "",
            fileSizeBytes: Number(videoFile?.size || 0),
          },
          ...(thumbnailFile
            ? [
                {
                  role: "thumbnail",
                  mediaType: "image",
                  mimeType: thumbnailFile.mimetype || "",
                  sourceUrl: coverAsset.fileUrl || "",
                  previewUrl: coverAsset.fileUrl || "",
                  originalFilename: thumbnailFile.originalname || thumbnailFile.filename || "",
                  fileSizeBytes: Number(thumbnailFile.size || 0),
                },
              ]
            : []),
          ...(previewClipFile
            ? [
                {
                  role: "preview_clip",
                  mediaType: "video",
                  mimeType: previewClipFile.mimetype || "",
                  sourceUrl: previewAsset.fileUrl || "",
                  previewUrl: previewAsset.fileUrl || "",
                  originalFilename: previewClipFile.originalname || previewClipFile.filename || "",
                  fileSizeBytes: Number(previewClipFile.size || 0),
                },
              ]
            : []),
        ],
        file: videoFile || thumbnailFile || previewClipFile || null,
      });

      return res.status(moderationUploadDecision.decision === "quarantine" ? 202 : 422).json({
        error:
          moderationUploadDecision.decision === "quarantine"
            ? undefined
            : "This upload violates Tengacion safety rules and could not be published.",
        message:
          moderationUploadDecision.decision === "quarantine"
            ? "Your upload is under review by the Tengacion moderation team."
            : undefined,
        moderationStatus: moderationUploadDecision.decision === "quarantine" ? "quarantined" : "rejected",
        reviewRequired: moderationUploadDecision.decision === "quarantine",
      });
    }

    if (videoFile) {
      const persisted = await persistUploadAsset({
        file: videoFile,
        decision: "approve",
        caseId: `approved:creator_video_upload:${req.user.id}:${new Date().getTime()}`,
      });
      nextVideoUrl = persisted.url;
      videoMedia = persisted.media;
    }
    if (thumbnailFile) {
      const persisted = await persistUploadAsset({
        file: thumbnailFile,
        decision: "approve",
        caseId: `approved:creator_video_upload:${req.user.id}:${new Date().getTime()}`,
      });
      nextCoverImageUrl = persisted.url;
      coverMedia = persisted.media;
    }
    if (previewClipFile) {
      const persisted = await persistUploadAsset({
        file: previewClipFile,
        decision: "approve",
        caseId: `approved:creator_video_upload:${req.user.id}:${new Date().getTime()}`,
      });
      nextPreviewClipUrl = persisted.url;
      previewClipMedia = persisted.media;
    }
  }

  if (!nextVideoUrl && !videoFile) {
    return sendBadRequest(res, "Video file or videoUrl is required");
  }

  if (requestedStatus === "published" && price > 0 && !nextPreviewClipUrl) {
    return sendBadRequest(res, "A preview clip is required before publishing a paid music video");
  }

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory: "music",
    contentType: "music_video",
    requestedStatus,
    title,
    description,
    primaryFile: videoFile || thumbnailFile || null,
    metadata: {
      creatorId: req.creatorProfile?._id?.toString?.() || "",
      hasPreviewClip: Boolean(nextPreviewClipUrl),
      durationSec,
    },
  });

  video.videoUrl = nextVideoUrl;
  video.videoMedia = videoMedia;
  video.coverImageUrl = nextCoverImageUrl;
  video.coverMedia = coverMedia;
  video.previewClipUrl = nextPreviewClipUrl;
  video.previewClipMedia = previewClipMedia;
  video.caption = title || description || "";
  video.description = description;
  video.price = price;
  video.isFree = price <= 0;
  video.durationSec = durationSec;
  if (videoFile) {
    video.videoFormat = inferUploadedFormat(videoFile);
  }
  video.publishedStatus = verification.publishedStatus;
  video.copyrightScanStatus = verification.scanStatus;
  video.verificationNotes = verification.verificationNotes;
  video.reviewRequired = verification.reviewRequired;
  video.contentFingerprintHash = verification.contentFingerprintHash;
  if (verification.contentFileHash) {
    video.contentFileHash = verification.contentFileHash;
  }
  video.isPublished = verification.publishedStatus === "published";
  video.visibility = verification.publishedStatus === "published" ? "public" : "private";
  video.moderationStatus = "approved";
  video.moderationLabels = moderationUploadDecision.labels || [];
  video.moderationReason = moderationUploadDecision.reason || "";
  video.moderationConfidence = Number(moderationUploadDecision.confidence || 0);
  video.reviewedBy = null;
  video.reviewedAt = null;
  video.storageStage = "permanent";

  await video.save();
  await Promise.all([
    videoFile ? cleanupReplacedMedia(previousVideoMedia, video.videoMedia) : Promise.resolve(false),
    thumbnailFile ? cleanupReplacedMedia(previousCoverMedia, video.coverMedia) : Promise.resolve(false),
    previewClipFile
      ? cleanupReplacedMedia(previousPreviewClipMedia, video.previewClipMedia)
      : Promise.resolve(false),
  ]).catch(() => null);
  await createUploadModerationCase({
    targetType: "video",
    targetId: video._id.toString(),
    uploader: {
      userId: req.user.id,
      email: user.email || "",
      username: user.username || "",
      displayName: user.name || "",
    },
    fileUrl: video.videoUrl || "",
    mimeType: videoFile?.mimetype || video.videoFormat || "",
    labels: moderationUploadDecision.labels || [],
    reason: moderationUploadDecision.reason || "",
    confidence: moderationUploadDecision.confidence || 0,
    status: "approved",
    visibility: verification.publishedStatus === "published" ? "public" : "private",
    storageStage: "permanent",
    subject: {
      title: video.caption || title || description || "Music video",
      description: video.description || description || "",
      mediaType: "video",
      createdAt: video.createdAt || new Date(),
      baselineAccess: {
        isPublished: verification.publishedStatus === "published",
        publishedStatus: verification.publishedStatus,
        albumStatus: "",
      },
    },
    media: [
      {
        role: "primary",
        mediaType: "video",
        mimeType: videoFile?.mimetype || video.videoFormat || "",
        sourceUrl: video.videoUrl || "",
        previewUrl: video.coverImageUrl || video.videoUrl || "",
        originalFilename: videoFile?.originalname || videoFile?.filename || "",
        fileSizeBytes: Number(videoFile?.size || 0),
      },
    ],
    file: videoFile || null,
  });
  return res.json(toVideoPayload(video));
});

exports.likeCreatorVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) {
    return res.status(404).json({ error: "Video not found" });
  }

  if (!video.likes.includes(req.user.id)) {
    video.likes.push(req.user.id);
    await video.save();
  }

  return res.json(toVideoPayload(video));
});
