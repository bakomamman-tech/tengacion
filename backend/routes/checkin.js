const express = require("express");
const auth = require("../middleware/auth");
const Post = require("../models/Post");
const User = require("../models/User");

const router = express.Router();

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

router.post("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const text = String(req.body?.text || "").trim().slice(0, 240);
    const now = new Date();
    const today = startOfDay(now);
    const last = user?.streaks?.checkIn?.lastCheckInAt
      ? startOfDay(new Date(user.streaks.checkIn.lastCheckInAt))
      : null;

    let count = Number(user?.streaks?.checkIn?.count) || 0;
    if (!last) {
      count = 1;
    } else {
      const daysDiff = Math.floor((today.getTime() - last.getTime()) / (24 * 60 * 60 * 1000));
      if (daysDiff === 0) {
        count = Math.max(1, count);
      } else if (daysDiff === 1) {
        count += 1;
      } else {
        count = 1;
      }
    }

    user.streaks = {
      ...(user.streaks || {}),
      checkIn: {
        count,
        lastCheckInAt: now,
      },
    };
    await user.save();

    const post = await Post.create({
      author: user._id,
      type: "checkin",
      text: text || `Checked in today. 🔥 ${count}-day streak`,
      visibility: "friends",
      privacy: "public",
    });

    return res.status(201).json({
      success: true,
      streak: user.streaks.checkIn,
      postId: post._id.toString(),
    });
  } catch (err) {
    console.error("Check-in failed:", err);
    return res.status(500).json({ error: "Failed to submit check-in" });
  }
});

module.exports = router;
