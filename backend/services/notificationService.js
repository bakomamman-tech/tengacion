const Notification = require("../models/Notification");
const User = require("../models/User");
const {
  buildExpiryDate,
  notificationReadRetentionDays,
  notificationUnreadRetentionDays,
  sanitizePlainObject,
  truncate,
} = require("../config/storage");

const typeToPrefKey = {
  like: "likes",
  comment: "comments",
  reply: "comments",
  follow: "follows",
  mention: "mentions",
  tag: "mentions",
  message: "messages",
  report_update: "reports",
  system: "system",
};

const normalizeNotificationMetadata = (metadata = {}) => {
  const { dedupeKey: _dedupeKey, ...rest } = metadata || {};
  return sanitizePlainObject(rest, {
    maxDepth: 1,
    maxKeys: 8,
    maxStringLength: 400,
    maxArrayLength: 4,
  });
};

const buildNotificationDedupeKey = ({ recipient, sender, type, text, entity, metadata }) => {
  if (!metadata?.dedupeKey && !entity?.id) {
    return "";
  }

  const pieces = [
    String(type || "").trim().toLowerCase(),
    String(recipient || "").trim(),
    String(sender || "").trim(),
  ];

  if (entity?.id) {
    pieces.push(String(entity.id).trim());
  }

  if (metadata?.dedupeKey) {
    pieces.push(String(metadata.dedupeKey).trim());
  }

  return pieces.filter(Boolean).join(":").slice(0, 160);
};

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
    const recipientUser = await User.findById(recipient).select("notificationPrefs");
    if (!recipientUser) return null;
    const prefKey = typeToPrefKey[String(type || "").toLowerCase()] || "";
    if (prefKey && recipientUser?.notificationPrefs?.[prefKey] === false) {
      return null;
    }

    const normalizedType = String(type || "").trim().toLowerCase();
    const safeText = truncate(text, 500);
    const safeMetadata = normalizeNotificationMetadata(metadata);
    const dedupeKey = buildNotificationDedupeKey({
      recipient,
      sender,
      type: normalizedType,
      text: safeText,
      entity,
      metadata: safeMetadata,
    });
    const now = new Date();
    const unreadExpiresAt = buildExpiryDate({
      createdAt: now,
      retentionDays: notificationUnreadRetentionDays,
    });

    const existing = dedupeKey
      ? await Notification.findOne({ recipient, dedupeKey }).lean()
      : null;
    if (existing) {
      return Notification.findById(existing._id)
        .populate("sender", "_id name username avatar");
    }

    const notification = await Notification.create({
      recipient,
      sender,
      type: normalizedType,
      text: safeText,
      entity,
      metadata: safeMetadata,
      dedupeKey: dedupeKey || undefined,
      read: false,
      readAt: null,
      expiresAt: unreadExpiresAt,
    }).catch(async (err) => {
      if (err?.code === 11000 && dedupeKey) {
        return Notification.findOne({ recipient, dedupeKey });
      }
      throw err;
    });

    if (!notification) {
      return null;
    }

    const unreadCount = await Notification.countDocuments({
      recipient,
      read: false,
      expiresAt: { $gt: new Date() },
    });

    // Backward-compatible event + new payload event.
    if (io && onlineUsers) {
      const sockets = onlineUsers.get(recipient.toString());
      if (sockets instanceof Set && sockets.size > 0) {
        for (const socketId of sockets) {
          io.to(socketId).emit("notification", notification);
          io.to(socketId).emit("notification:new", { notification, unreadCount });
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
      io.to(recipient.toString()).emit("notification:new", {
        notification,
        unreadCount,
      });
      io.to(`user:${recipient.toString()}`).emit("notifications:new", {
        notification,
        unreadCount,
      });
      io.to(`user:${recipient.toString()}`).emit("notification:new", {
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
