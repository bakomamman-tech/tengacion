const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../../../backend/models/User");
const { createNotification } = require("../../../backend/services/notificationService");
const { saveUploadedFile } = require("../../../backend/services/mediaStore");
const ApiError = require("../utils/ApiError");
const userRepository = require("../repositories/userRepository");
const postRepository = require("../repositories/postRepository");

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

const normalizeText = (value, maxLength = 160) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

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

const avatarToUrl = (avatar) => {
  if (!avatar) return "";
  if (typeof avatar === "string") return avatar;
  return avatar.url || "";
};

const withPostAuthor = (query) => query.populate("author", "name username avatar");

const toPostPayload = (post, viewerId) => {
  const author = post.author || {};
  const firstMedia = Array.isArray(post.media) && post.media.length > 0 ? post.media[0] : null;
  const likes = Array.isArray(post.likes) ? post.likes : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const moreOptions = Array.isArray(post.moreOptions) ? post.moreOptions : [];
  const callToAction = post.callToAction || {};
  const authorId = author?._id ? author._id.toString() : "";
  const viewerIdString = viewerId ? viewerId.toString() : "";
  const likedByViewer = Boolean(viewerIdString && likes.some((id) => id.toString() === viewerIdString));

  return {
    _id: post._id.toString(),
    text: post.text || "",
    image: firstMedia?.url || "",
    media: Array.isArray(post.media) ? post.media : [],
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
    feeling: post.feeling || "",
    location: post.location || "",
    callToAction: {
      type: callToAction.type || "none",
      enabled: Boolean(callToAction.enabled),
      value: callToAction.value || "",
    },
    moreOptions,
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
  static async createPost({ userId, body, files }) {
    const viewerId = userId;
    const text = normalizeText(body?.text || "", 240);
    const tags = toStringArray(body?.tags, 12, 40, true);
    const feeling = normalizeText(body?.feeling, 60);
    const location = normalizeText(body?.location, 140);
    const callsEnabled = toBool(body?.callsEnabled);
    const callNumber = normalizeText(body?.callNumber, 36);
    const moreOptions = toStringArray(body?.moreOptions, 8, 60, false);
    const uploadFile = files?.image?.[0] || files?.file?.[0] || null;
    const hasMetadata = Boolean(
      tags.length || feeling || location || moreOptions.length || (callsEnabled && callNumber)
    );

    if (!text && !uploadFile && !hasMetadata) {
      throw ApiError.badRequest("Post cannot be empty");
    }

    const media = [];
    if (uploadFile) {
      const persistedUrl = await saveUploadedFile(uploadFile);
      media.push({
        url: persistedUrl,
        type: inferMediaKind(uploadFile),
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
      feeling,
      location,
      callToAction,
      moreOptions,
      media,
      privacy: "public",
    });

    const post = await withPostAuthor(Post.findById(created._id)).lean();
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

      visibilityScopes.push({ author: viewerId });
      visibilityScopes.push({
        author: { $in: friendIds },
        privacy: { $in: ["public", "friends"] },
      });
      visibilityScopes.push({
        author: { $in: followingOnlyIds },
        privacy: "public",
      });

      if (matchedAuthorIds.length > 0) {
        visibilityScopes.push({
          author: { $in: matchedAuthorIds },
          privacy: "public",
        });
      }
    } else {
      visibilityScopes.push({ privacy: "public" });
      if (matchedAuthorIds.length > 0) {
        visibilityScopes.push({
          author: { $in: matchedAuthorIds },
          privacy: "public",
        });
      }
    }

    const query = { $or: visibilityScopes };
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

    let privacyFilter = { privacy: "public" };
    if (isOwner) {
      privacyFilter = {};
    } else if (isFriend) {
      privacyFilter = { privacy: { $in: ["public", "friends"] } };
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

    const normalizedText = normalizeText(text, 500);
    if (!normalizedText) {
      throw ApiError.badRequest("Comment text is required");
    }

    const post = await postRepository.findById(postId);
    if (!post) throw ApiError.notFound("Post not found");

    post.comments.push({
      author: userId,
      text: normalizedText,
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
    return {
      success: true,
      comment: latestComment,
      commentsCount: post.commentsCount,
    };
  }
}

module.exports = PostService;
