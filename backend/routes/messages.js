const express = require("express");
const Message = require("../models/Message");
const jwt = require("jsonwebtoken");

const router = express.Router();

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

/*
  Get all messages between me and another user
*/
router.get("/:otherUserId", auth, async (req, res) => {
  try {
    const me = req.userId;
    const other = req.params.otherUserId;
    const conversationId = [me, other].sort().join("_");

    const messages = await Message.find({ conversationId }).sort({ time: 1 });
    res.json(messages);
  } catch (err) {
    console.error("Load messages error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

module.exports = router;
