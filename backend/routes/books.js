const express = require("express");
const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const optionalAuth = require("../middleware/optionalAuth");
const upload = require("../utils/upload");
const {
  createBook,
  createChapter,
  getBookById,
  getBookChapters,
  getBookChapterById,
} = require("../controllers/booksController");

const router = express.Router();

router.post(
  "/",
  auth,
  creatorAuth,
  upload.fields([
    { name: "cover", maxCount: 1 },
    { name: "content", maxCount: 1 },
  ]),
  createBook
);
router.post("/:bookId/chapters", auth, creatorAuth, createChapter);

router.get("/:bookId", optionalAuth, getBookById);
router.get("/:bookId/chapters", optionalAuth, getBookChapters);
router.get("/:bookId/chapters/:chapterId", optionalAuth, getBookChapterById);

module.exports = router;
