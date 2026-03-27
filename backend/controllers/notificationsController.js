const Notification = require("../models/Notification");
const User = require("../models/User");
const { buildExpiryDate, notificationReadRetentionDays } = require("../config/storage");
const asyncHandler = require("../middleware/asyncHandler");
const paginate = require("../utils/paginate");

const getUnreadCountForUser = (userId) =>
  Notification.countDocuments({
    recipient: userId,
    read: false,
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: { $exists: false } },
    ],
  });

/**
 * @desc    Get logged-in user's notifications (paginated)
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const now = new Date();

  const activeExpiryFilter = {
    $or: [
      { expiresAt: { $gt: now } },
      { expiresAt: { $exists: false } },
    ],
  };
  const query = { recipient: req.user.id, ...activeExpiryFilter };
  const unreadQuery = { recipient: req.user.id, read: false, ...activeExpiryFilter };

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sender", "_id name username avatar")
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments(unreadQuery),
  ]);

  res.json({
    success: true,
    data: items,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * @desc    Mark a single notification as read
 * @route   POST /api/notifications/:id/read
 * @access  Private
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    {
      _id: req.params.id,
      recipient: req.user.id,
    },
    {
      read: true,
      readAt: new Date(),
      expiresAt: buildExpiryDate({
        createdAt: new Date(),
        retentionDays: notificationReadRetentionDays,
      }),
    },
    { new: true }
  ).populate("sender", "_id name username avatar");

  if (!notification) {
    res.status(404);
    throw new Error("Notification not found");
  }

  const unreadCount = await getUnreadCountForUser(req.user.id);

  res.json({
    success: true,
    data: notification,
    unreadCount,
  });
});

/**
 * @desc    Mark all notifications as read
 * @route   POST /api/notifications/read-all
 * @access  Private
 */
exports.markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user.id, read: false },
    {
      read: true,
      readAt: new Date(),
      expiresAt: buildExpiryDate({
        createdAt: new Date(),
        retentionDays: notificationReadRetentionDays,
      }),
    }
  );

  res.json({
    success: true,
    message: "All notifications marked as read",
    unreadCount: 0,
  });
});

/**
 * @desc    Get unread notifications count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await getUnreadCountForUser(req.user.id);

  res.json({
    success: true,
    unreadCount,
  });
});

exports.getNotificationPrefs = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("notificationPrefs");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  res.json({
    success: true,
    notificationPrefs: user.notificationPrefs || {},
  });
});

exports.updateNotificationPrefs = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("notificationPrefs");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const allowed = ["likes", "comments", "follows", "mentions", "messages", "reports", "system"];
  const patch = req.body && typeof req.body === "object" ? req.body : {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      user.notificationPrefs[key] = Boolean(patch[key]);
    }
  }
  await user.save();
  res.json({
    success: true,
    notificationPrefs: user.notificationPrefs,
  });
});
