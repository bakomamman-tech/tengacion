const express = require("express");
const jwt = require("jsonwebtoken");
const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");
const upload = require("../utils/upload");

const router = express.Router();

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

/* ================= CREATE POST ================= */

router.post("/", auth, upload.single("image"), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    const post = await Post.create({
      userId: user._id,
      name: user.name,
      username: user.username,
      avatar: user.avatar || "",
      text: req.body.text || "",
      image: req.file ? `/uploads/${req.file.filename}` : "",
      time: new Date().toISOString(),
      likes: [],
      comments: []
    });

    res.json(post);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

/* ================= FEED ================= */

router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    const ids = [
      user._id.toString(),
      ...(user.following || []).map((id) => id.toString())
    ];

    const posts = await Post.find({
      userId: { $in: ids }
    }).sort({ time: -1 });

    res.json(posts);
  } catch (err) {
    console.error("Feed error:", err);
    res.status(500).json({ error: "Failed to load feed" });
  }
});

/* ================= LIKE ================= */

router.post("/:id/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (!post.likes.includes(req.userId)) {
      post.likes.push(req.userId);

      // 🔔 notify post owner
      if (post.userId.toString() !== req.userId) {
        await Notification.create({
          userId: post.userId,
          fromId: req.userId,
          type: "like",
          text: "Someone liked your post"
        });
      }

      await post.save();
    }

    res.json(post);
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ error: "Failed to like post" });
  }
});

/* ================= COMMENT ================= */

router.post("/:id/comment", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    post.comments.push({
      userId: user._id,
      name: user.name,
      username: user.username,
      text: req.body.text
    });

    // 🔔 notify post owner
    if (post.userId.toString() !== req.userId) {
      await Notification.create({
        userId: post.userId,
        fromId: req.userId,
        type: "comment",
        text: `${user.username} commented on your post`
      });
    }

    await post.save();
    res.json(post);
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).json({ error: "Failed to comment" });
  }
});

module.exports = router;
