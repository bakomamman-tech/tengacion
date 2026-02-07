const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const {
  addComment,
  replyToComment,
  toggleCommentLike,
} = require("../controllers/commentController");

router.post("/:postId", auth, addComment);
router.post("/:postId/:commentId/reply", auth, replyToComment);
router.post("/:postId/:commentId/like", auth, toggleCommentLike);

module.exports = router;
