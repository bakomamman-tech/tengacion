const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} = require("../controllers/notificationsController");

/**
 * GET /api/notifications
 * Get paginated notifications for logged-in user
 */
router.get("/", auth, getNotifications);

/**
 * GET /api/notifications/unread-count
 * Get unread notifications count
 */
router.get("/unread-count", auth, getUnreadCount);

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read
 */
router.post("/read-all", auth, markAllAsRead);

/**
 * POST /api/notifications/:id/read
 * Mark a single notification as read
 */
router.post("/:id/read", auth, markAsRead);

module.exports = router;
