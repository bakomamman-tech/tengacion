const express = require("express");
const auth = require("../middleware/auth");
const User = require("../models/User");
const Post = require("../models/Post");
const Room = require("../models/Room");

const router = express.Router();

const sanitizeQuery = (value = "") => String(value || "").trim().slice(0, 80);
const normalizeAccountQuery = (value = "") => sanitizeQuery(value).replace(/^@+\s*/, "");

router.get("/", auth, async (req, res) => {
  try {
    const q = sanitizeQuery(req.query?.q);
    const accountQuery = normalizeAccountQuery(q);
    const type = String(req.query?.type || "users").toLowerCase();
    if (!q) return res.json({ type, data: [] });

    if (type === "users") {
      if (!accountQuery) {
        return res.json({ type, data: [] });
      }

      const users = await User.find(
        {
          $or: [
            { username: { $regex: accountQuery, $options: "i" } },
            { name: { $regex: accountQuery, $options: "i" } },
          ],
        },
        "_id name username avatar"
      )
        .limit(30)
        .lean();
      return res.json({ type, data: users });
    }

    if (type === "posts") {
      const posts = await Post.find(
        {
          $or: [
            { text: { $regex: q, $options: "i" } },
            { hashtags: sanitizeQuery(q).replace(/^#/, "").toLowerCase() },
          ],
          privacy: "public",
        },
        "_id text author hashtags createdAt"
      )
        .populate("author", "_id name username avatar")
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();
      return res.json({ type, data: posts });
    }

    if (type === "hashtags") {
      const normalized = q.replace(/^#/, "").toLowerCase();
      const hashtags = await Post.aggregate([
        { $unwind: "$hashtags" },
        { $match: { hashtags: { $regex: `^${normalized}`, $options: "i" } } },
        { $group: { _id: "$hashtags", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 25 },
      ]);
      return res.json({
        type,
        data: hashtags.map((row) => ({ tag: row._id, count: row.count })),
      });
    }

    if (type === "rooms") {
      const rooms = await Room.find(
        {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
          ],
        },
        "_id name description cover privacy members"
      )
        .limit(30)
        .lean();
      return res.json({
        type,
        data: rooms.map((room) => ({
          ...room,
          membersCount: Array.isArray(room.members) ? room.members.length : 0,
        })),
      });
    }

    return res.status(400).json({ error: "Invalid search type" });
  } catch (err) {
    console.error("Search failed:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

router.get("/trending/hashtags", auth, async (_req, res) => {
  try {
    const data = await Post.aggregate([
      { $unwind: "$hashtags" },
      { $group: { _id: "$hashtags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]);
    return res.json(data.map((row) => ({ tag: row._id, count: row.count })));
  } catch (err) {
    console.error("Trending hashtags failed:", err);
    return res.status(500).json({ error: "Failed to load trending hashtags" });
  }
});

router.get("/suggestions", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select("following friends interests").lean();
    if (!me) return res.status(404).json({ error: "User not found" });
    const excluded = [
      req.user.id,
      ...(me.following || []).map((id) => String(id)),
      ...(me.friends || []).map((id) => String(id)),
    ];
    const people = await User.find(
      { _id: { $nin: excluded } },
      "_id name username avatar"
    )
      .limit(10)
      .lean();
    const rooms = await Room.find({}, "_id name description cover members").limit(8).lean();
    const hashtags = await Post.aggregate([
      { $unwind: "$hashtags" },
      { $group: { _id: "$hashtags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);
    return res.json({
      people,
      rooms: rooms.map((row) => ({
        ...row,
        membersCount: Array.isArray(row.members) ? row.members.length : 0,
      })),
      hashtags: hashtags.map((row) => ({ tag: row._id, count: row.count })),
    });
  } catch (err) {
    console.error("Search suggestions failed:", err);
    return res.status(500).json({ error: "Failed to load suggestions" });
  }
});

module.exports = router;
