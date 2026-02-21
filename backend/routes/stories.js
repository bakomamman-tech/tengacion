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

/* ================= CREATE STORY (TEXT OR IMAGE) ================= */

router.post("/", auth, upload.single("image"), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const storyImageUrl = req.file ? await saveUploadedFile(req.file) : "";

    const story = await Story.create({
      userId: user._id.toString(),
      name: user.name,
      username: user.username,
      avatar: avatarToUrl(user.avatar),
      text: req.body.text || "",
      image: storyImageUrl,
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
      return {
        ...story,
        userId: toIdString(story.userId),
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
