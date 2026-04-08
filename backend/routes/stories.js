const mongoose = require("mongoose");
const express = require("express");
const Story = require("../models/Story");
const User = require("../models/User");
const Message = require("../models/Message");
const upload = require("../middleware/privateUpload");
const moderateUpload = require("../middleware/moderateUpload");
const { saveUploadedMedia } = require("../services/mediaStore");
const { createNotification } = require("../services/notificationService");
const {
  hydrateStoryMusicAttachment,
  resolveStoryMusicSelection,
} = require("../services/storyMusicService");
const { normalizeMediaValue, sanitizeMediaUrlForNewWrite } = require("../utils/userMedia");
const {
  isHiddenFromPublicStatus,
  resolvePublicSensitivity,
} = require("../utils/publicModeration");
const {
  SessionAuthError,
  authenticateAccessToken,
  extractBearerToken,
} = require("../services/sessionAuth");

const router = express.Router();

const avatarToUrl = (avatar) => {
  return normalizeMediaValue(avatar).url;
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

const VIDEO_URL_PATTERN = /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(?:$|[?#])/i;

const toStoryOwnerIds = (viewerIdString = "", friendIds = []) =>
  [...new Set([viewerIdString, ...(Array.isArray(friendIds) ? friendIds : [])].filter(Boolean))];

const toObjectIds = (values = []) =>
  (Array.isArray(values) ? values : [])
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));

const resolveStoryMediaPayload = (story = {}, { moderationStatus = "", blurPreviewUrl = "" } = {}) => {
  const storyMedia = story?.media || {};
  const baseMediaUrl = String(
    story?.mediaUrl
      || story?.image
      || storyMedia?.secureUrl
      || storyMedia?.secure_url
      || storyMedia?.url
      || ""
  ).trim();
  const normalizedBlurPreviewUrl = String(
    blurPreviewUrl
      || story?.blurPreviewUrl
      || storyMedia?.restrictedPreviewUrl
      || ""
  ).trim();
  const rawMediaType = String(story?.mediaType || storyMedia?.type || "").trim().toLowerCase();
  const mediaType = rawMediaType || (VIDEO_URL_PATTERN.test(baseMediaUrl) ? "video" : "image");
  const baseThumbnailUrl = String(
    story?.thumbnailUrl
      || storyMedia?.previewUrl
      || storyMedia?.thumbnailUrl
      || (mediaType === "image" ? baseMediaUrl : "")
  ).trim();
  const shouldUseBlurPreview =
    String(moderationStatus || "").trim() === "RESTRICTED_BLURRED" && normalizedBlurPreviewUrl;
  const publicMediaUrl = shouldUseBlurPreview ? normalizedBlurPreviewUrl : baseMediaUrl;
  const publicThumbnailUrl = shouldUseBlurPreview ? normalizedBlurPreviewUrl : baseThumbnailUrl;

  return {
    image: shouldUseBlurPreview ? normalizedBlurPreviewUrl : String(story?.image || baseMediaUrl).trim(),
    mediaUrl: publicMediaUrl,
    mediaType,
    thumbnailUrl: publicThumbnailUrl || (mediaType === "image" ? publicMediaUrl : ""),
    blurPreviewUrl: normalizedBlurPreviewUrl,
  };
};

const buildStoryPayload = async (story = {}, { authorAvatarMap = new Map(), req = null, viewerIdString = "" } = {}) => {
  const seenBy = Array.isArray(story?.seenBy)
    ? story.seenBy.map((id) => toIdString(id))
    : [];
  const ownerId = toIdString(story?.authorId || story?.userId);
  const publicSensitivity = resolvePublicSensitivity({
    moderationStatus: story?.moderationStatus,
    sensitiveContent: story?.sensitiveContent,
    sensitiveType: story?.sensitiveType,
    queue: story?.sensitiveType,
  });

  if (ownerId !== viewerIdString && isHiddenFromPublicStatus(publicSensitivity.moderationStatus)) {
    return null;
  }

  const mediaPayload = resolveStoryMediaPayload(story, {
    moderationStatus: publicSensitivity.moderationStatus,
    blurPreviewUrl: story?.blurPreviewUrl,
  });

  return {
    ...story,
    id: toIdString(story?._id),
    userId: toIdString(story?.userId || story?.authorId),
    avatar: authorAvatarMap.get(ownerId) || story?.avatar || "",
    userAvatar: authorAvatarMap.get(ownerId) || story?.avatar || "",
    image: mediaPayload.image,
    mediaUrl: mediaPayload.mediaUrl,
    mediaType: mediaPayload.mediaType,
    thumbnailUrl: mediaPayload.thumbnailUrl,
    moderationStatus: publicSensitivity.moderationStatus,
    sensitiveContent: publicSensitivity.sensitiveContent,
    sensitiveType: publicSensitivity.sensitiveType,
    blurPreviewUrl: mediaPayload.blurPreviewUrl,
    reviewRequired:
      publicSensitivity.moderationStatus === "HOLD_FOR_REVIEW" || Boolean(story?.reviewRequired),
    musicAttachment: await hydrateStoryMusicAttachment(story?.musicAttachment, {
      req,
      viewerId: viewerIdString,
    }),
    createdAt: story?.time || story?.createdAt,
    seenBy,
    viewerSeen: seenBy.includes(viewerIdString),
  };
};

const loadVisibleStories = async (viewerId, req = null) => {
  const user = await User.findById(viewerId).lean();
  if (!user) {
    return null;
  }

  const viewerIdString = toIdString(viewerId);
  const friendIds = (user.friends || []).map((id) => toIdString(id));
  const closeFriendIds = (user.closeFriends || []).map((id) => toIdString(id));
  const ownerIds = toStoryOwnerIds(viewerIdString, friendIds);
  const authorObjectIds = toObjectIds(ownerIds);
  const storyLookup = [{ userId: { $in: ownerIds } }];
  if (authorObjectIds.length > 0) {
    storyLookup.push({ authorId: { $in: authorObjectIds } });
  }

  const stories = await Story.find({ expiresAt: { $gt: new Date() }, $or: storyLookup })
    .sort({ time: -1 })
    .lean();
  const authorIds = [...new Set(
    stories
      .map((story) => toIdString(story.authorId || story.userId))
      .filter(Boolean)
  )];
  const authors = authorIds.length > 0
    ? await User.find({ _id: { $in: authorIds } }).select("_id avatar").lean()
    : [];
  const authorAvatarMap = new Map(
    authors.map((entry) => [toIdString(entry._id), avatarToUrl(entry.avatar)])
  );

  const payload = await Promise.all(stories
    .filter((story) => {
      const ownerId = toIdString(story.authorId || story.userId);
      if (ownerId === viewerIdString) return true;
      if (story.visibility === "public") return true;
      if (story.visibility === "friends") return friendIds.includes(ownerId);
      if (story.visibility === "close_friends") return closeFriendIds.includes(ownerId);
      return false;
    })
    .map((story) =>
      buildStoryPayload(story, {
        authorAvatarMap,
        req,
        viewerIdString,
      })
    ));

  return payload.filter(Boolean);
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
      const mediaFile =
        files.find((entry) =>
          ["media", "image", "video"].includes(String(entry?.fieldname || "").toLowerCase())
        ) || files[0];
      const uploadedMedia = mediaFile
        ? await saveUploadedMedia(mediaFile, {
            source: inferStoryMediaType(mediaFile) === "video" ? "story_video" : "story_image",
            resourceType: inferStoryMediaType(mediaFile) === "video" ? "video" : "image",
          })
        : null;
      const storyMediaUrl = uploadedMedia?.secureUrl || uploadedMedia?.url || "";
      const mediaType = inferStoryMediaType(mediaFile);
      const caption = String(req.body?.caption || req.body?.text || "").trim();
      const rawMusicAttachment = req.body?.musicAttachment;
      const musicAttachment = await resolveStoryMusicSelection(rawMusicAttachment);
      if (String(rawMusicAttachment || "").trim() && !musicAttachment) {
        return res.status(400).json({ error: "Selected soundtrack is unavailable" });
      }

      const visibility = String(req.body?.visibility || "friends").toLowerCase();
      const normalizedVisibility = ["public", "friends", "close_friends"].includes(visibility)
        ? visibility
        : "friends";

      const storedAvatar = sanitizeMediaUrlForNewWrite(avatarToUrl(user.avatar));

      const story = await Story.create({
        userId: user._id.toString(),
        authorId: user._id,
        name: user.name,
        username: user.username,
        avatar: storedAvatar,
        text: caption,
        visibility: normalizedVisibility,
        media: {
          ...(uploadedMedia || { url: storyMediaUrl, public_id: "" }),
          type: mediaType,
        },
        image: storyMediaUrl,
        mediaUrl: storyMediaUrl,
        mediaType,
        thumbnailUrl: mediaType === "image" ? storyMediaUrl : "",
        musicAttachment,
        time: new Date(),
        seenBy: [],
      });

      const payload = await buildStoryPayload(story.toObject(), {
        authorAvatarMap: new Map([[user._id.toString(), avatarToUrl(user.avatar)]]),
        req,
        viewerIdString: req.userId,
      });

      return res.json(payload);
    } catch (err) {
      console.error("Story create error:", err);
      res.status(500).json({ error: "Failed to create story" });
    }
  }
);

/* ================= GET STORIES (ME + FRIENDS) ================= */

router.get("/", auth, async (req, res) => {
  try {
    const payload = await loadVisibleStories(req.userId, req);
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
    const payload = await loadVisibleStories(req.userId, req);
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
      entity: { id: message._id, model: "Message" },
      metadata: {
        link: "/home",
        previewText: text,
        dedupeKey: `story_reply:${story._id.toString()}:${message._id.toString()}`,
      },
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
