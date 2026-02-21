const Notification = require("../models/Notification");
const asyncHandler = require("../middleware/asyncHandler");
const paginate = require("../utils/paginate");

/**
 * @desc    Get logged-in user's notifications (paginated)
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);

  const query = { recipient: req.user.id };
  const unreadQuery = { recipient: req.user.id, read: false };

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
    { read: true },
    { new: true }
  ).populate("sender", "_id name username avatar");

  if (!notification) {
    res.status(404);
    throw new Error("Notification not found");
  }

  res.json({
    success: true,
    data: notification,
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
    { read: true }
  );

  res.json({
    success: true,
    message: "All notifications marked as read",
  });
});

/**
 * @desc    Get unread notifications count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await Notification.countDocuments({
    recipient: req.user.id,
    read: false,
  });

  res.json({
    success: true,
    unreadCount,
  });
});
