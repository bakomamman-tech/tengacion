const express = require("express");
const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const optionalAuth = require("../middleware/optionalAuth");
const {
  createBook,
  createChapter,
  getBookById,
  getBookChapters,
  getBookChapterById,
} = require("../controllers/booksController");

const router = express.Router();

router.post("/", auth, creatorAuth, createBook);
router.post("/:bookId/chapters", auth, creatorAuth, createChapter);

router.get("/:bookId", optionalAuth, getBookById);
router.get("/:bookId/chapters", optionalAuth, getBookChapters);
router.get("/:bookId/chapters/:chapterId", optionalAuth, getBookChapterById);

module.exports = router;
