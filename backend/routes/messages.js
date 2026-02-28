const express = require("express");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const upload = require("../utils/upload");
const auth = require("../middleware/auth");
const { persistChatMessage } = require("../services/chatService");
const { createNotification } = require("../services/notificationService");
const {
  toIdString,
  avatarToUrl,
  buildConversationId,
  normalizeMessage,
} = require("../utils/messagePayload");

const router = express.Router();

const toAttachmentType = (mimetype = "") => {
  const type = String(mimetype).toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "file";
};

router.post("/upload", auth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  return res.json({
    url: `/uploads/${req.file.filename}`,
    type: toAttachmentType(req.file.mimetype),
    name: req.file.originalname || req.file.filename,
    size: Number(req.file.size) || 0,
  });
});

router.post("/share/followers", auth, async (req, res) => {
  try {
    const senderId = req.user.id;
    const me = await User.findById(senderId).select("followers");
    if (!me) {
      return res.status(404).json({ error: "User not found" });
    }

    const followerIds = (me.followers || [])
      .map((id) => toIdString(id))
      .filter((id) => id && id !== toIdString(senderId));

    if (followerIds.length === 0) {
      return res.json({ success: true, sent: 0 });
    }

    const payload = {
      text: req.body?.text,
      type: req.body?.type,
      metadata: req.body?.metadata,
      attachments: req.body?.attachments,
      clientId: "",
    };

    let sent = 0;
    for (const followerId of followerIds) {
      try {
        const result = await persistChatMessage({
          senderId,
          receiverId: followerId,
          payload: {
            ...payload,
            clientId: `follower_share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          },
        });

        const io = req.app.get("io");
        if (io) {
          io.to(toIdString(senderId)).to(toIdString(followerId)).emit("newMessage", result.message);
        }

        if (!result.existed) {
          const previewText =
            result.message.type === "contentCard"
              ? `shared: ${result.message.metadata?.title || result.message.metadata?.itemType || "content"}`
              : String(result.message.text || "").slice(0, 120);

          await createNotification({
            recipient: followerId,
            sender: senderId,
            type: "message",
            text: "shared something with you",
            entity: {
              id: result.message._id,
              model: "Message",
            },
            metadata: {
              previewText,
              link: "/home",
            },
            io: req.app.get("io"),
            onlineUsers: req.app.get("onlineUsers"),
          });
        }
        sent += 1;
      } catch {
        // Skip failed recipients and continue.
      }
    }

    return res.json({ success: true, sent });
  } catch (err) {
    console.error("Share to followers error:", err);
    return res.status(500).json({ error: "Failed to share to followers" });
  }
});

/*
  Chat contacts for logged-in user (friends + latest message)
*/
router.get("/contacts", auth, async (req, res) => {
  try {
    const meId = req.user.id;
    const me = await User.findById(meId).select("friends");

    if (!me) {
      return res.status(404).json({ error: "User not found" });
    }

    const friendIds = (me.friends || []).map((id) => id.toString());
    const contactQuery =
      friendIds.length > 0
        ? { _id: { $in: friendIds } }
        : { _id: { $ne: meId } };

    const contacts = await User.find(contactQuery, "_id name username avatar")
      .sort({ name: 1 })
      .limit(40)
      .lean();

    if (contacts.length === 0) {
      return res.json([]);
    }

    const meObjectId = new mongoose.Types.ObjectId(meId);
    const peerIds = contacts.map((user) => toIdString(user._id));
    const friendObjectIds = peerIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const latestMessages = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: meObjectId, receiverId: { $in: friendObjectIds } },
            { receiverId: meObjectId, senderId: { $in: friendObjectIds } },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversationId",
          message: { $first: "$$ROOT" },
        },
      },
    ]);

    const latestByUserId = new Map();
    for (const row of latestMessages) {
      const msg = row.message;
      const senderId = toIdString(msg.senderId);
      const receiverId = toIdString(msg.receiverId);
      const otherId = senderId === meId ? receiverId : senderId;
      const preview =
        msg.type === "contentCard"
          ? `shared: ${msg.metadata?.title || msg.metadata?.itemType || "content"}`
          : msg.text;
      latestByUserId.set(otherId, {
        text: preview,
        time: msg.time || new Date(msg.createdAt).getTime(),
      });
    }

    const onlineUsers = req.app.get("onlineUsers");

    const payload = contacts
      .map((user) => {
        const id = toIdString(user._id);
        const latest = latestByUserId.get(id) || null;
        return {
          _id: id,
          name: user.name,
          username: user.username,
          avatar: avatarToUrl(user.avatar),
          lastMessage: latest?.text || "",
          lastMessageAt: latest?.time || 0,
          online: onlineUsers ? onlineUsers.has(id) : false,
        };
      })
      .sort((a, b) => {
        if (a.lastMessageAt !== b.lastMessageAt) {
          return b.lastMessageAt - a.lastMessageAt;
        }
        return a.name.localeCompare(b.name);
      });

    res.json(payload);
  } catch (err) {
    console.error("Load contacts error:", err);
    res.status(500).json({ error: "Failed to load contacts" });
  }
});

/*
  Get all messages between me and another user
*/
router.get("/:otherUserId", auth, async (req, res) => {
  try {
    const me = req.user.id;
    const other = req.params.otherUserId;

    if (!mongoose.Types.ObjectId.isValid(other)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const conversationId = buildConversationId(me, other);
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .populate("senderId", "name username avatar")
      .lean();

    res.json(messages.map(normalizeMessage));
  } catch (err) {
    console.error("Load messages error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

/*
  Send message via REST fallback (socket remains primary)
  Supports text and contentCard payloads.
*/
router.post("/:otherUserId", auth, async (req, res) => {
  try {
    const me = req.user.id;
    const other = req.params.otherUserId;

    if (!mongoose.Types.ObjectId.isValid(other)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    let result;
    try {
      result = await persistChatMessage({
        senderId: me,
        receiverId: other,
        payload: {
          text: req.body?.text,
          type: req.body?.type,
          metadata: req.body?.metadata,
          attachments: req.body?.attachments,
          clientId: req.body?.clientId,
        },
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || "Invalid message payload" });
    }

    const payload = result.message;

    const io = req.app.get("io");
    if (io) {
      io.to(toIdString(me)).to(toIdString(other)).emit("newMessage", payload);
    }

    if (!result.existed) {
      const previewText =
        payload.type === "contentCard"
          ? `shared: ${payload.metadata?.title || payload.metadata?.itemType || "content"}`
          : String(payload.text || "").slice(0, 120);

      await createNotification({
        recipient: other,
        sender: me,
        type: "message",
        text: "sent you a message",
        entity: {
          id: payload._id,
          model: "Message",
        },
        metadata: {
          previewText,
          link: "/home",
        },
        io: req.app.get("io"),
        onlineUsers: req.app.get("onlineUsers"),
      });
    }

    res.status(result.existed ? 200 : 201).json(payload);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

module.exports = router;
