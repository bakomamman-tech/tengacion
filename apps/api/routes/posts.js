const express = require("express");
const router = express.Router();
const auth = require("../../../backend/middleware/auth");
const upload = require("../../../backend/utils/upload");
const postController = require("../controllers/postController");
const optionalAuth = require("../middleware/optionalAuth");

router.post(
  "/",
  auth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  postController.createPost
);
router.get("/", optionalAuth, postController.getFeed);
router.get("/user/:username", auth, postController.getUserPosts);
router.put("/:id", auth, postController.updatePost);
router.delete("/:id", auth, postController.deletePost);
router.post("/:id/like", auth, postController.toggleLike);
router.post("/:id/share", auth, postController.sharePost);
router.post("/:id/comment", auth, postController.addComment);

module.exports = router;
