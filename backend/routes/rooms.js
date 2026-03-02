const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const Room = require("../models/Room");
const RoomMessage = require("../models/RoomMessage");
const Post = require("../models/Post");

const router = express.Router();

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

router.post("/", auth, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim().slice(0, 120);
    if (!name) {
      return res.status(400).json({ error: "Room name is required" });
    }

    const room = await Room.create({
      name,
      description: String(req.body?.description || "").trim().slice(0, 1000),
      ownerId: req.user.id,
      admins: [req.user.id],
      members: [req.user.id],
      privacy: ["public", "private"].includes(String(req.body?.privacy || "").toLowerCase())
        ? String(req.body.privacy).toLowerCase()
        : "public",
    });

    return res.status(201).json(room);
  } catch (err) {
    console.error("Room create failed:", err);
    return res.status(500).json({ error: "Failed to create room" });
  }
});

router.get("/", auth, async (_req, res) => {
  try {
    const rooms = await Room.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json(rooms);
  } catch (err) {
    console.error("Room list failed:", err);
    return res.status(500).json({ error: "Failed to load rooms" });
  }
});

router.post("/:id/join", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.privacy === "private" && String(room.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ error: "Private room requires invite" });
    }
    room.members.addToSet(req.user.id);
    await room.save();
    return res.json({ success: true, roomId: room._id.toString() });
  } catch (err) {
    console.error("Room join failed:", err);
    return res.status(500).json({ error: "Failed to join room" });
  }
});

router.post("/:id/leave", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: "Room not found" });
    room.members.pull(req.user.id);
    await room.save();
    return res.json({ success: true, roomId: room._id.toString() });
  } catch (err) {
    console.error("Room leave failed:", err);
    return res.status(500).json({ error: "Failed to leave room" });
  }
});

router.get("/:id/feed", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const posts = await Post.find({ roomId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json(posts);
  } catch (err) {
    console.error("Room feed failed:", err);
    return res.status(500).json({ error: "Failed to load room feed" });
  }
});

router.get("/:id/messages", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const messages = await RoomMessage.find({ roomId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("senderId", "_id name username avatar")
      .lean();
    return res.json(messages.reverse());
  } catch (err) {
    console.error("Room messages failed:", err);
    return res.status(500).json({ error: "Failed to load room messages" });
  }
});

router.post("/:id/messages", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const text = String(req.body?.content || "").trim().slice(0, 2000);
    if (!text) return res.status(400).json({ error: "Message content is required" });
    const message = await RoomMessage.create({
      roomId: req.params.id,
      senderId: req.user.id,
      content: text,
    });
    const io = req.app.get("io");
    if (io) {
      io.to(`room:${req.params.id}`).emit("room:message", message);
    }
    return res.status(201).json(message);
  } catch (err) {
    console.error("Room message create failed:", err);
    return res.status(500).json({ error: "Failed to send room message" });
  }
});

module.exports = router;
