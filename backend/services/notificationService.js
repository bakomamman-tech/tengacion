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

    const unreadCount = await Notification.countDocuments({
      recipient,
      read: false,
    });

    // Backward-compatible event + new payload event.
    if (io && onlineUsers) {
      const sockets = onlineUsers.get(recipient.toString());
      if (sockets instanceof Set && sockets.size > 0) {
        for (const socketId of sockets) {
          io.to(socketId).emit("notification", notification);
          io.to(socketId).emit("notifications:new", {
            notification,
            unreadCount,
          });
        }
      }
    }

    // Fallback room emit; socket auth joins users to their id room.
    if (io) {
      io.to(recipient.toString()).emit("notifications:new", {
        notification,
        unreadCount,
      });
    }

    return notification;
  } catch (err) {
    console.error("createNotification error:", err);
    return null;
  }
};
