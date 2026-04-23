const express = require("express");
const router = express.Router();
const auth = require("../../../backend/middleware/auth");
const upload = require("../../../backend/middleware/privateUpload");
const moderateUpload = require("../../../backend/middleware/moderateUpload");
const postController = require("../controllers/postController");
const optionalAuth = require("../middleware/optionalAuth");

router.post(
  "/",
  auth,
  upload.fields([
    { name: "image", maxCount: 8 },
    { name: "file", maxCount: 8 },
  ]),
  moderateUpload({
    sourceType: "post",
    titleFields: ["text", "title", "caption"],
    descriptionFields: ["text", "description", "caption"],
    deferDecisionResponse: true,
  }),
  postController.createPost
);
router.get("/", optionalAuth, postController.getFeed);
router.get("/user/:username", auth, postController.getUserPosts);
router.get("/:id", optionalAuth, postController.getPostById);
router.put("/:id", auth, postController.updatePost);
router.delete("/:id", auth, postController.deletePost);
router.post("/:id/like", auth, postController.toggleLike);
router.post("/:id/share", auth, postController.sharePost);
router.post("/:id/comment", auth, postController.addComment);
router.post("/:id/comments", auth, postController.addComment);
router.put("/:id/comments/:commentId", auth, postController.updateComment);
router.get("/:id/comments", optionalAuth, postController.getComments);
router.post("/:id/poll/vote", auth, postController.votePoll);
router.post("/:id/quiz/answer", auth, postController.answerQuiz);

module.exports = router;
