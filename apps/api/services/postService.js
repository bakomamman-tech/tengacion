const mongoose = require("mongoose");
const fsp = require("fs/promises");
const Post = require("../models/Post");
const User = require("../../../backend/models/User");
const { createNotification } = require("../../../backend/services/notificationService");
const {
  deleteUploadedMediaBatch,
  saveUploadedMedia,
} = require("../../../backend/services/mediaStore");
const {
  normalizeMediaValue,
  sanitizeLegacyMediaFieldsForNewWrite,
} = require("../../../backend/utils/userMedia");
const {
  moveToQuarantineStorage,
} = require("../../../backend/services/storageQuarantineService");
const {
  createUploadModerationCase,
} = require("../../../backend/services/uploadModerationService");
const ApiError = require("../utils/ApiError");
const {
  MAX_VIDEO_BYTES,
  ALLOWED_MIME_TYPES,
} = require("../../../backend/services/videoStorage");
const userRepository = require("../repositories/userRepository");
const postRepository = require("../repositories/postRepository");
const { resolveMentionUserIds } = require("../../../backend/utils/mentions");
const { incrementDailyMetric, logAnalyticsEvent, touchUserActivity } = require("../../../backend/services/analyticsService");
const {
  createOrUpdateModerationCase,
  getLatestCaseForTarget,
  getLatestCaseMapForTargets,
  getPublicModerationOverlay,
} = require("../../../backend/services/moderationService");

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const uniqueIds = (values) => [...new Set(values.filter(Boolean))];

const inferMediaKind = (file) => {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";

  const filename = String(file?.originalname || file?.filename || "").toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(filename)) {
    return "video";
  }

  return "image";
};

const mapLegacyModerationStatusToDecision = (status = "") => {
  const normalized = String(status || "").trim();
  if (!normalized) {
    return {
      decision: "approve",
      labels: [],
      reason: "",
      confidence: 0,
    };
  }

  if (normalized === "BLOCK_SUSPECTED_CHILD_EXPLOITATION" || normalized === "BLOCK_EXPLICIT_ADULT") {
    return {
      decision: "reject",
      labels: [normalized.toLowerCase()],
      reason: "This upload violates Tengacion safety rules and could not be published.",
      confidence: 0.98,
    };
  }

  if (
    normalized === "BLOCK_EXTREME_GORE" ||
    normalized === "BLOCK_ANIMAL_CRUELTY" ||
    normalized === "HOLD_FOR_REVIEW" ||
    normalized === "RESTRICTED_BLURRED"
  ) {
    return {
      decision: "quarantine",
      labels: [normalized.toLowerCase()],
      reason: "Your upload is under review by the Tengacion moderation team.",
      confidence: 0.78,
    };
  }

  return {
    decision: "approve",
    labels: [],
    reason: "",
    confidence: 0,
  };
};

const mergeModerationDecisions = ({ nextDecision = null, legacyStatus = "" } = {}) => {
  const legacyDecision = mapLegacyModerationStatusToDecision(legacyStatus);
  if (!nextDecision || !nextDecision.decision) {
    return legacyDecision;
  }

  if (legacyDecision.decision === "reject") {
    return legacyDecision;
  }

  if (legacyDecision.decision === "quarantine" && nextDecision.decision === "approve") {
    return legacyDecision;
  }

  if (nextDecision.decision === "reject") {
    return nextDecision;
  }

  if (nextDecision.decision === "quarantine") {
    return nextDecision;
  }

  return nextDecision;
};

const ALLOWED_POST_TYPES = new Set(["text", "image", "video", "reel", "poll", "quiz", "checkin"]);

const parseVideoPayload = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    return value;
  }

  return null;
};

const normalizeVideoUrl = (value) => {
  if (!value) return "";
  return value.toString().trim();
};

const normalizeMimeType = (value) => {
  if (!value) return "";
  return String(value).toLowerCase().trim();
};

const buildVideoMeta = (payload) => {
  if (!payload) {
    return null;
  }

  const url =
    normalizeVideoUrl(payload.secureUrl) ||
    normalizeVideoUrl(payload.secure_url) ||
    normalizeVideoUrl(payload.url) ||
    normalizeVideoUrl(payload.fileUrl) ||
    normalizeVideoUrl(payload.playbackUrl);

  if (!url) {
    return null;
  }

  return {
    url,
    playbackUrl: normalizeVideoUrl(payload.playbackUrl || url),
    thumbnailUrl: normalizeVideoUrl(payload.thumbnailUrl),
    duration: Number(payload.duration) || 0,
    width: Number(payload.width) || 0,
    height: Number(payload.height) || 0,
    sizeBytes: Number(payload.sizeBytes) || 0,
    mimeType: (payload.mimeType || "").toLowerCase(),
  };
};

const buildPostMediaEntry = (asset = {}, type = "image") => {
  const normalized = normalizeMediaValue(asset);
  return {
    ...normalized,
    type,
  };
};

const getMediaEntryUrl = (entry) => normalizeMediaValue(entry).url;

const normalizePostMediaEntries = (media = []) =>
  (Array.isArray(media) ? media : [])
    .map((entry) => {
      const normalizedType =
        entry && typeof entry === "object"
          ? String(entry.type || "").trim().toLowerCase()
          : "";
      return buildPostMediaEntry(
        entry,
        normalizedType === "video" || normalizedType === "gif" ? normalizedType : "image"
      );
    })
    .filter((entry) => entry.url || entry.publicId || entry.legacyPath);

const buildCloudinaryVideoMeta = (asset = {}, uploadFile = null, fallback = null) => {
  const normalized = normalizeMediaValue(asset);
  return {
    ...normalized,
    url: normalizeVideoUrl(normalized.secureUrl || normalized.secure_url || normalized.url || fallback?.url),
    secureUrl: normalizeVideoUrl(normalized.secureUrl || normalized.secure_url || normalized.url || fallback?.url),
    secure_url: normalizeVideoUrl(normalized.secureUrl || normalized.secure_url || normalized.url || fallback?.url),
    playbackUrl: normalizeVideoUrl(
      normalized.secureUrl ||
        normalized.secure_url ||
        normalized.url ||
        fallback?.playbackUrl ||
        fallback?.url
    ),
    thumbnailUrl: normalizeVideoUrl(fallback?.thumbnailUrl),
    duration: Number(normalized.duration || fallback?.duration || 0) || 0,
    width: Number(normalized.width || fallback?.width || 0) || 0,
    height: Number(normalized.height || fallback?.height || 0) || 0,
    sizeBytes: Number(normalized.bytes || uploadFile?.size || fallback?.sizeBytes || 0) || 0,
    mimeType:
      normalizeMimeType(normalized.resourceType === "video" ? uploadFile?.mimetype : "")
      || normalizeMimeType(uploadFile?.mimetype)
      || normalizeMimeType(fallback?.mimeType),
    resourceType: String(normalized.resourceType || normalized.resource_type || "video").trim(),
    resource_type: String(normalized.resourceType || normalized.resource_type || "video").trim(),
    format: String(normalized.format || "").trim(),
    bytes: Number(normalized.bytes || uploadFile?.size || fallback?.sizeBytes || 0) || 0,
    originalFilename: String(normalized.originalFilename || uploadFile?.originalname || "").trim(),
    folder: String(normalized.folder || "").trim(),
    provider: String(normalized.provider || "").trim(),
    legacyPath: String(normalized.legacyPath || "").trim(),
  };
};

const collectPostCloudinaryAssets = (post = {}) => {
  const assets = [];

  (Array.isArray(post?.media) ? post.media : []).forEach((entry) => {
    const publicId = String(entry?.publicId || entry?.public_id || "").trim();
    if (!publicId) {
      return;
    }

    assets.push({
      publicId,
      public_id: publicId,
      resourceType: String(entry?.resourceType || entry?.resource_type || entry?.type || "image").trim(),
      resource_type: String(entry?.resourceType || entry?.resource_type || entry?.type || "image").trim(),
      url: normalizeVideoUrl(entry?.secureUrl || entry?.secure_url || entry?.url),
    });
  });

  const videoPublicId = String(post?.video?.publicId || post?.video?.public_id || "").trim();
  if (videoPublicId) {
    assets.push({
      publicId: videoPublicId,
      public_id: videoPublicId,
      resourceType: String(post?.video?.resourceType || post?.video?.resource_type || "video").trim(),
      resource_type: String(post?.video?.resourceType || post?.video?.resource_type || "video").trim(),
      url: normalizeVideoUrl(post?.video?.secureUrl || post?.video?.secure_url || post?.video?.url || post?.video?.playbackUrl),
    });
  }

  return assets;
};

const validateVideoMeta = (video) => {
  if (!video) {
    return;
  }

  if (video.mimeType && !ALLOWED_MIME_TYPES.has(video.mimeType)) {
    throw ApiError.badRequest("Only MP4 and WebM videos are supported");
  }

  if (video.sizeBytes > MAX_VIDEO_BYTES) {
    throw ApiError.badRequest("Video exceeds maximum allowed size (100MB)");
  }
};

const normalizeText = (value, maxLength = 160) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const normalizeUsername = (value, maxLength = 30) =>
  normalizeText(String(value || "").replace(/^@+/, "").replace(/\s+/g, "").toLowerCase(), maxLength);

const toBool = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;

  const normalized = value.trim().toLowerCase();
  return ["true", "1", "yes", "on"].includes(normalized);
};

const toStringArray = (value, maxItems = 8, maxLength = 60, stripAt = false) => {
  if (value == null) return [];

  let source = value;
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        source = JSON.parse(trimmed);
      } catch {
        source = [trimmed];
      }
    } else {
      source = [trimmed];
    }
  }

  if (!Array.isArray(source)) {
    source = [source];
  }

  return source
    .map((entry) => normalizeText(String(entry || ""), maxLength))
    .map((entry) => (stripAt ? entry.replace(/^@+/, "") : entry))
    .filter(Boolean)
    .slice(0, maxItems);
};

const cleanupTempUpload = async (file = null) => {
  if (!file?.path) {
    return;
  }

  await fsp.unlink(file.path).catch(() => null);
};

const escapeRegex = (value = "") => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseTaggedUsersInput = (value, maxItems = 12) => {
  if (value == null) return [];

  let source = value;
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        source = JSON.parse(trimmed);
      } catch {
        source = [trimmed];
      }
    } else {
      source = [trimmed];
    }
  }

  if (!Array.isArray(source)) {
    source = [source];
  }

  return source
    .map((entry) => {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const userId = toIdString(entry.userId || entry._id || entry.id || entry.user);
        const username = normalizeUsername(entry.username || entry.handle);
        const name = normalizeText(entry.name || entry.displayName || entry.label || "", 120);
        if (!userId && !username && !name) {
          return null;
        }
        return { userId, username, name };
      }

      const raw = normalizeText(String(entry || ""), 160);
      if (!raw) {
        return null;
      }

      const handleMatch = raw.match(/@([a-zA-Z0-9._]{1,30})/);
      if (handleMatch) {
        return {
          userId: "",
          username: normalizeUsername(handleMatch[1]),
          name: normalizeText(raw.replace(handleMatch[0], "").replace(/\s+/g, " ").trim(), 120),
        };
      }

      if (/^\S+$/.test(raw)) {
        return { userId: "", username: normalizeUsername(raw), name: "" };
      }

      return { userId: "", username: "", name: normalizeText(raw, 120) };
    })
    .filter(Boolean)
    .slice(0, maxItems);
};

const resolveTaggedUsers = async (value) => {
  const requested = parseTaggedUsersInput(value);
  if (requested.length === 0) {
    return [];
  }

  const requestedIds = uniqueIds(
    requested
      .map((entry) => entry.userId)
      .filter((entry) => mongoose.Types.ObjectId.isValid(entry))
  );
  const requestedUsernames = uniqueIds(requested.map((entry) => entry.username).filter(Boolean));
  const requestedNames = uniqueIds(requested.map((entry) => entry.name).filter(Boolean));

  const [usersByIdRows, usersByUsernameRows, usersByNameRows] = await Promise.all([
    requestedIds.length
      ? User.find({ _id: { $in: requestedIds } }, "_id name username avatar").lean()
      : Promise.resolve([]),
    requestedUsernames.length
      ? User.find({ username: { $in: requestedUsernames } }, "_id name username avatar").lean()
      : Promise.resolve([]),
    requestedNames.length
      ? User.find(
          {
            $or: requestedNames.map((entry) => ({
              name: { $regex: `^${escapeRegex(entry)}$`, $options: "i" },
            })),
          },
          "_id name username avatar"
        ).lean()
      : Promise.resolve([]),
  ]);

  const usersById = new Map(usersByIdRows.map((entry) => [toIdString(entry._id), entry]));
  const usersByUsername = new Map(
    usersByUsernameRows.map((entry) => [normalizeUsername(entry.username), entry])
  );
  const usersByName = new Map();
  for (const entry of usersByNameRows) {
    const key = normalizeText(entry.name || "", 120).toLowerCase();
    if (!key) {
      continue;
    }
    if (usersByName.has(key)) {
      usersByName.set(key, null);
      continue;
    }
    usersByName.set(key, entry);
  }

  const seen = new Set();
  const resolved = [];

  for (const entry of requested) {
    const exactId = mongoose.Types.ObjectId.isValid(entry.userId) ? entry.userId : "";
    const exactUsername = normalizeUsername(entry.username);
    const exactName = normalizeText(entry.name || "", 120).toLowerCase();

    const matchedUser =
      (exactId ? usersById.get(exactId) : null) ||
      (exactUsername ? usersByUsername.get(exactUsername) : null) ||
      (exactName ? usersByName.get(exactName) : null);

    if (!matchedUser) {
      continue;
    }

    const userId = toIdString(matchedUser._id);
    if (!userId || seen.has(userId)) {
      continue;
    }

    seen.add(userId);
    resolved.push({
      userId,
      name: normalizeText(matchedUser.name || entry.name || "", 120),
      username: normalizeUsername(matchedUser.username || entry.username),
    });
  }

  return resolved;
};

const toVisibility = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["private", "only_me", "only me"].includes(normalized)) {
    return "private";
  }
  return ["public", "friends", "close_friends"].includes(normalized)
    ? normalized
    : "public";
};

const toPrivacy = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["friends", "private"].includes(normalized)) {
    return normalized;
  }
  if (["only_me", "only me"].includes(normalized)) {
    return "private";
  }
  return "public";
};

const extractHashtags = (text = "") => {
  const matches = String(text || "").match(/#([a-zA-Z0-9_]{1,40})/g) || [];
  return [...new Set(matches.map((tag) => tag.replace(/^#/, "").toLowerCase()))];
};

const avatarToUrl = (avatar) => {
  return normalizeMediaValue(avatar).url;
};

const normalizeCommentAuthor = (author = {}) => {
  const source = author && typeof author === "object" ? author : {};
  const authorId = toIdString(source._id || source.id || "");
  return {
    _id: authorId,
    name: normalizeText(source.name || "", 120),
    username: normalizeUsername(source.username || ""),
    avatar: avatarToUrl(source.avatar),
  };
};

const normalizeCommentItem = (comment = {}, parentCommentId = null) => {
  const author = comment?.author && typeof comment.author === "object" ? comment.author : null;
  const authorInfo = normalizeCommentAuthor(author || {});
  const rawAuthorId =
    comment?.author && typeof comment.author === "object"
      ? comment.author._id || comment.author.id || ""
      : comment.author || "";
  const authorId = authorInfo._id || toIdString(rawAuthorId);
  const reactions = Array.isArray(comment.reactions)
    ? comment.reactions
        .map((reaction) => ({
          userId: toIdString(reaction?.userId || reaction?.user || reaction?.author),
          emoji: String(reaction?.emoji || "").trim().slice(0, 8),
          createdAt: reaction?.createdAt || null,
        }))
        .filter((entry) => entry.userId || entry.emoji)
    : [];

  return {
    _id: toIdString(comment._id || comment.id),
    author: authorId
      ? {
          ...authorInfo,
          _id: authorId,
        }
      : null,
    authorId,
    authorName: authorInfo.name || normalizeText(comment.authorName || comment.userName || "", 120) || "User",
    authorUsername: authorInfo.username || normalizeUsername(comment.authorUsername || ""),
    authorAvatar: authorInfo.avatar || normalizeText(comment.authorAvatar || "", 500),
    text: normalizeText(comment.text || "", 2000),
    parentCommentId: toIdString(comment.parentCommentId || parentCommentId || ""),
    mentions: Array.isArray(comment.mentions) ? comment.mentions.map((id) => toIdString(id)).filter(Boolean) : [],
    hashtags: Array.isArray(comment.hashtags)
      ? comment.hashtags.map((tag) => normalizeText(String(tag || ""), 60).toLowerCase()).filter(Boolean)
      : [],
    audience: comment.audience || "friends",
    likes: Array.isArray(comment.likes) ? comment.likes.map((id) => toIdString(id)).filter(Boolean) : [],
    reactions,
    reactionsCount: Number(comment.reactionsCount) || reactions.length || 0,
    edited: Boolean(comment.edited),
    editedAt: comment.editedAt || null,
    createdAt: comment.createdAt || null,
    updatedAt: comment.updatedAt || null,
    mediaPreview: normalizeText(comment.mediaPreview || "", 500),
  };
};

const flattenCommentTree = (comments = [], parentCommentId = null, output = [], seen = new Set()) => {
  if (!Array.isArray(comments)) {
    return output;
  }

  for (const comment of comments) {
    if (!comment || typeof comment !== "object") {
      continue;
    }

    const normalized = normalizeCommentItem(comment, parentCommentId);
    if (!normalized._id || seen.has(normalized._id)) {
      continue;
    }

    seen.add(normalized._id);
    output.push(normalized);

    if (Array.isArray(comment.replies) && comment.replies.length > 0) {
      flattenCommentTree(comment.replies, normalized._id, output, seen);
    }
  }

  return output;
};

const buildThreadedComments = (comments = []) => {
  const normalizedComments = Array.isArray(comments) ? comments : [];
  const nodes = new Map();
  const roots = [];

  normalizedComments.forEach((comment) => {
    if (!comment?._id) {
      return;
    }
    nodes.set(String(comment._id), { ...comment, replies: [] });
  });

  normalizedComments.forEach((comment) => {
    const node = nodes.get(String(comment?._id || ""));
    if (!node) {
      return;
    }

    const parentId = String(comment?.parentCommentId || "").trim();
    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId).replies.push(node);
      return;
    }

    roots.push(node);
  });

  return roots;
};

const withPostAuthor = (query) =>
  query
    .populate("author", "name username avatar")
    .populate("comments.author", "name username avatar")
    .populate("comments.replies.author", "name username avatar");

const getPostPreviewImage = (post = {}) => {
  const videoPayload = buildVideoMeta(post?.video);
  if (videoPayload?.thumbnailUrl) {
    return normalizeVideoUrl(videoPayload.thumbnailUrl);
  }

  const mediaList = Array.isArray(post?.media) ? post.media : [];
  const firstMedia = mediaList[0];
  const firstMediaUrl = getMediaEntryUrl(firstMedia);
  if (firstMediaUrl) {
    return normalizeVideoUrl(firstMediaUrl);
  }

  return "";
};

const buildPostModerationMedia = ({
  media = [],
  video = null,
  uploadFile = null,
}) => {
  const entries = (Array.isArray(media) ? media : []).map((entry, index) => ({
    role: index === 0 ? "primary" : `attachment_${index + 1}`,
    mediaType: entry?.type || "image",
    sourceUrl: getMediaEntryUrl(entry),
    previewUrl: getMediaEntryUrl(entry),
    mimeType: entry?.type === "video" ? "video/mp4" : "image/jpeg",
    originalFilename:
      uploadFile?.originalname || uploadFile?.filename || "",
    fileSizeBytes: Number(uploadFile?.size || 0),
    file: uploadFile && index === 0 ? uploadFile : null,
  }));

  if (video?.playbackUrl || video?.url) {
    entries.push({
      role: "video",
      mediaType: "video",
      sourceUrl: video.playbackUrl || video.url,
      previewUrl: video.thumbnailUrl || video.playbackUrl || video.url,
      mimeType: video.mimeType || uploadFile?.mimetype || "video/mp4",
      originalFilename:
        uploadFile?.originalname || uploadFile?.filename || "",
      fileSizeBytes: Number(uploadFile?.size || video.sizeBytes || 0),
      file: uploadFile && (video.playbackUrl || video.url) ? uploadFile : null,
    });
  }

  if (entries.length === 0 && uploadFile) {
    entries.push({
      role: "primary",
      mediaType: inferMediaKind(uploadFile),
      sourceUrl: "",
      previewUrl: "",
      mimeType: uploadFile?.mimetype || "application/octet-stream",
      originalFilename:
        uploadFile?.originalname || uploadFile?.filename || "",
      fileSizeBytes: Number(uploadFile?.size || 0),
      file: uploadFile,
    });
  }

  return entries;
};

const attachPostModerationOverlays = async (posts = [], viewerId = null, req = null) => {
  const normalizedPosts = Array.isArray(posts) ? posts : [];
  if (normalizedPosts.length === 0) {
    return [];
  }

  const caseMap = await getLatestCaseMapForTargets(
    "post",
    normalizedPosts.map((post) => post?._id).filter(Boolean)
  );

  return normalizedPosts
    .filter((post) => {
      const caseDoc = caseMap.get(toIdString(post?._id)) || null;
      return !caseDoc || !["HOLD_FOR_REVIEW", "BLOCK_EXPLICIT_ADULT", "BLOCK_SUSPECTED_CHILD_EXPLOITATION", "BLOCK_EXTREME_GORE", "BLOCK_ANIMAL_CRUELTY", "BLOCK_REPEAT_VIOLATOR"].includes(String(caseDoc.status || ""));
    })
    .map((post) => {
      const caseDoc = caseMap.get(toIdString(post?._id)) || null;
      const payload = toPostPayload(post, viewerId);
      if (caseDoc) {
        payload.moderationStatus = String(caseDoc.status || "");
        payload.sensitiveContent = caseDoc.status !== "ALLOW";
        payload.sensitiveType = String(caseDoc.queue || "");
        payload.blurPreviewUrl = post.blurPreviewUrl || caseDoc.media?.[0]?.restrictedPreviewUrl || "";
        payload.reviewRequired = caseDoc.status === "HOLD_FOR_REVIEW";
        payload.moderationOverlay = getPublicModerationOverlay(caseDoc, req);
        if (caseDoc.status === "RESTRICTED_BLURRED" && payload.blurPreviewUrl) {
          payload.image = payload.blurPreviewUrl;
          payload.media = Array.isArray(payload.media)
            ? payload.media.map((entry, index) => ({
              ...entry,
              url: index === 0 ? payload.blurPreviewUrl : entry.url,
              isBlurred: index === 0,
            }))
            : [];
          if (payload.video) {
            payload.video = {
              ...payload.video,
              url: "",
              playbackUrl: "",
              thumbnailUrl: payload.blurPreviewUrl,
              restricted: true,
            };
          }
          payload.autoplayDisabled = true;
        }
      } else {
        payload.moderationStatus = String(post?.moderationStatus || "ALLOW");
        payload.sensitiveContent = Boolean(post?.sensitiveContent);
        payload.sensitiveType = String(post?.sensitiveType || "");
        payload.blurPreviewUrl = String(post?.blurPreviewUrl || "");
        payload.reviewRequired = Boolean(post?.reviewRequired);
        payload.moderationOverlay = null;
      }
      return payload;
    });
};

const parseSharedPostPayload = (value) => {
  if (!value) {
    return null;
  }

  let source = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = { postId: source };
    }
  }

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  const postId = String(source.postId || source.originalPostId || "").trim();
  if (!postId) {
    return null;
  }

  return { postId };
};

const buildSharedPostMeta = async (value) => {
  const payload = parseSharedPostPayload(value);
  if (!payload?.postId) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(payload.postId)) {
    throw ApiError.badRequest("Invalid shared post id");
  }

  const originalPost = await withPostAuthor(Post.findById(payload.postId)).lean();
  if (!originalPost) {
    throw ApiError.notFound("Shared post not found");
  }

  if (originalPost.sharedPost && typeof originalPost.sharedPost === "object") {
    return sanitizeLegacyMediaFieldsForNewWrite({
      originalPostId: originalPost.sharedPost.originalPostId || originalPost._id,
      originalAuthorId: originalPost.sharedPost.originalAuthorId || null,
      originalAuthorName: normalizeText(originalPost.sharedPost.originalAuthorName || "", 120),
      originalAuthorUsername: normalizeUsername(originalPost.sharedPost.originalAuthorUsername || ""),
      originalAuthorAvatar: normalizeText(originalPost.sharedPost.originalAuthorAvatar || "", 500),
      originalText: normalizeText(originalPost.sharedPost.originalText || "", 5000),
      previewImage: normalizeText(originalPost.sharedPost.previewImage || "", 500),
      previewMediaType: ["image", "video", "reel"].includes(originalPost.sharedPost.previewMediaType)
        ? originalPost.sharedPost.previewMediaType
        : "text",
    }, {
      clearLegacyStringPaths: ["originalAuthorAvatar", "previewImage"],
    });
  }

  const originalAuthor = originalPost.author || {};
  const originalVideo = buildVideoMeta(originalPost?.video);
  const previewMediaType =
    originalPost.type === "reel"
      ? "reel"
      : originalVideo
        ? "video"
        : Array.isArray(originalPost?.media) && originalPost.media.length > 0
          ? originalPost.media[0]?.type || "image"
          : "text";

  return sanitizeLegacyMediaFieldsForNewWrite({
    originalPostId: originalPost._id,
    originalAuthorId: originalAuthor?._id || null,
    originalAuthorName: normalizeText(originalAuthor?.name || "", 120),
    originalAuthorUsername: normalizeUsername(originalAuthor?.username || ""),
    originalAuthorAvatar: avatarToUrl(originalAuthor?.avatar),
    originalText: normalizeText(originalPost?.text || "", 5000),
    previewImage: getPostPreviewImage(originalPost),
    previewMediaType: ["image", "video", "reel"].includes(previewMediaType)
      ? previewMediaType
      : "text",
  }, {
    clearLegacyStringPaths: ["originalAuthorAvatar", "previewImage"],
  });
};

const toPostPayload = (post, viewerId) => {
  const author = post.author || {};
  const normalizedMedia = normalizePostMediaEntries(post.media);
  const firstMedia = normalizedMedia.length > 0 ? normalizedMedia[0] : null;
  const likes = Array.isArray(post.likes) ? post.likes : [];
  const comments = flattenCommentTree(Array.isArray(post.comments) ? post.comments : []);
  const videoPayload = buildVideoMeta(post.video);
  const firstMediaType = String(firstMedia?.type || "").toLowerCase();
  const inferredType =
    videoPayload
      ? "video"
      : firstMediaType === "video"
        ? "video"
        : firstMediaType === "image" || Boolean(firstMedia?.url)
          ? "image"
          : "text";
  const postType =
    post.type && post.type !== "text"
      ? post.type
      : inferredType;
  const taggedUsers = (Array.isArray(post.taggedUsers) ? post.taggedUsers : [])
    .map((entry) => {
      const userId = toIdString(entry?.userId || entry?.user || entry?._id);
      const username = normalizeUsername(entry?.username);
      const name = normalizeText(entry?.name || "", 120);
      if (!userId && !username && !name) {
        return null;
      }
      return {
        userId,
        name,
        username,
      };
    })
    .filter(Boolean);
  const tags = Array.isArray(post.tags) && post.tags.length > 0
    ? post.tags
    : taggedUsers.map((entry) => entry.username || entry.name).filter(Boolean);
  const moreOptions = Array.isArray(post.moreOptions) ? post.moreOptions : [];
  const callToAction = post.callToAction || {};
  const sharedPost =
    post.sharedPost && typeof post.sharedPost === "object"
      ? {
          originalPostId: toIdString(post.sharedPost.originalPostId),
          originalAuthorId: toIdString(post.sharedPost.originalAuthorId),
          originalAuthorName: normalizeText(post.sharedPost.originalAuthorName || "", 120),
          originalAuthorUsername: normalizeUsername(post.sharedPost.originalAuthorUsername || ""),
          originalAuthorAvatar: normalizeText(post.sharedPost.originalAuthorAvatar || "", 500),
          originalText: normalizeText(post.sharedPost.originalText || "", 5000),
          previewImage: normalizeText(post.sharedPost.previewImage || "", 500),
          previewMediaType: ["text", "image", "video", "reel"].includes(post.sharedPost.previewMediaType)
            ? post.sharedPost.previewMediaType
            : "text",
        }
      : null;
  const authorId = author?._id ? author._id.toString() : "";
  const viewerIdString = viewerId ? viewerId.toString() : "";
  const likedByViewer = Boolean(viewerIdString && likes.some((id) => id.toString() === viewerIdString));

  return {
    _id: post._id.toString(),
    text: post.text || "",
    image: firstMedia?.url || "",
    media: normalizedMedia,
    type: postType,
    video: videoPayload,
    name: author.name || "",
    username: author.username || "",
    avatar: avatarToUrl(author.avatar),
    likes: likes.length,
    likesCount: likes.length,
    likedByViewer,
    shareCount: Number(post.shareCount) || 0,
    comments,
    commentsCount: post.commentsCount ?? comments.length,
    tags,
    taggedUsers,
    feeling: post.feeling || "",
    location: post.location || "",
    callToAction: {
      type: callToAction.type || "none",
      enabled: Boolean(callToAction.enabled),
      value: callToAction.value || "",
    },
    sharedPost,
    moreOptions,
    audience:
      post.visibility === "private"
        ? "private"
        : post.audience || post.visibility || "friends",
    privacy: post.privacy || "public",
    visibility: post.visibility || "public",
    hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
    mentions: Array.isArray(post.mentions) ? post.mentions.map((id) => toIdString(id)) : [],
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    edited: Boolean(post.edited),
    isOwner: Boolean(viewerId && authorId && authorId === viewerId.toString()),
    moderationStatus: String(post.moderationStatus || "ALLOW"),
    sensitiveContent: Boolean(post.sensitiveContent),
    sensitiveType: String(post.sensitiveType || ""),
    blurPreviewUrl: String(post.blurPreviewUrl || ""),
    reviewRequired: Boolean(post.reviewRequired),
    user: {
      _id: authorId,
      name: author.name || "",
      username: author.username || "",
      profilePic: avatarToUrl(author.avatar),
    },
  };
};

class PostService {
  static async createPost({ userId, body, files, moderationUpload = null, io = null, onlineUsers = null }) {
    const viewerId = userId;
    const text = normalizeText(body?.text || "", 240);
    const sharedPost = await buildSharedPostMeta(body?.sharedPost);
    const taggedUsers = await resolveTaggedUsers(body?.taggedUsers || body?.tags);
    const tags = taggedUsers.map((entry) => entry.username || entry.name).filter(Boolean);
    const feeling = normalizeText(body?.feeling, 60);
    const location = normalizeText(body?.location, 140);
    const callsEnabled = toBool(body?.callsEnabled);
    const callNumber = normalizeText(body?.callNumber, 36);
    const moreOptions = toStringArray(body?.moreOptions, 8, 60, false);
    const uploadFile = files?.image?.[0] || files?.file?.[0] || null;
    const uploadKind = uploadFile ? inferMediaKind(uploadFile) : "";
    const hasMetadata = Boolean(
      tags.length || feeling || location || moreOptions.length || (callsEnabled && callNumber)
    );

    const rawVideoPayload = parseVideoPayload(body?.video);
    let videoMeta = buildVideoMeta(rawVideoPayload);

    if (!videoMeta && uploadFile && uploadKind === "video") {
      videoMeta = {
        url: "",
        playbackUrl: "",
        thumbnailUrl: "",
        duration: 0,
        width: 0,
        height: 0,
        sizeBytes: Number(uploadFile.size) || 0,
        mimeType: normalizeMimeType(uploadFile.mimetype),
      };
    }

    validateVideoMeta(videoMeta);

    const hasVideo = Boolean(videoMeta);
    const hasSharedPost = Boolean(sharedPost);
    if (!text && !uploadFile && !hasMetadata && !hasVideo && !hasSharedPost) {
      throw ApiError.badRequest("Post cannot be empty");
    }

    const requestedTypeCandidate =
      typeof body?.type === "string" ? body.type.toLowerCase() : "";
    const requestedType = ALLOWED_POST_TYPES.has(requestedTypeCandidate)
      ? requestedTypeCandidate
      : null;
    let type = requestedType;
    if (!type) {
      if (hasVideo || uploadKind === "video") {
        type = "video";
      } else if (uploadFile) {
        type = "image";
      } else {
        type = "text";
      }
    }

    if (["video", "reel"].includes(type) && !hasVideo && uploadKind !== "video") {
      throw ApiError.badRequest("Video data is required for video posts");
    }

    const visibility = toVisibility(body?.visibility || body?.privacy);
    const privacy = toPrivacy(body?.privacy || body?.visibility);
    const hashtags = extractHashtags(text);
    const mentions = await resolveMentionUserIds(text);
    const viewer = await userRepository.findById(viewerId);
    const defaultAudience = String(viewer?.privacy?.defaultPostAudience || "").toLowerCase();
    const audience =
      visibility === "private"
        ? "friends"
        : ["public", "friends", "close_friends"].includes(defaultAudience)
          ? defaultAudience
          : visibility;

    const pollPayload = body?.poll && typeof body.poll === "string"
      ? (() => {
          try {
            return JSON.parse(body.poll);
          } catch {
            return null;
          }
        })()
      : body?.poll || null;

    const quizPayload = body?.quiz && typeof body.quiz === "string"
      ? (() => {
          try {
            return JSON.parse(body.quiz);
          } catch {
            return null;
          }
        })()
      : body?.quiz || null;

    let poll = { question: "", options: [], votes: [], closesAt: null };
    let quiz = { question: "", options: [], correctOptionId: "", answers: [] };

    if (type === "poll") {
      const question = normalizeText(pollPayload?.question || text, 280);
      const options = Array.isArray(pollPayload?.options)
        ? pollPayload.options.map((entry, index) => ({
            id: String(entry?.id || `opt_${index + 1}`),
            text: normalizeText(entry?.text || entry, 180),
            votesCount: 0,
          })).filter((entry) => entry.text)
        : [];
      if (!question || options.length < 2) {
        throw ApiError.badRequest("Poll requires a question and at least two options");
      }
      poll = {
        question,
        options,
        votes: [],
        closesAt: pollPayload?.closesAt ? new Date(pollPayload.closesAt) : null,
      };
    }

    if (type === "quiz") {
      const question = normalizeText(quizPayload?.question || text, 280);
      const options = Array.isArray(quizPayload?.options)
        ? quizPayload.options.map((entry, index) => ({
            id: String(entry?.id || `opt_${index + 1}`),
            text: normalizeText(entry?.text || entry, 180),
          })).filter((entry) => entry.text)
        : [];
      const correctOptionId = String(quizPayload?.correctOptionId || "");
      if (!question || options.length < 2 || !correctOptionId) {
        throw ApiError.badRequest("Quiz requires question, options, and correct option");
      }
      quiz = {
        question,
        options,
        correctOptionId,
        answers: [],
      };
    }

    let legacyPreflightModerationDecision = null;
    if (uploadFile) {
      const preflightModerationMedia = buildPostModerationMedia({
        media: [],
        uploadFile,
      });
      const preflightResult = await createOrUpdateModerationCase({
        targetType: "post_upload",
        targetId: `pending:${viewerId}:${new mongoose.Types.ObjectId().toString()}`,
        title: text.slice(0, 240),
        description: text,
        metadata: {
          type,
          visibility,
          privacy,
          feeling,
          location,
          tags,
          hashtags,
        },
        media: preflightModerationMedia,
        uploader: {
          userId: viewerId,
          email: viewer?.email || "",
          username: viewer?.username || "",
          displayName: viewer?.name || "",
        },
        detectionSource: "automated_upload_scan",
        req: null,
        subjectMediaType: inferMediaKind(uploadFile),
      });
      legacyPreflightModerationDecision = preflightResult.moderationDecision || null;
    }

    const moderationUploadDecision = mergeModerationDecisions({
      nextDecision: moderationUpload || null,
      legacyStatus: legacyPreflightModerationDecision?.status || "",
    });

    if (uploadFile && moderationUploadDecision.decision !== "approve") {
      const tempTargetId = `pending:post_upload:${viewerId}:${new mongoose.Types.ObjectId().toString()}`;
      const quarantined = await moveToQuarantineStorage({
        file: uploadFile,
        caseId: tempTargetId,
        stage: "quarantine",
      });
      await createUploadModerationCase({
        targetType: "post_upload",
        targetId: tempTargetId,
        uploader: {
          userId: viewerId,
          email: viewer?.email || "",
          username: viewer?.username || "",
          displayName: viewer?.name || "",
        },
        fileUrl: quarantined.fileUrl,
        mimeType: uploadFile.mimetype || "",
        labels: moderationUploadDecision.labels || [],
        reason: moderationUploadDecision.reason || "",
        confidence: moderationUploadDecision.confidence || 0,
        status: moderationUploadDecision.decision === "quarantine" ? "quarantined" : "rejected",
        visibility: moderationUploadDecision.decision === "quarantine" ? "private" : "blocked",
        storageStage: "quarantine",
        subject: {
          title: text.slice(0, 240),
          description: text,
          mediaType: inferMediaKind(uploadFile),
          createdAt: new Date(),
        },
        media: [
          {
            role: "primary",
            mediaType: inferMediaKind(uploadFile),
            mimeType: uploadFile.mimetype || "",
            sourceUrl: quarantined.fileUrl,
            previewUrl: quarantined.fileUrl,
            originalFilename: uploadFile.originalname || uploadFile.filename || "",
            fileSizeBytes: Number(uploadFile.size || 0),
          },
        ],
        file: uploadFile,
      });

      if (moderationUploadDecision.decision === "reject") {
        return {
          success: false,
          moderationStatus: legacyPreflightModerationDecision?.status || "rejected",
          reviewRequired: false,
          message: "This upload violates Tengacion safety rules and could not be published.",
          httpStatus: 422,
        };
      }

      return {
        success: true,
        moderationStatus: "quarantined",
        reviewRequired: true,
        message: "Your upload is under review by the Tengacion moderation team.",
        httpStatus: 202,
      };
    }

    const media = [];
    if (uploadFile) {
      const persisted = await saveUploadedMedia(uploadFile, {
        source: uploadKind === "video" ? "post_video" : "post_image",
        resourceType: uploadKind === "video" ? "video" : "image",
      });
      const persistedKind = inferMediaKind(uploadFile);
      media.push(buildPostMediaEntry(persisted, persistedKind));

      if (persistedKind === "video") {
        videoMeta = buildCloudinaryVideoMeta(persisted, uploadFile, videoMeta);
      }
    } else if (type === "video" && videoMeta?.playbackUrl) {
      media.push({
        url: videoMeta.playbackUrl,
        type: "video",
      });
    }

    const callToAction =
      callsEnabled && callNumber
        ? { type: "call", enabled: true, value: callNumber }
        : { type: "none", enabled: false, value: "" };

    const created = await postRepository.create({
      author: viewerId,
      text,
      tags,
      taggedUsers,
      feeling,
      location,
      callToAction,
      moreOptions,
      media,
      type,
      video: ["video", "reel"].includes(type) ? videoMeta : null,
      sharedPost,
      privacy,
      visibility,
      audience,
      hashtags,
      mentions,
      poll: type === "poll" ? poll : undefined,
      quiz: type === "quiz" ? quiz : undefined,
      moderationStatus: "approved",
      moderationLabels: moderationUploadDecision.labels || [],
      moderationReason: moderationUploadDecision.reason || "",
      moderationConfidence: Number(moderationUploadDecision.confidence || 0),
      reviewedBy: null,
      reviewedAt: null,
      storageStage: "permanent",
    });

    const post = await withPostAuthor(Post.findById(created._id)).lean();
    const moderationMedia = buildPostModerationMedia({
      media,
      video: ["video", "reel"].includes(type) ? videoMeta : null,
      uploadFile,
    });
    const { moderationDecision, moderationCase } = await createOrUpdateModerationCase({
      targetType: "post",
      targetId: created._id.toString(),
      title: text.slice(0, 240),
      description: text,
      metadata: {
        type,
        visibility,
        privacy,
        feeling,
        location,
        tags,
        hashtags,
      },
      media: moderationMedia,
      uploader: {
        userId: viewerId,
        email: viewer?.email || "",
        username: viewer?.username || "",
        displayName: viewer?.name || "",
      },
      detectionSource: "automated_upload_scan",
      req: null,
    });

    let uploadModerationCase = null;
    if (uploadFile) {
      uploadModerationCase = await createUploadModerationCase({
        targetType: "post",
        targetId: created._id.toString(),
        uploader: {
          userId: viewerId,
          email: viewer?.email || "",
          username: viewer?.username || "",
          displayName: viewer?.name || "",
        },
        fileUrl: media[0]?.url || "",
        mimeType: uploadFile.mimetype || "",
        labels: moderationUploadDecision.labels || [],
        reason: moderationUploadDecision.reason || "",
        confidence: moderationUploadDecision.confidence || 0,
        status: "approved",
        visibility,
        storageStage: "permanent",
        subject: {
          title: text.slice(0, 240),
          description: text,
          mediaType: inferMediaKind(uploadFile),
          createdAt: created.createdAt || new Date(),
          baselineAccess: {
            isPublished: true,
            publishedStatus: "published",
            albumStatus: "",
          },
        },
        media: moderationMedia.map((entry, index) => ({
          role: entry.role || (index === 0 ? "primary" : `attachment_${index + 1}`),
          mediaType: entry.mediaType || inferMediaKind(uploadFile),
          mimeType: entry.mimeType || uploadFile.mimetype || "",
          sourceUrl: entry.sourceUrl || entry.previewUrl || media[0]?.url || "",
          previewUrl: entry.previewUrl || media[0]?.url || "",
          originalFilename: entry.originalFilename || uploadFile.originalname || uploadFile.filename || "",
          fileSizeBytes: Number(entry.fileSizeBytes || uploadFile.size || 0),
        })),
        file: uploadFile,
      });
    }

    if (moderationCase?._id) {
      await Post.updateOne(
        { _id: created._id },
        {
          $set: {
            moderationStatus: moderationCase.status,
            moderationCaseId: moderationCase._id,
            sensitiveContent: moderationCase.status !== "ALLOW",
            sensitiveType: moderationCase.queue,
            blurPreviewUrl: moderationCase.media?.[0]?.restrictedPreviewUrl || "",
            originalVisibility: visibility,
            reviewRequired: moderationCase.status === "HOLD_FOR_REVIEW",
          },
        }
      );
    }
    if (uploadModerationCase?._id) {
      await Post.updateOne(
        { _id: created._id },
        {
          $set: {
            moderationStatus: "approved",
            moderationLabels: moderationUploadDecision.labels || [],
            moderationReason: moderationUploadDecision.reason || "",
            moderationConfidence: Number(moderationUploadDecision.confidence || 0),
            moderationCaseId: uploadModerationCase._id,
            reviewedBy: null,
            reviewedAt: null,
            visibility,
            storageStage: "permanent",
            sensitiveContent: false,
            sensitiveType: "",
            blurPreviewUrl: "",
            reviewRequired: false,
          },
        }
      );
    }
    await incrementDailyMetric("postsCount", 1).catch(() => null);
    await touchUserActivity({ userId: viewerId, seenAt: new Date() }).catch(() => null);
    await logAnalyticsEvent({
      type: "post_created",
      userId: viewerId,
      targetId: created._id,
      targetType: "post",
      metadata: { type, visibility },
    }).catch(() => null);

    for (const taggedUser of taggedUsers) {
      const recipientId = toIdString(taggedUser.userId);
      if (!recipientId || recipientId === String(viewerId)) {
        continue;
      }

      await createNotification({
        recipient: recipientId,
        sender: viewerId,
        type: "tag",
        text: "tagged you in a post",
        entity: {
          id: created._id,
          model: "Post",
        },
        io,
        onlineUsers,
      });
    }

    if (
      moderationDecision?.status === "BLOCK_SUSPECTED_CHILD_EXPLOITATION"
      || moderationDecision?.status === "BLOCK_EXPLICIT_ADULT"
    ) {
      return {
        success: false,
        moderationStatus: moderationDecision.status,
        reviewRequired: false,
        message: "This upload violates Tengacion's safety rules and cannot be published.",
        httpStatus: 422,
      };
    }

    if (
      moderationDecision?.status === "HOLD_FOR_REVIEW"
      || moderationDecision?.status === "RESTRICTED_BLURRED"
      || moderationDecision?.status === "BLOCK_EXTREME_GORE"
      || moderationDecision?.status === "BLOCK_ANIMAL_CRUELTY"
      || moderationDecision?.status === "BLOCK_REPEAT_VIOLATOR"
    ) {
      return {
        success: true,
        moderationStatus: moderationDecision.status,
        reviewRequired: true,
        postId: created._id.toString(),
        message: "This media is under review because it may contain sensitive or prohibited content.",
        httpStatus: 202,
      };
    }

    const refreshedPost = await withPostAuthor(Post.findById(created._id)).lean();
    return toPostPayload(refreshedPost, viewerId);
  }

  static async getFeed({ userId, search }) {
    const viewerId = userId;
    const rawSearch = (search || "").trim();
    const searchTerm = rawSearch.replace(/^@+/, "");

    let matchedAuthorIds = [];
    if (searchTerm) {
      const matchingUsers = await User.find(
        {
          $or: [
            { username: { $regex: searchTerm, $options: "i" } },
            { name: { $regex: searchTerm, $options: "i" } },
          ],
        },
        "_id"
      ).lean();
      matchedAuthorIds = matchingUsers.map((entry) => entry._id);
    }

    const visibilityScopes = [];
    let blockedIds = [];

    if (viewerId) {
      const viewer = await userRepository.findById(viewerId);
      if (!viewer) throw ApiError.unauthorized("User not found");

      const followingIds = uniqueIds((viewer.following || []).map((id) => toIdString(id))).filter(
        (id) => id && id !== viewerId
      );
      const friendIds = uniqueIds((viewer.friends || []).map((id) => toIdString(id))).filter(
        (id) => id && id !== viewerId
      );
      const followingOnlyIds = followingIds.filter((id) => !friendIds.includes(id));
      const closeFriendIds = uniqueIds((viewer.closeFriends || []).map((id) => toIdString(id))).filter(
        (id) => id && id !== viewerId
      );
      blockedIds = uniqueIds([
        ...(viewer.blocks || []).map((id) => toIdString(id)),
        ...(viewer.blockedUsers || []).map((id) => toIdString(id)),
      ]);

      visibilityScopes.push({ author: viewerId });
      visibilityScopes.push({
        author: { $in: friendIds },
        privacy: { $in: ["public", "friends"] },
        visibility: { $in: ["public", "friends"] },
        audience: { $in: ["public", "friends", null] },
      });
      visibilityScopes.push({
        author: { $in: followingOnlyIds },
        privacy: "public",
        visibility: "public",
        audience: { $in: ["public", null] },
      });
      visibilityScopes.push({
        author: { $in: closeFriendIds },
        privacy: { $in: ["public", "friends"] },
        visibility: { $in: ["public", "friends", "close_friends"] },
        audience: { $in: ["public", "friends", "close_friends", null] },
      });

      if (matchedAuthorIds.length > 0) {
        visibilityScopes.push({
          author: { $in: matchedAuthorIds },
          privacy: "public",
        });
      }
    } else {
      visibilityScopes.push({ privacy: "public", audience: { $in: ["public", null] } });
      if (matchedAuthorIds.length > 0) {
        visibilityScopes.push({
          author: { $in: matchedAuthorIds },
          privacy: "public",
          audience: { $in: ["public", null] },
        });
      }
    }

    const query = { $or: visibilityScopes };
    if (blockedIds.length > 0) {
      query.author = { $nin: blockedIds };
    }
    if (searchTerm) {
      const searchFilters = [{ text: { $regex: searchTerm, $options: "i" } }];
      if (matchedAuthorIds.length > 0) {
        searchFilters.push({ author: { $in: matchedAuthorIds } });
      }
      query.$and = [{ $or: searchFilters }];
    }

    const posts = await withPostAuthor(Post.find(query).sort({ createdAt: -1 })).lean();
    return attachPostModerationOverlays(posts, viewerId);
  }

  static async getPostById({ viewerId, postId }) {
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw ApiError.badRequest("Invalid post id");
    }

    const post = await withPostAuthor(Post.findById(postId)).lean();
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    const moderationCase = await getLatestCaseForTarget("post", postId);
    if (
      moderationCase
      && ["HOLD_FOR_REVIEW", "BLOCK_EXPLICIT_ADULT", "BLOCK_SUSPECTED_CHILD_EXPLOITATION", "BLOCK_EXTREME_GORE", "BLOCK_ANIMAL_CRUELTY", "BLOCK_REPEAT_VIOLATOR"].includes(String(moderationCase.status || ""))
    ) {
      throw ApiError.notFound("Post not found");
    }

    const payload = toPostPayload(post, viewerId);
    if (moderationCase) {
      payload.moderationStatus = String(moderationCase.status || "");
      payload.sensitiveContent = moderationCase.status !== "ALLOW";
      payload.sensitiveType = String(moderationCase.queue || "");
      payload.blurPreviewUrl = post.blurPreviewUrl || moderationCase.media?.[0]?.restrictedPreviewUrl || "";
      payload.reviewRequired = moderationCase.status === "HOLD_FOR_REVIEW";
      payload.moderationOverlay = getPublicModerationOverlay(moderationCase);
      if (moderationCase.status === "RESTRICTED_BLURRED" && payload.blurPreviewUrl) {
        payload.image = payload.blurPreviewUrl;
        payload.media = Array.isArray(payload.media)
          ? payload.media.map((entry, index) => ({
            ...entry,
            url: index === 0 ? payload.blurPreviewUrl : entry.url,
            isBlurred: index === 0,
          }))
          : [];
        if (payload.video) {
          payload.video = {
            ...payload.video,
            url: "",
            playbackUrl: "",
            thumbnailUrl: payload.blurPreviewUrl,
            restricted: true,
          };
        }
        payload.autoplayDisabled = true;
      }
    }

    return payload;
  }

  static async getComments({ viewerId, postId, threaded = false }) {
    const payload = await PostService.getPostById({ viewerId, postId });
    const comments = Array.isArray(payload?.comments) ? payload.comments : [];
    return threaded ? buildThreadedComments(comments) : comments;
  }

  static async getUserPosts({ viewerId, username }) {
    const normalized = (username || "").trim().toLowerCase();
    if (!normalized) throw ApiError.badRequest("Username is required");

    const profileUser = await userRepository.findOne({ username: normalized });
    if (!profileUser) throw ApiError.notFound("Profile not found");

    const viewer = await userRepository.findById(viewerId);
    if (!viewer) throw ApiError.unauthorized("User not found");

    const profileId = profileUser._id.toString();
    const isOwner = profileId === viewerId.toString();
    const isFriend = (profileUser.friends || []).some(
      (id) => id.toString() === viewerId.toString()
    );

    let privacyFilter = { privacy: "public", audience: { $in: ["public", null] } };
    if (isOwner) {
      privacyFilter = {};
    } else if (isFriend) {
      privacyFilter = {
        privacy: { $in: ["public", "friends"] },
        audience: { $in: ["public", "friends", null] },
      };
    }

    const posts = await withPostAuthor(
      Post.find({ author: profileUser._id, ...privacyFilter }).sort({ createdAt: -1 })
    ).lean();

    return attachPostModerationOverlays(posts, viewerId);
  }

  static async updatePost({ userId, postId, text }) {
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw ApiError.badRequest("Invalid post id");
    }

    const normalizedText = normalizeText(text, 500);
    if (!normalizedText) {
      throw ApiError.badRequest("Post text is required");
    }

    const post = await postRepository.findOne({ _id: postId, author: userId });
    if (!post) throw ApiError.notFound("Post not found");

    post.text = normalizedText;
    post.edited = true;
    await post.save();

    const updated = await withPostAuthor(Post.findById(post._id)).lean();
    return toPostPayload(updated, userId);
  }

  static async deletePost({ userId, postId }) {
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw ApiError.badRequest("Invalid post id");
    }

    const deleted = await postRepository.findOneAndDelete({ _id: postId, author: userId });
    if (!deleted) throw ApiError.notFound("Post not found");

    await deleteUploadedMediaBatch(collectPostCloudinaryAssets(deleted)).catch(() => null);

    return { success: true };
  }

  static async toggleLike({ userId, postId, io, onlineUsers }) {
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw ApiError.badRequest("Invalid post id");
    }

    const post = await postRepository.findById(postId);
    if (!post) throw ApiError.notFound("Post not found");

    const viewerId = userId.toString();
    const liked = post.likes.some((id) => id.toString() === viewerId);

    if (liked) {
      post.likes.pull(viewerId);
    } else {
      post.likes.addToSet(viewerId);

      await createNotification({
        recipient: post.author,
        sender: viewerId,
        type: "like",
        text: "liked your post",
        entity: {
          id: post._id,
          model: "Post",
        },
        io,
        onlineUsers,
      });
    }

    await post.save();

    return {
      success: true,
      liked: !liked,
      likesCount: post.likes.length,
    };
  }

  static async sharePost({ postId }) {
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw ApiError.badRequest("Invalid post id");
    }

    const post = await postRepository.findById(postId);
    if (!post) throw ApiError.notFound("Post not found");

    post.shareCount = (Number(post.shareCount) || 0) + 1;
    await post.save();

    return {
      success: true,
      shareCount: post.shareCount,
    };
  }

  static async commentOnPost({ userId, postId, text, io, onlineUsers }) {
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw ApiError.badRequest("Invalid post id");
    }

    const post = await postRepository.findById(postId);
    if (!post) throw ApiError.notFound("Post not found");

    const parentCommentId = String(text?.parentCommentId || "").trim();
    const bodyText = typeof text === "object" ? text?.text : text;
    const normalizedText = normalizeText(bodyText, 500);
    if (!normalizedText) {
      throw ApiError.badRequest("Comment text is required");
    }

    const mentions = await resolveMentionUserIds(normalizedText);
    const parentComment =
      parentCommentId && mongoose.Types.ObjectId.isValid(parentCommentId)
        ? post.comments.id(parentCommentId)
        : null;

    if (parentCommentId && !parentComment) {
      throw ApiError.notFound("Parent comment not found");
    }

    const latestComment = post.comments.create({
      author: userId,
      text: normalizedText,
      parentCommentId: parentCommentId || null,
      mentions,
      reactions: [],
      reactionsCount: 0,
      edited: false,
      editedAt: null,
    });
    post.comments.push(latestComment);
    post.commentsCount = post.comments.length;
    await post.save();

    await createNotification({
      recipient: toIdString(post.author),
      sender: userId,
      type: "comment",
      text: "commented on your post",
      entity: {
        id: post._id,
        model: "Post",
      },
      io,
      onlineUsers,
    });

    const parentCommentAuthorId = toIdString(parentComment?.author || "");
    if (parentCommentAuthorId) {
      await createNotification({
        recipient: parentCommentAuthorId,
        sender: userId,
        type: "reply",
        text: "replied to your comment",
        entity: {
          id: post._id,
          model: "Post",
        },
        metadata: {
          dedupeKey: `comment_reply:${post._id.toString()}:${latestComment._id.toString()}`,
          parentCommentId: parentCommentId || "",
        },
        io,
        onlineUsers,
      });
    }

    await incrementDailyMetric("commentsCount", 1).catch(() => null);

    for (const mentionedUserId of mentions) {
      if (String(mentionedUserId) === String(userId)) continue;
      await createNotification({
        recipient: mentionedUserId,
        sender: userId,
        type: "mention",
        text: "mentioned you in a comment",
        entity: {
          id: post._id,
          model: "Post",
        },
        io,
        onlineUsers,
      });
    }

    const refreshedPost = await withPostAuthor(Post.findById(post._id)).lean();
    const refreshedComments = flattenCommentTree(refreshedPost?.comments || []);
    const createdComment =
      refreshedComments.find((entry) => String(entry._id) === String(latestComment._id)) ||
      normalizeCommentItem(latestComment);

    return {
      success: true,
      comment: createdComment,
      commentsCount: post.commentsCount,
    };
  }

  static async updateComment({ userId, postId, commentId, text, io, onlineUsers }) {
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw ApiError.badRequest("Invalid post id");
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      throw ApiError.badRequest("Invalid comment id");
    }

    const post = await postRepository.findById(postId);
    if (!post) throw ApiError.notFound("Post not found");

    const comment = post.comments.id(commentId);
    if (!comment) throw ApiError.notFound("Comment not found");

    const commentAuthorId = toIdString(comment.author);
    if (commentAuthorId !== String(userId)) {
      throw ApiError.forbidden("You can only edit your own comment");
    }

    const normalizedText = normalizeText(text, 500);
    if (!normalizedText) {
      throw ApiError.badRequest("Comment text is required");
    }

    comment.text = normalizedText;
    comment.edited = true;
    comment.editedAt = new Date();
    await post.save();

    const refreshed = await withPostAuthor(Post.findById(post._id)).lean();
    const refreshedComments = flattenCommentTree(refreshed?.comments || []);
    const updatedComment =
      refreshedComments.find((entry) => String(entry._id) === String(commentId)) ||
      normalizeCommentItem(comment);

    return {
      success: true,
      comment: updatedComment,
      commentsCount: Number(refreshed?.commentsCount) || refreshedComments.length,
    };
  }

  static async votePoll({ userId, postId, optionId }) {
    const post = await postRepository.findById(postId);
    if (!post) throw ApiError.notFound("Post not found");
    if (post.type !== "poll") throw ApiError.badRequest("Post is not a poll");

    const option = (post.poll?.options || []).find((entry) => String(entry.id) === String(optionId));
    if (!option) throw ApiError.badRequest("Invalid poll option");

    const votes = Array.isArray(post.poll?.votes) ? post.poll.votes : [];
    const existing = votes.find((entry) => String(entry.userId) === String(userId));
    if (existing) {
      if (existing.optionId === optionId) {
        return { success: true, poll: post.poll };
      }
      const prev = (post.poll.options || []).find((entry) => entry.id === existing.optionId);
      if (prev) {
        prev.votesCount = Math.max(0, Number(prev.votesCount) - 1);
      }
      existing.optionId = optionId;
    } else {
      post.poll.votes.push({ userId, optionId });
    }

    option.votesCount = Number(option.votesCount || 0) + 1;
    await post.save();
    return { success: true, poll: post.poll };
  }

  static async answerQuiz({ userId, postId, optionId }) {
    const post = await postRepository.findById(postId);
    if (!post) throw ApiError.notFound("Post not found");
    if (post.type !== "quiz") throw ApiError.badRequest("Post is not a quiz");

    const option = (post.quiz?.options || []).find((entry) => String(entry.id) === String(optionId));
    if (!option) throw ApiError.badRequest("Invalid quiz option");
    const isCorrect = String(post.quiz.correctOptionId) === String(optionId);

    const answers = Array.isArray(post.quiz?.answers) ? post.quiz.answers : [];
    const existing = answers.find((entry) => String(entry.userId) === String(userId));
    if (existing) {
      existing.optionId = optionId;
      existing.isCorrect = isCorrect;
    } else {
      post.quiz.answers.push({ userId, optionId, isCorrect });
    }

    await post.save();
    return { success: true, isCorrect, quiz: post.quiz };
  }
}

module.exports = PostService;
