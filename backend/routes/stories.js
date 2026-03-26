const express = require("express");
const Story = require("../models/Story");
const User = require("../models/User");
const Message = require("../models/Message");
const upload = require("../middleware/privateUpload");
const moderateUpload = require("../middleware/moderateUpload");
const { saveUploadedFile } = require("../services/mediaStore");
const { createNotification } = require("../services/notificationService");
const {
  SessionAuthError,
  authenticateAccessToken,
  extractBearerToken,
} = require("../services/sessionAuth");

const router = express.Router();

const avatarToUrl = (avatar) => {
  if (!avatar) return "";
  if (typeof avatar === "string") return avatar;
  return avatar.url || "";
};

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

/* ================= AUTH ================= */

function auth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  authenticateAccessToken(token, { touchSession: true })
    .then((authContext) => {
      req.userId = authContext.userId;
      req.user = {
        id: authContext.userId,
        _id: authContext.user._id,
        role: authContext.user.role || "user",
        sessionId: authContext.sessionId,
      };
      next();
    })
    .catch((err) => {
      if (err instanceof SessionAuthError) {
        return res.status(err.statusCode || 401).json({ error: err.message });
      }
      return res.status(401).json({ error: "Invalid token" });
    });
}

const inferStoryMediaType = (file = null) => {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (mime.startsWith("video/")) {
    return "video";
  }
  return "image";
};

const loadVisibleStories = async (viewerId) => {
  const user = await User.findById(viewerId).lean();
  if (!user) {
    return null;
  }

  const viewerIdString = toIdString(viewerId);
  const friendIds = (user.friends || []).map((id) => toIdString(id));
  const closeFriendIds = (user.closeFriends || []).map((id) => toIdString(id));
  const ids = [...new Set([viewerIdString, ...friendIds])];

  const stories = await Story.find({ userId: { $in: ids }, expiresAt: { $gt: new Date() } })
    .sort({ time: -1 })
    .lean();

  return stories
    .filter((story) => {
      const ownerId = toIdString(story.userId);
      if (ownerId === viewerIdString) return true;
      if (story.visibility === "public") return true;
      if (story.visibility === "friends") return friendIds.includes(ownerId);
      if (story.visibility === "close_friends") return closeFriendIds.includes(ownerId);
      return false;
    })
    .map((story) => {
      const seenBy = Array.isArray(story.seenBy)
        ? story.seenBy.map((id) => toIdString(id))
        : [];
      const mediaUrl = story.mediaUrl || story.image || "";
      const mediaType = story.mediaType || story?.media?.type || "image";
      return {
        ...story,
        id: toIdString(story._id),
        userId: toIdString(story.userId),
        userAvatar: story.avatar || "",
        mediaUrl,
        mediaType,
        thumbnailUrl: story.thumbnailUrl || (mediaType === "image" ? mediaUrl : ""),
        createdAt: story.time || story.createdAt,
        seenBy,
        viewerSeen: seenBy.includes(viewerIdString),
      };
    });
};

/* ================= CREATE STORY (TEXT/IMAGE/VIDEO) ================= */

router.post(
  "/",
  auth,
  upload.any(),
  moderateUpload({
    sourceType: "story",
    titleFields: ["caption", "text"],
    descriptionFields: ["caption", "text"],
  }),
  async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const files = Array.isArray(req.files) ? req.files : [];
    const mediaFile = files.find((entry) =>
      ["media", "image", "video"].includes(String(entry?.fieldname || "").toLowerCase())
    ) || files[0];
    const storyMediaUrl = mediaFile ? await saveUploadedFile(mediaFile) : "";
    const mediaType = inferStoryMediaType(mediaFile);
    const caption = String(req.body?.caption || req.body?.text || "").trim();

    const visibility = String(req.body?.visibility || "friends").toLowerCase();
    const normalizedVisibility = ["public", "friends", "close_friends"].includes(visibility)
      ? visibility
      : "friends";

    const story = await Story.create({
      userId: user._id.toString(),
      authorId: user._id,
      name: user.name,
      username: user.username,
      avatar: avatarToUrl(user.avatar),
      text: caption,
      visibility: normalizedVisibility,
      media: {
        url: storyMediaUrl,
        public_id: "",
        type: mediaType,
      },
      image: storyMediaUrl,
      mediaUrl: storyMediaUrl,
      mediaType,
      thumbnailUrl: mediaType === "image" ? storyMediaUrl : "",
      time: new Date(),
      seenBy: [],
    });

    res.json(story);
  } catch (err) {
    console.error("Story create error:", err);
    res.status(500).json({ error: "Failed to create story" });
  }
});

/* ================= GET STORIES (ME + FRIENDS) ================= */

router.get("/", auth, async (req, res) => {
  try {
    const payload = await loadVisibleStories(req.userId);
    if (!payload) return res.status(404).json({ error: "User not found" });
    res.json(payload);
  } catch (err) {
    console.error("Story fetch error:", err);
    res.status(500).json({ error: "Failed to load stories" });
  }
});

/* ================= MARK STORY AS SEEN ================= */

router.post("/:id/seen", auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: "Story not found" });

    const viewerId = toIdString(req.userId);
    const seenBy = Array.isArray(story.seenBy)
      ? story.seenBy.map((id) => toIdString(id))
      : [];

    if (!seenBy.includes(viewerId)) {
      story.seenBy.push(viewerId);
      await story.save();
    }

    res.json({ seen: true });
  } catch (err) {
    console.error("Story seen error:", err);
    res.status(500).json({ error: "Failed to mark as seen" });
  }
});

/* ================= STORIES FEED ALIAS ================= */
router.get("/feed", auth, async (req, res) => {
  try {
    const payload = await loadVisibleStories(req.userId);
    if (!payload) return res.status(404).json({ error: "User not found" });
    return res.json(payload);
  } catch (err) {
    console.error("Story feed error:", err);
    return res.status(500).json({ error: "Failed to load stories" });
  }
});

/* ================= STORY REACTIONS ================= */
router.post("/:id/react", auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }

    const emoji = String(req.body?.emoji || "").trim().slice(0, 8);
    if (!emoji) {
      return res.status(400).json({ error: "Emoji is required" });
    }

    const userId = toIdString(req.userId);
    const reactions = Array.isArray(story.reactions) ? story.reactions : [];
    const existingIndex = reactions.findIndex((entry) => toIdString(entry.userId) === userId);

    if (existingIndex >= 0) {
      story.reactions[existingIndex].emoji = emoji;
      story.reactions[existingIndex].createdAt = new Date();
    } else {
      story.reactions.push({
        userId,
        emoji,
        createdAt: new Date(),
      });
    }

    await story.save();
    return res.json({ success: true, reactionsCount: story.reactions.length });
  } catch (err) {
    console.error("Story react error:", err);
    return res.status(500).json({ error: "Failed to react to story" });
  }
});

/* ================= STORY REPLY ================= */
router.post("/:id/reply", auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }

    const text = String(req.body?.text || "").trim().slice(0, 600);
    if (!text) {
      return res.status(400).json({ error: "Reply text is required" });
    }

    const senderId = toIdString(req.userId);
    const receiverId = toIdString(story.authorId || story.userId);
    if (!receiverId || senderId === receiverId) {
      return res.status(400).json({ error: "Cannot reply to this story" });
    }

    story.replies.push({
      userId: senderId,
      text,
      createdAt: new Date(),
    });
    await story.save();

    const conversationId = [senderId, receiverId].sort().join("_");
    const message = await Message.create({
      conversationId,
      senderId,
      receiverId,
      text: `Story reply: ${text}`,
      type: "text",
      metadata: {
        type: "",
        payload: { storyId: story._id.toString() },
      },
    });

    await createNotification({
      recipient: receiverId,
      sender: senderId,
      type: "reply",
      text: "replied to your story",
      entity: { id: story._id, model: "Post" },
      metadata: { link: "/home", previewText: text },
      io: req.app.get("io"),
      onlineUsers: req.app.get("onlineUsers"),
    });

    return res.status(201).json({ success: true, messageId: message._id.toString() });
  } catch (err) {
    console.error("Story reply error:", err);
    return res.status(500).json({ error: "Failed to reply to story" });
  }
});

module.exports = router;
