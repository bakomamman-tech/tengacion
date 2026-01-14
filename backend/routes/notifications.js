const express = require("express");
const jwt = require("jsonwebtoken");
const Notification = require("../models/Notification");

const router = express.Router();

function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/* GET MY NOTIFICATIONS */
router.get("/", auth, async (req, res) => {
  const notes = await Notification.find({ userId: req.userId }).sort({ time: -1 });
  res.json(notes);
});

/* MARK AS READ */
router.post("/:id/read", auth, async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { read: true });
  res.json({ success: true });
});

module.exports = router;
