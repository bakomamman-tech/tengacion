const express = require("express");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const upload = require("../utils/upload");
const Post = require("../models/Post");

const router = express.Router();

/* ================= AUTH ================= */

function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ================= MY PROFILE ================= */

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json(user);
  } catch {
    res.status(500).json({ error: "Failed to load profile" });
  }
});

/* ================= UPDATE PROFILE ================= */

router.put("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    const { bio, gender, pronouns, avatar, cover } = req.body;

    if (bio !== undefined) user.bio = bio;
    if (gender !== undefined) user.gender = gender;
    if (pronouns !== undefined) user.pronouns = pronouns;
    if (avatar !== undefined) user.avatar = avatar;
    if (cover !== undefined) user.cover = cover;

    await user.save();

    const safeUser = await User.findById(req.userId).select("-password");
    res.json(safeUser);
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/* ================= LIST USERS ================= */

router.get("/", auth, async (req, res) => {
  try {
    const users = await User.find().select("_id name username avatar");
    res.json(users);
  } catch {
    res.status(500).json({ error: "Failed to load users" });
  }
});

/* ================= SEND FRIEND REQUEST ================= */

router.post("/:id/request", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const user = await User.findById(req.params.id);

    if (!me || !user) return res.status(404).json({ error: "User not found" });

    if (
      !user.friendRequests.includes(me._id.toString()) &&
      !user.friends.includes(me._id.toString())
    ) {
      user.friendRequests.push(me._id.toString());
      await user.save();
    }

    res.json({ sent: true });
  } catch {
    res.status(500).json({ error: "Request failed" });
  }
});

/* ================= ACCEPT FRIEND REQUEST ================= */

router.post("/:id/accept", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const user = await User.findById(req.params.id);

    if (!me || !user) return res.status(404).json({ error: "User not found" });

    me.friendRequests = me.friendRequests.filter(id => id !== user._id.toString());

    if (!me.friends.includes(user._id.toString())) {
      me.friends.push(user._id.toString());
    }

    if (!user.friends.includes(me._id.toString())) {
      user.friends.push(me._id.toString());
    }

    await me.save();
    await user.save();

    res.json({ friends: true });
  } catch (err) {
    console.error("Accept error:", err);
    res.status(500).json({ error: "Accept failed" });
  }
});

/* ================= REJECT FRIEND REQUEST ================= */

router.post("/:id/reject", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);

    me.friendRequests = me.friendRequests.filter(id => id !== req.params.id);
    await me.save();

    res.json({ rejected: true });
  } catch {
    res.status(500).json({ error: "Reject failed" });
  }
});

/* ================= LIST FRIEND REQUESTS ================= */

router.get("/requests", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);

    const users = await User.find(
      { _id: { $in: me.friendRequests } },
      "name username avatar"
    );

    res.json(users);
  } catch {
    res.status(500).json({ error: "Failed to load requests" });
  }
});

router.post("/me/avatar", auth, upload.single("image"), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!req.file) return res.status(400).json({ error: "No image" });

    user.avatar = `/uploads/${req.file.filename}`;
    await user.save();

    // Create feed post
    await Post.create({
      userId: user._id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      text: "Updated profile picture",
      image: user.avatar,
      time: new Date(),
      likes: [],
      comments: []
    });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Avatar upload failed" });
  }
});

router.post("/me/cover", auth, upload.single("image"), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!req.file) return res.status(400).json({ error: "No image" });

    user.cover = `/uploads/${req.file.filename}`;
    await user.save();

    await Post.create({
      userId: user._id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      text: "Updated cover photo",
      image: user.cover,
      time: new Date(),
      likes: [],
      comments: []
    });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cover upload failed" });
  }
});

module.exports = router;
