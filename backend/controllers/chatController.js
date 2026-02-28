const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const { persistChatMessage } = require("../services/chatService");
const { createNotification } = require("../services/notificationService");

exports.sendChatMessage = asyncHandler(async (req, res) => {
  const senderId = req.user.id;
  const receiverId = String(req.body?.receiverId || "").trim();

  if (!mongoose.Types.ObjectId.isValid(receiverId)) {
    return res.status(400).json({ error: "Invalid receiver id" });
  }

  let result;
  try {
    result = await persistChatMessage({
      senderId,
      receiverId,
      payload: {
        text: req.body?.text,
        type: req.body?.type,
        metadata: req.body?.metadata,
        attachments: req.body?.attachments,
        clientId: req.body?.clientId,
      },
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to send message" });
  }

  const io = req.app.get("io");
  const onlineUsers = req.app.get("onlineUsers");

  if (io) {
    io.to(senderId).to(receiverId).emit("newMessage", result.message);
  }

  const previewText =
    result.message.type === "contentCard"
      ? `shared: ${result.message.metadata?.title || result.message.metadata?.itemType || "content"}`
      : String(result.message.text || "").slice(0, 120);

  await createNotification({
    recipient: receiverId,
    sender: senderId,
    type: "message",
    text: "sent you a message",
    entity: {
      id: result.message._id,
      model: "Message",
    },
    metadata: {
      previewText,
      link: "/home",
    },
    io,
    onlineUsers,
  });

  return res.status(result.existed ? 200 : 201).json(result.message);
});
