const mongoose = require("mongoose");
const express = require("express");
const Story = require("../models/Story");
const User = require("../models/User");
const Message = require("../models/Message");
const upload = require("../middleware/storyUpload");
const moderateUpload = require("../middleware/moderateUpload");
const { deleteUploadedMedia, saveUploadedMedia } = require("../services/mediaStore");
const { createNotification } = require("../services/notificationService");
const {
  buildStoryMusicCatalog,
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

const validateStoryUploads = (req, res, next) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const unsupportedFile = files.find((file) => {
    const mimeType = String(file?.mimetype || "").toLowerCase();
    return !mimeType.startsWith("image/") && !mimeType.startsWith("video/");
  });

  if (unsupportedFile) {
    return res.status(400).json({ error: "Stories support image and video uploads only" });
  }
  if (files.length > 1) {
    return res.status(400).json({ error: "Stories support one image or video at a time" });
  }

  return next();
};

const VIDEO_URL_PATTERN = /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(?:$|[?#])/i;

const toStoryOwnerIds = (viewerIdString = "", friendIds = []) =>
  [...new Set([viewerIdString, ...(Array.isArray(friendIds) ? friendIds : [])].filter(Boolean))];

const toObjectIds = (values = []) =>
  (Array.isArray(values) ? values : [])
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));

const getStoryOwnerId = (story = {}) => toIdString(story?.authorId || story?.userId);

const getStoryViewerIds = (story = {}) => {
  const ownerId = getStoryOwnerId(story);
  const legacyIds = Array.isArray(story?.seenBy)
    ? story.seenBy.map((entry) => toIdString(entry))
    : [];
  const viewIds = Array.isArray(story?.views)
    ? story.views.map((entry) => toIdString(entry?.userId))
    : [];
  const reactionIds = Array.isArray(story?.reactions)
    ? story.reactions.map((entry) => toIdString(entry?.userId))
    : [];

  return [
    ...new Set(
      [...legacyIds, ...viewIds, ...reactionIds].filter((id) => id && id !== ownerId)
    ),
  ];
};

const canViewerAccessStory = (story = {}, viewer = null) => {
  const viewerId = toIdString(viewer?._id || viewer?.id);
  const ownerId = getStoryOwnerId(story);
  if (!viewerId || !ownerId) return false;
  if (viewerId === ownerId) return true;
  if (story?.expiresAt && new Date(story.expiresAt).getTime() <= Date.now()) return false;
  if (String(story?.visibility || "friends") === "public") return true;

  const friendIds = (Array.isArray(viewer?.friends) ? viewer.friends : []).map((id) => toIdString(id));
  if (String(story?.visibility || "friends") === "friends") {
    return friendIds.includes(ownerId);
  }

  const closeFriendIds = (Array.isArray(viewer?.closeFriends) ? viewer.closeFriends : [])
    .map((id) => toIdString(id));
  return String(story?.visibility || "") === "close_friends" && closeFriendIds.includes(ownerId);
};

const buildStoryPersonSnapshot = (user = {}) => ({
  userId: user?._id,
  name: String(user?.name || "").trim().slice(0, 120),
  username: String(user?.username || "").trim().slice(0, 30),
  avatar: sanitizeMediaUrlForNewWrite(avatarToUrl(user?.avatar)),
});

const recordStoryView = async (story = {}, viewer = null) => {
  const viewerId = toIdString(viewer?._id);
  if (!story?._id || !viewerId || viewerId === getStoryOwnerId(story)) {
    return false;
  }

  const person = buildStoryPersonSnapshot(viewer);
  await Story.updateOne(
    { _id: story._id },
    { $addToSet: { seenBy: viewerId } }
  );
  const viewResult = await Story.updateOne(
    { _id: story._id, "views.userId": { $ne: viewer._id } },
    {
      $push: {
        views: {
          ...person,
          viewedAt: new Date(),
        },
      },
    }
  );

  return Number(viewResult.modifiedCount || 0) > 0;
};

const buildStoryActivityPayload = async (story = {}) => {
  const ownerId = getStoryOwnerId(story);
  const viewSnapshots = new Map();
  (Array.isArray(story?.views) ? story.views : []).forEach((entry) => {
    const userId = toIdString(entry?.userId);
    if (!userId || userId === ownerId || viewSnapshots.has(userId)) return;
    viewSnapshots.set(userId, {
      name: String(entry?.name || "").trim(),
      username: String(entry?.username || "").trim(),
      avatar: String(entry?.avatar || "").trim(),
      viewedAt: entry?.viewedAt || null,
    });
  });

  getStoryViewerIds(story).forEach((userId) => {
    if (!viewSnapshots.has(userId)) {
      viewSnapshots.set(userId, {
        name: "",
        username: "",
        avatar: "",
        viewedAt: null,
      });
    }
  });

  const reactionSnapshots = new Map();
  (Array.isArray(story?.reactions) ? story.reactions : []).forEach((entry) => {
    const userId = toIdString(entry?.userId);
    if (!userId || userId === ownerId) return;
    reactionSnapshots.set(userId, {
      name: String(entry?.name || "").trim(),
      username: String(entry?.username || "").trim(),
      avatar: String(entry?.avatar || "").trim(),
      emoji: String(entry?.emoji || "").trim().slice(0, 8),
      createdAt: entry?.createdAt || null,
    });
    if (!viewSnapshots.has(userId)) {
      viewSnapshots.set(userId, {
        name: String(entry?.name || "").trim(),
        username: String(entry?.username || "").trim(),
        avatar: String(entry?.avatar || "").trim(),
        viewedAt: entry?.createdAt || null,
      });
    }
  });

  const viewerIds = [...viewSnapshots.keys()];
  const objectIds = toObjectIds(viewerIds);
  const users = objectIds.length > 0
    ? await User.find({ _id: { $in: objectIds } }).select("_id name username avatar").lean()
    : [];
  const userMap = new Map(users.map((entry) => [toIdString(entry._id), entry]));

  const viewers = viewerIds
    .map((userId) => {
      const view = viewSnapshots.get(userId) || {};
      const reaction = reactionSnapshots.get(userId) || {};
      const currentUser = userMap.get(userId) || {};
      const name = String(currentUser?.name || view.name || reaction.name || "Tengacion user").trim();
      const username = String(currentUser?.username || view.username || reaction.username || "").trim();
      const avatar =
        avatarToUrl(currentUser?.avatar)
        || String(view.avatar || reaction.avatar || "").trim();
      const emoji = String(reaction.emoji || "").trim();

      return {
        userId,
        name,
        username,
        avatar,
        viewedAt: view.viewedAt || reaction.createdAt || null,
        reaction: emoji
          ? {
              emoji,
              createdAt: reaction.createdAt || null,
            }
          : null,
      };
    })
    .sort((a, b) => {
      const bTime = new Date(b.viewedAt || 0).getTime() || 0;
      const aTime = new Date(a.viewedAt || 0).getTime() || 0;
      return bTime - aTime;
    });

  return {
    storyId: toIdString(story?._id),
    viewerCount: viewers.length,
    reactionsCount: viewers.filter((entry) => Boolean(entry.reaction)).length,
    viewers,
  };
};

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
  const viewIds = Array.isArray(story?.views)
    ? story.views.map((entry) => toIdString(entry?.userId))
    : [];
  const ownerId = getStoryOwnerId(story);
  const reactionEntries = Array.isArray(story?.reactions) ? story.reactions : [];
  const viewerReaction = reactionEntries.find(
    (entry) => toIdString(entry?.userId) === viewerIdString
  );
  const publicSensitivity = resolvePublicSensitivity({
    moderationStatus: story?.moderationStatus,
    sensitiveContent: story?.sensitiveContent,
    sensitiveType: story?.sensitiveType,
    queue: story?.sensitiveType,
  });

  if (isHiddenFromPublicStatus(publicSensitivity.moderationStatus)) {
    return null;
  }
  if (
    publicSensitivity.moderationStatus === "RESTRICTED_BLURRED"
    && !String(story?.blurPreviewUrl || story?.media?.restrictedPreviewUrl || "").trim()
  ) {
    return null;
  }

  const mediaPayload = resolveStoryMediaPayload(story, {
    moderationStatus: publicSensitivity.moderationStatus,
    blurPreviewUrl: story?.blurPreviewUrl,
  });

  const payload = {
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
    viewerCount: getStoryViewerIds(story).length,
    reactionsCount: reactionEntries.filter(
      (entry) => toIdString(entry?.userId) && toIdString(entry?.userId) !== ownerId
    ).length,
    viewerSeen: seenBy.includes(viewerIdString) || viewIds.includes(viewerIdString),
    viewerReaction: String(viewerReaction?.emoji || "").trim(),
    isOwner: Boolean(ownerId && ownerId === viewerIdString),
  };

  delete payload.seenBy;
  delete payload.views;
  delete payload.reactions;
  delete payload.replies;
  return payload;
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

router.get("/music-catalog", auth, async (req, res) => {
  try {
    const payload = await buildStoryMusicCatalog({
      req,
      viewerId: req.userId,
      page: req.query?.page,
      limit: req.query?.limit,
      search: req.query?.search,
    });
    return res.json(payload);
  } catch (err) {
    console.error("Story music catalog error:", err);
    return res.status(500).json({ error: "Failed to load story music" });
  }
});

router.post(
  "/",
  auth,
  upload.any(),
  validateStoryUploads,
  moderateUpload({
    sourceType: "story_upload",
    titleFields: ["caption", "text"],
    descriptionFields: ["caption", "text"],
    publishWithoutManualReview: true,
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
      const moderationDisabled = String(process.env.MODERATION_ENABLED || "true").toLowerCase() === "false";

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
        moderationStatus: mediaFile
          ? (moderationDisabled || req.moderationUpload?.decision === "approve" ? "approved" : "pending")
          : "approved",
        reviewRequired: Boolean(
          mediaFile
          && !moderationDisabled
          && req.moderationUpload?.decision !== "approve"
        ),
        musicAttachment,
        time: new Date(),
        seenBy: [],
        views: [],
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

/* ================= OWNER-ONLY STORY ACTIVITY ================= */

router.get("/:id/activity", auth, async (req, res) => {
  try {
    const storyId = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ error: "Invalid story id" });
    }

    const story = await Story.findById(storyId).lean();
    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }
    if (getStoryOwnerId(story) !== toIdString(req.userId)) {
      return res.status(403).json({ error: "Only the story owner can view story activity" });
    }

    return res.json(await buildStoryActivityPayload(story));
  } catch (err) {
    console.error("Story activity error:", err);
    return res.status(500).json({ error: "Failed to load story activity" });
  }
});

/* ================= DELETE OWN STORY ================= */

router.delete("/:id", auth, async (req, res) => {
  try {
    const storyId = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ error: "Invalid story id" });
    }

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }

    const ownerId = toIdString(story.authorId || story.userId);
    if (!ownerId || ownerId !== toIdString(req.userId)) {
      return res.status(403).json({ error: "You can only delete your own story" });
    }

    await Story.deleteOne({ _id: story._id });

    const storedMedia = story.media?.toObject?.() || story.media || {
      url: story.mediaUrl || story.image || "",
      resourceType: story.mediaType || "image",
    };
    await deleteUploadedMedia(storedMedia, {
      resourceType: story.mediaType || storedMedia.resourceType || storedMedia.resource_type,
    });

    return res.json({ success: true, storyId });
  } catch (err) {
    console.error("Story delete error:", err);
    return res.status(500).json({ error: "Failed to delete story" });
  }
});

/* ================= MARK STORY AS SEEN ================= */

router.post("/:id/seen", auth, async (req, res) => {
  try {
    const storyId = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ error: "Invalid story id" });
    }

    const [story, viewer] = await Promise.all([
      Story.findById(storyId),
      User.findById(req.userId).select("_id name username avatar friends closeFriends"),
    ]);
    if (!story) return res.status(404).json({ error: "Story not found" });
    if (!viewer) return res.status(404).json({ error: "User not found" });
    if (!canViewerAccessStory(story, viewer)) {
      return res.status(403).json({ error: "You cannot view this story" });
    }

    const recorded = await recordStoryView(story, viewer);

    res.json({ seen: true, recorded });
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
    const storyId = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ error: "Invalid story id" });
    }

    const [story, viewer] = await Promise.all([
      Story.findById(storyId),
      User.findById(req.userId).select("_id name username avatar friends closeFriends"),
    ]);
    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }
    if (!viewer) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!canViewerAccessStory(story, viewer)) {
      return res.status(403).json({ error: "You cannot view this story" });
    }

    const emoji = String(req.body?.emoji || "").trim().slice(0, 8);
    if (!emoji) {
      return res.status(400).json({ error: "Emoji is required" });
    }

    const userId = toIdString(req.userId);
    if (userId === getStoryOwnerId(story)) {
      return res.status(400).json({ error: "You cannot react to your own story" });
    }
    await recordStoryView(story, viewer);

    const person = buildStoryPersonSnapshot(viewer);
    const reactions = Array.isArray(story.reactions) ? story.reactions : [];
    const existingIndex = reactions.findIndex((entry) => toIdString(entry.userId) === userId);

    if (existingIndex >= 0) {
      story.reactions[existingIndex].name = person.name;
      story.reactions[existingIndex].username = person.username;
      story.reactions[existingIndex].avatar = person.avatar;
      story.reactions[existingIndex].emoji = emoji;
      story.reactions[existingIndex].createdAt = new Date();
    } else {
      story.reactions.push({
        ...person,
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
