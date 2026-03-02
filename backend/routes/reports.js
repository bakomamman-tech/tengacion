const express = require("express");
let rateLimit;
try {
  rateLimit = require("express-rate-limit");
} catch {
  rateLimit = () => (_req, _res, next) => next();
}
const auth = require("../middleware/auth");
const Report = require("../models/Report");
const User = require("../models/User");
const Post = require("../models/Post");
const Message = require("../models/Message");
const UserStrike = require("../models/UserStrike");
const { incrementDailyMetric } = require("../services/analyticsService");

const router = express.Router();

const reportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reports submitted. Please try again later." },
});

const TARGET_TYPES = ["user", "post", "comment", "message"];
const REASONS = [
  "spam",
  "hate_speech",
  "violence",
  "harassment",
  "misinformation",
  "nudity",
  "other",
];

const STRIKE_RULES = {
  temporaryMute: 3,
  temporaryBan: 5,
  permanentBan: 7,
};

const toId = (value) => (value && value.toString ? value.toString() : "");

const resolveTarget = async ({ targetType, targetId }) => {
  if (targetType === "user") return User.findById(targetId);
  if (targetType === "post") return Post.findById(targetId);
  if (targetType === "message") return Message.findById(targetId);
  if (targetType === "comment") {
    const post = await Post.findOne({ "comments._id": targetId }).select("comments");
    return post?.comments?.find((entry) => toId(entry._id) === toId(targetId)) || null;
  }
  return null;
};

const resolveTargetOwnerId = async ({ targetType, targetId }) => {
  if (targetType === "user") return targetId;
  if (targetType === "post") {
    const post = await Post.findById(targetId).select("author");
    return toId(post?.author);
  }
  if (targetType === "message") {
    const message = await Message.findById(targetId).select("senderId");
    return toId(message?.senderId);
  }
  if (targetType === "comment") {
    const post = await Post.findOne({ "comments._id": targetId }).select("comments.author");
    const comment = post?.comments?.find((entry) => toId(entry._id) === toId(targetId));
    return toId(comment?.author);
  }
  return "";
};

router.post("/", auth, reportLimiter, async (req, res) => {
  try {
    const targetType = String(req.body?.targetType || "").toLowerCase();
    const targetId = String(req.body?.targetId || "");
    const reason = String(req.body?.reason || "").toLowerCase();
    const details = String(req.body?.details || "").trim().slice(0, 1200);

    if (!TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({ error: "Invalid targetType" });
    }
    if (!targetId) {
      return res.status(400).json({ error: "targetId is required" });
    }
    if (!reason || !REASONS.includes(reason)) {
      return res.status(400).json({ error: "Invalid report reason" });
    }

    const target = await resolveTarget({ targetType, targetId });
    if (!target) {
      return res.status(404).json({ error: "Target not found" });
    }

    const existing = await Report.findOne({
      reporterId: req.user.id,
      targetType,
      targetId,
      status: { $in: ["open", "reviewing"] },
    });
    if (existing) {
      return res.status(409).json({ error: "You already reported this content" });
    }

    const report = await Report.create({
      reporterId: req.user.id,
      targetType,
      targetId,
      reason,
      details,
      status: "open",
    });
    await incrementDailyMetric("reportsCount", 1).catch(() => null);
    return res.status(201).json({ success: true, report });
  } catch (err) {
    console.error("Report create failed:", err);
    return res.status(500).json({ error: "Failed to submit report" });
  }
});

router.post("/internal/apply-strike", auth, async (_req, res) => {
  return res.status(501).json({ error: "Not implemented here. Use admin moderation endpoints." });
});

const applyStrikes = async ({ userId, count, reason, reportId }) => {
  if (!userId || !count) return { strikeCount: 0, action: "" };
  const strike = await UserStrike.findOneAndUpdate(
    { userId },
    {
      $inc: { count: Number(count) || 1 },
      $push: { history: { reportId, count, reason, createdAt: new Date() } },
      $set: { lastActionAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const user = await User.findById(userId);
  if (!user) return { strikeCount: strike.count, action: "" };
  const total = Number(strike.count) || 0;
  let action = "";
  if (total >= STRIKE_RULES.permanentBan) {
    user.isBanned = true;
    user.isActive = false;
    action = "permanent_ban";
  } else if (total >= STRIKE_RULES.temporaryBan) {
    user.isBanned = true;
    user.banReason = "Temporary ban due to repeated violations";
    action = "temporary_ban";
  } else if (total >= STRIKE_RULES.temporaryMute) {
    user.forcePasswordReset = false;
    action = "temporary_mute";
  }
  await user.save();
  return { strikeCount: total, action };
};

router.applyStrikes = applyStrikes;

module.exports = router;
