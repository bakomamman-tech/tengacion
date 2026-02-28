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
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read
 */
router.patch("/mark-all-read", auth, markAllAsRead);
router.patch("/read-all", auth, markAllAsRead);
router.post("/read-all", auth, markAllAsRead);

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
router.patch("/:id/read", auth, markAsRead);
router.post("/:id/read", auth, markAsRead);

module.exports = router;
