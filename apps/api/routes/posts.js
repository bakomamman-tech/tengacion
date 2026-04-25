const express = require("express");
const router = express.Router();
const auth = require("../../../backend/middleware/auth");
const upload = require("../../../backend/middleware/privateUpload");
const moderateUpload = require("../../../backend/middleware/moderateUpload");
const {
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
} = require("../../../backend/utils/memoryUpload");
const postController = require("../controllers/postController");
const optionalAuth = require("../middleware/optionalAuth");

const MAX_POST_MEDIA_FILES = 10;
const ALLOWED_POST_MEDIA_FIELDS = new Set(["media", "image", "file"]);
const ALLOWED_POST_MEDIA_MIME_TYPES = new Set([
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
]);

const toUploadedFiles = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return Object.values(value).flatMap((entry) =>
    (Array.isArray(entry) ? entry : [entry]).filter(Boolean)
  );
};

const validateCreatePostUploads = (req, res, next) => {
  try {
    const files = toUploadedFiles(req.files || req.file);

    const unexpectedField = files.find(
      (file) => !ALLOWED_POST_MEDIA_FIELDS.has(String(file?.fieldname || "").trim())
    );
    if (unexpectedField) {
      return res.status(400).json({
        message: "Unsupported upload field for posts. Use media, image, or file.",
      });
    }

    if (files.length > MAX_POST_MEDIA_FILES) {
      return res.status(400).json({
        message: "You can upload up to 10 photos or videos per post.",
      });
    }

    const unsupportedFile = files.find(
      (file) => !ALLOWED_POST_MEDIA_MIME_TYPES.has(String(file?.mimetype || "").toLowerCase())
    );
    if (unsupportedFile) {
      return res.status(400).json({
        message: "Only supported image and video files can be attached to a post.",
      });
    }

    req.files = files;
    return next();
  } catch (error) {
    return next(error);
  }
};

router.post(
  "/",
  auth,
  upload.any(),
  validateCreatePostUploads,
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
