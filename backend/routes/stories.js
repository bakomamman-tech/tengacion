const express = require("express");
const jwt = require("jsonwebtoken");
const Story = require("../models/Story");
const User = require("../models/User");
const upload = require("../utils/upload");
const { saveUploadedFile } = require("../services/mediaStore");

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
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });

  const token = header.startsWith("Bearer ")
    ? header.split(" ")[1]
    : header;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

const inferStoryMediaType = (file = null) => {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (mime.startsWith("video/")) {
    return "video";
  }
  return "image";
};

/* ================= CREATE STORY (TEXT/IMAGE/VIDEO) ================= */

router.post("/", auth, upload.any(), async (req, res) => {
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

    const story = await Story.create({
      userId: user._id.toString(),
      name: user.name,
      username: user.username,
      avatar: avatarToUrl(user.avatar),
      text: caption,
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
    const viewerId = toIdString(req.userId);
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const ids = [...new Set([viewerId, ...(user.friends || []).map((id) => toIdString(id))])];

    const stories = await Story.find({
      userId: { $in: ids },
      expiresAt: { $gt: new Date() },
    })
      .sort({ time: -1 })
      .lean();

    const payload = stories.map((story) => {
      const seenBy = Array.isArray(story.seenBy)
        ? story.seenBy.map((id) => toIdString(id))
        : [];
      const mediaUrl = story.mediaUrl || story.image || "";
      const mediaType = story.mediaType || "image";
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
        viewerSeen: seenBy.includes(viewerId),
      };
    });

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

module.exports = router;
