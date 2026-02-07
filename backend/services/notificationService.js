const Notification = require("../models/Notification");

/**
 * Create a notification (DB + realtime)
 */
exports.createNotification = async ({
  recipient,
  sender,
  type,
  text = "",
  entity = null,
  metadata = {},
  io = null,
  onlineUsers = null,
}) => {
  try {
    // Prevent self-notifications
    if (recipient.toString() === sender.toString()) return null;

    const notification = await Notification.create({
      recipient,
      sender,
      type,
      text,
      entity,
      metadata,
    });

    // 🔔 Realtime delivery
    if (io && onlineUsers) {
      const socketId = onlineUsers.get(recipient.toString());
      if (socketId) {
        io.to(socketId).emit("notification", notification);
      }
    }

    return notification;
  } catch (err) {
    console.error("createNotification error:", err);
    return null;
  }
};
