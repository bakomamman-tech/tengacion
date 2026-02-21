const express = require("express");
const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/auth");
const upload = require("../utils/upload");
const { createNotification } = require("../services/notificationService");
const { saveUploadedFile } = require("../services/mediaStore");

const router = express.Router();

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const uniqueIds = (values) => [...new Set(values.filter(Boolean))];

const inferMediaKind = (file) => {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (mime.startsWith("video/")) {
    return "video";
  }
  if (mime.startsWith("image/")) {
    return "image";
  }

  const filename = String(file?.originalname || file?.filename || "").toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(filename)) {
    return "video";
  }
  return "image";
};

const avatarToUrl = (avatar) => {
  if (!avatar) return "";
  if (typeof avatar === "string") return avatar;
  return avatar.url || "";
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

const toPostPayload = (post, viewerId) => {
  const author = post.author || {};
  const firstMedia = Array.isArray(post.media) && post.media.length > 0
    ? post.media[0]
    : null;
  const likes = Array.isArray(post.likes) ? post.likes : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const moreOptions = Array.isArray(post.moreOptions) ? post.moreOptions : [];
  const callToAction = post.callToAction || {};
  const authorId = author?._id ? author._id.toString() : "";
  const viewerIdString = viewerId ? viewerId.toString() : "";
  const likedByViewer = Boolean(
    viewerIdString && likes.some((id) => id.toString() === viewerIdString)
  );

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

const withPostAuthor = (query) =>
  query.populate("author", "name username avatar");

/* ================= CREATE POST ================= */
router.post(
  "/",
  auth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const viewerId = req.user.id;
      const text = (req.body?.text || "").trim();
      const tags = toStringArray(req.body?.tags, 12, 40, true);
      const feeling = normalizeText(req.body?.feeling, 60);
      const location = normalizeText(req.body?.location, 140);
      const callsEnabled = toBool(req.body?.callsEnabled);
      const callNumber = normalizeText(req.body?.callNumber, 36);
      const moreOptions = toStringArray(req.body?.moreOptions, 8, 60, false);
      const uploadFile =
        req.files?.image?.[0] || req.files?.file?.[0] || null;
      const hasMetadata = Boolean(
        tags.length ||
        feeling ||
        location ||
        moreOptions.length ||
        (callsEnabled && callNumber)
      );

      if (!text && !uploadFile && !hasMetadata) {
        return res.status(400).json({ error: "Post cannot be empty" });
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

      const created = await Post.create({
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
      return res.status(201).json(toPostPayload(post, viewerId));
    } catch (err) {
      console.error("Create post error:", err);
      return res.status(500).json({ error: "Failed to create post" });
    }
  }
);

/* ================= FEED ================= */
router.get("/", auth, async (req, res) => {
  try {
    const viewerId = req.user.id;
    const rawSearch = (req.query.search || "").trim();
    const search = rawSearch.replace(/^@+/, "");

    const viewer = await User.findById(viewerId).select("following friends");
    if (!viewer) {
      return res.status(401).json({ error: "User not found" });
    }

    const followingIds = uniqueIds(
      (viewer.following || []).map((id) => toIdString(id))
    ).filter((id) => id && id !== viewerId);
    const friendIds = uniqueIds((viewer.friends || []).map((id) => toIdString(id))).filter(
      (id) => id && id !== viewerId
    );
    const followingOnlyIds = followingIds.filter((id) => !friendIds.includes(id));

    const visibilityScopes = [
      { author: viewerId },
      { author: { $in: friendIds }, privacy: { $in: ["public", "friends"] } },
      { author: { $in: followingOnlyIds }, privacy: "public" },
    ];

    let matchedAuthorIds = [];
    if (search) {
      const matchingUsers = await User.find(
        {
          $or: [
            { username: { $regex: search, $options: "i" } },
            { name: { $regex: search, $options: "i" } },
          ],
        },
        "_id"
      ).lean();
      matchedAuthorIds = matchingUsers.map((entry) => entry._id);

      if (matchedAuthorIds.length > 0) {
        visibilityScopes.push({
          author: { $in: matchedAuthorIds },
          privacy: "public",
        });
      }
    }

    const query = { $or: visibilityScopes };
    if (search) {
      const searchFilters = [{ text: { $regex: search, $options: "i" } }];
      if (matchedAuthorIds.length > 0) {
        searchFilters.push({ author: { $in: matchedAuthorIds } });
      }
      query.$and = [{ $or: searchFilters }];
    }

    const posts = await withPostAuthor(
      Post.find(query).sort({ createdAt: -1 })
    ).lean();

    return res.json(posts.map((post) => toPostPayload(post, viewerId)));
  } catch (err) {
    console.error("Feed error:", err);
    return res.status(500).json({ error: "Failed to load feed" });
  }
});

/* ================= POSTS BY USERNAME ================= */
router.get("/user/:username", auth, async (req, res) => {
  try {
    const viewerId = req.user.id;
    const username = (req.params.username || "").trim().toLowerCase();
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    const profileUser = await User.findOne({ username }).select("_id friends");
    if (!profileUser) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const viewer = await User.findById(viewerId).select("_id");
    if (!viewer) {
      return res.status(401).json({ error: "User not found" });
    }

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

    return res.json(posts.map((post) => toPostPayload(post, viewerId)));
  } catch (err) {
    console.error("User posts error:", err);
    return res.status(500).json({ error: "Failed to load profile posts" });
  }
});

/* ================= UPDATE POST ================= */
router.put("/:id", auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid post id" });
    }

    const viewerId = req.user.id;
    const text = (req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ error: "Post text is required" });
    }

    const post = await Post.findOne({
      _id: req.params.id,
      author: viewerId,
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    post.text = text;
    post.edited = true;
    await post.save();

    const updated = await withPostAuthor(Post.findById(post._id)).lean();
    return res.json(toPostPayload(updated, viewerId));
  } catch (err) {
    console.error("Update post error:", err);
    return res.status(500).json({ error: "Failed to update post" });
  }
});

/* ================= DELETE POST ================= */
router.delete("/:id", auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid post id" });
    }

    const deleted = await Post.findOneAndDelete({
      _id: req.params.id,
      author: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Post not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Delete post error:", err);
    return res.status(500).json({ error: "Failed to delete post" });
  }
});

/* ================= LIKE / UNLIKE ================= */
router.post("/:id/like", auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid post id" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const viewerId = req.user.id.toString();
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
        io: req.app.get("io"),
        onlineUsers: req.app.get("onlineUsers"),
      });
    }

    await post.save();

    return res.json({
      success: true,
      liked: !liked,
      likesCount: post.likes.length,
    });
  } catch (err) {
    console.error("Like error:", err);
    return res.status(500).json({ error: "Failed to update like" });
  }
});

/* ================= SHARE ================= */
router.post("/:id/share", auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid post id" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const current = Number(post.shareCount) || 0;
    post.shareCount = current + 1;
    await post.save();

    return res.json({
      success: true,
      shareCount: post.shareCount,
    });
  } catch (err) {
    console.error("Share error:", err);
    return res.status(500).json({ error: "Failed to share post" });
  }
});

/* ================= COMMENT ================= */
router.post("/:id/comment", auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid post id" });
    }

    const viewerId = req.user.id;
    const text = (req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    post.comments.push({
      author: viewerId,
      text,
    });
    post.commentsCount = post.comments.length;
    await post.save();

    await createNotification({
      recipient: post.author,
      sender: viewerId,
      type: "comment",
      text: "commented on your post",
      entity: {
        id: post._id,
        model: "Post",
      },
      io: req.app.get("io"),
      onlineUsers: req.app.get("onlineUsers"),
    });

    const latestComment = post.comments[post.comments.length - 1];
    return res.status(201).json({
      success: true,
      comment: latestComment,
      commentsCount: post.commentsCount,
    });
  } catch (err) {
    console.error("Comment error:", err);
    return res.status(500).json({ error: "Failed to add comment" });
  }
});

module.exports = router;
