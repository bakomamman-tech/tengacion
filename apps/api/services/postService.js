const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../../../backend/models/User");
const { createNotification } = require("../../../backend/services/notificationService");
const { saveUploadedMedia } = require("../../../backend/services/mediaStore");
const ApiError = require("../utils/ApiError");
const {
  MAX_VIDEO_BYTES,
  ALLOWED_MIME_TYPES,
} = require("../../../backend/services/videoStorage");
const userRepository = require("../repositories/userRepository");
const postRepository = require("../repositories/postRepository");
const { resolveMentionUserIds } = require("../../../backend/utils/mentions");
const { incrementDailyMetric, logAnalyticsEvent, touchUserActivity } = require("../../../backend/services/analyticsService");

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

const validateVideoMeta = (video) => {
  if (!video) {
    return;
  }

  if (video.mimeType && !ALLOWED_MIME_TYPES.has(video.mimeType)) {
    throw ApiError.badRequest("Only MP4 and WebM videos are supported");
  }

  if (video.sizeBytes > MAX_VIDEO_BYTES) {
    throw ApiError.badRequest("Video exceeds maximum allowed size (200MB)");
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
  if (!avatar) return "";
  if (typeof avatar === "string") return avatar;
  return avatar.url || "";
};

const withPostAuthor = (query) => query.populate("author", "name username avatar");

const getPostPreviewImage = (post = {}) => {
  if (post?.video?.thumbnailUrl) {
    return normalizeVideoUrl(post.video.thumbnailUrl);
  }

  const mediaList = Array.isArray(post?.media) ? post.media : [];
  const firstMedia = mediaList[0];
  if (firstMedia && typeof firstMedia === "object" && firstMedia.url) {
    return normalizeVideoUrl(firstMedia.url);
  }

  return "";
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
    return {
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
    };
  }

  const originalAuthor = originalPost.author || {};
  const previewMediaType =
    originalPost.type === "reel"
      ? "reel"
      : originalPost?.video?.playbackUrl || originalPost?.video?.url
        ? "video"
        : Array.isArray(originalPost?.media) && originalPost.media.length > 0
          ? originalPost.media[0]?.type || "image"
          : "text";

  return {
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
  };
};

const toPostPayload = (post, viewerId) => {
  const author = post.author || {};
  const firstMedia = Array.isArray(post.media) && post.media.length > 0 ? post.media[0] : null;
  const likes = Array.isArray(post.likes) ? post.likes : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const videoPayload = post.video || null;
  const postType = post.type || (videoPayload ? "video" : "text");
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
    media: Array.isArray(post.media) ? post.media : [],
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
    user: {
      _id: authorId,
      name: author.name || "",
      username: author.username || "",
      profilePic: avatarToUrl(author.avatar),
    },
  };
};

class PostService {
  static async createPost({ userId, body, files, io = null, onlineUsers = null }) {
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

    const media = [];
    if (uploadFile) {
      const persisted = await saveUploadedMedia(uploadFile);
      const persistedKind = inferMediaKind(uploadFile);
      media.push({
        public_id: persisted.public_id || "",
        url: persisted.url,
        type: persistedKind,
      });

      if (persistedKind === "video") {
        videoMeta = {
          url: persisted.url,
          playbackUrl: persisted.url,
          thumbnailUrl: "",
          duration: videoMeta?.duration || 0,
          width: videoMeta?.width || 0,
          height: videoMeta?.height || 0,
          sizeBytes: Number(uploadFile.size) || videoMeta?.sizeBytes || 0,
          mimeType:
            normalizeMimeType(uploadFile.mimetype) ||
            normalizeMimeType(videoMeta?.mimeType),
        };
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
    });

    const post = await withPostAuthor(Post.findById(created._id)).lean();
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

    return toPostPayload(post, viewerId);
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
    return posts.map((post) => toPostPayload(post, viewerId));
  }

  static async getPostById({ viewerId, postId }) {
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw ApiError.badRequest("Invalid post id");
    }

    const post = await withPostAuthor(Post.findById(postId)).lean();
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    return toPostPayload(post, viewerId);
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

    return posts.map((post) => toPostPayload(post, viewerId));
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

    const parentCommentId = text?.parentCommentId || null;
    const bodyText = typeof text === "object" ? text?.text : text;
    const normalizedText = normalizeText(bodyText, 500);
    if (!normalizedText) {
      throw ApiError.badRequest("Comment text is required");
    }

    const mentions = await resolveMentionUserIds(normalizedText);

    post.comments.push({
      author: userId,
      text: normalizedText,
      parentCommentId,
      mentions,
      reactions: [],
      reactionsCount: 0,
    });
    post.commentsCount = post.comments.length;
    await post.save();

    await createNotification({
      recipient: post.author,
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

    const latestComment = post.comments[post.comments.length - 1];
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

    return {
      success: true,
      comment: latestComment,
      commentsCount: post.commentsCount,
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
