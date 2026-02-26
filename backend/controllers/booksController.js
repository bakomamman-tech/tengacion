const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const Book = require("../models/Book");
const Chapter = require("../models/Chapter");
const CreatorProfile = require("../models/CreatorProfile");
const { saveUploadedFile } = require("../services/mediaStore");
const { hasEntitlement } = require("../services/entitlementService");

// TODO(phase2): add audiobook media support alongside chapter text content.

const toBookPayload = (book) => ({
  _id: book._id.toString(),
  creatorId:
    book.creatorId?._id?.toString() ||
    book.creatorId?.toString() ||
    "",
  title: book.title || "",
  description: book.description || "",
  price: Number(book.price) || 0,
  coverImageUrl: book.coverImageUrl || "",
  contentUrl: book.contentUrl || "",
  createdAt: book.createdAt,
  creator:
    book.creatorId && typeof book.creatorId === "object"
      ? {
          _id: book.creatorId._id?.toString() || "",
          displayName: book.creatorId.displayName || "",
          userId: book.creatorId.userId?._id?.toString() || book.creatorId.userId?.toString() || "",
          username: book.creatorId.userId?.username || "",
        }
      : null,
});

const canReadFullBook = async ({ book, userId }) => {
  if (!book) {
    return false;
  }

  if (Number(book.price) <= 0) {
    return true;
  }

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return false;
  }

  const creator =
    book.creatorId && typeof book.creatorId === "object" && book.creatorId.userId
      ? book.creatorId
      : await CreatorProfile.findById(book.creatorId).select("userId").lean();

  if (creator?.userId?.toString() === userId.toString()) {
    return true;
  }

  return hasEntitlement({
    userId,
    itemType: "book",
    itemId: book._id,
  });
};

exports.createBook = asyncHandler(async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const description = String(req.body?.description || "").trim();
  let coverImageUrl = String(req.body?.coverImageUrl || "").trim();
  let contentUrl = String(req.body?.contentUrl || req.body?.fileUrl || "").trim();
  const price = Number(req.body?.price);
  const coverFile = req.files?.cover?.[0] || null;
  const contentFile = req.files?.content?.[0] || null;

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "price must be a valid non-negative number" });
  }

  if (coverFile) {
    coverImageUrl = await saveUploadedFile(coverFile);
  }

  if (contentFile) {
    contentUrl = await saveUploadedFile(contentFile);
  }

  if (!contentUrl) {
    return res.status(400).json({ error: "content URL or upload is required" });
  }

  const book = await Book.create({
    creatorId: req.creatorProfile._id,
    title,
    description,
    coverImageUrl,
    contentUrl,
    price,
  });

  const hydrated = await Book.findById(book._id)
    .populate({
      path: "creatorId",
      select: "displayName userId",
      populate: { path: "userId", select: "username" },
    })
    .lean();

  return res.status(201).json(toBookPayload(hydrated));
});

exports.createChapter = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ error: "Invalid book id" });
  }

  const title = String(req.body?.title || "").trim();
  const content = String(req.body?.content || "");
  const order = Number(req.body?.order);
  const isFree = Boolean(req.body?.isFree);

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

  if (!content.trim()) {
    return res.status(400).json({ error: "content is required" });
  }

  if (!Number.isFinite(order) || order < 1) {
    return res.status(400).json({ error: "order must be a positive number" });
  }

  const book = await Book.findById(bookId).lean();
  if (!book) {
    return res.status(404).json({ error: "Book not found" });
  }

  if (book.creatorId.toString() !== req.creatorProfile._id.toString()) {
    return res.status(403).json({ error: "Cannot modify another creator's book" });
  }

  const chapter = await Chapter.findOneAndUpdate(
    { bookId, order },
    {
      $set: {
        title,
        content,
        order,
        isFree,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  return res.status(201).json({
    _id: chapter._id.toString(),
    bookId: chapter.bookId.toString(),
    title: chapter.title,
    order: chapter.order,
    isFree: chapter.isFree,
    createdAt: chapter.createdAt,
  });
});

exports.getBookById = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ error: "Invalid book id" });
  }

  const book = await Book.findById(bookId)
    .populate({
      path: "creatorId",
      select: "displayName userId",
      populate: { path: "userId", select: "username" },
    })
    .lean();

  if (!book) {
    return res.status(404).json({ error: "Book not found" });
  }

  const chapterCount = await Chapter.countDocuments({ bookId: book._id });
  const hasFullAccess = await canReadFullBook({
    book,
    userId: req.user?.id,
  });

  return res.json({
    ...toBookPayload(book),
    chapterCount,
    canReadFull: hasFullAccess,
    freeChaptersRecommended: 2,
  });
});

exports.getBookChapters = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ error: "Invalid book id" });
  }

  const book = await Book.findById(bookId)
    .populate("creatorId", "userId")
    .lean();
  if (!book) {
    return res.status(404).json({ error: "Book not found" });
  }

  const hasFullAccess = await canReadFullBook({
    book,
    userId: req.user?.id,
  });

  const chapters = await Chapter.find({ bookId }).sort({ order: 1 }).lean();
  return res.json(
    chapters.map((chapter) => {
      const locked = !hasFullAccess && !chapter.isFree;
      return {
        _id: chapter._id.toString(),
        title: chapter.title || "",
        order: Number(chapter.order) || 0,
        isFree: Boolean(chapter.isFree),
        locked,
        previewText: locked
          ? `${String(chapter.content || "").slice(0, 160)}...`
          : undefined,
      };
    })
  );
});

exports.getBookChapterById = asyncHandler(async (req, res) => {
  const { bookId, chapterId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bookId) || !mongoose.Types.ObjectId.isValid(chapterId)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const [book, chapter] = await Promise.all([
    Book.findById(bookId).populate("creatorId", "userId").lean(),
    Chapter.findOne({ _id: chapterId, bookId }).lean(),
  ]);

  if (!book) {
    return res.status(404).json({ error: "Book not found" });
  }
  if (!chapter) {
    return res.status(404).json({ error: "Chapter not found" });
  }

  const hasFullAccess = await canReadFullBook({
    book,
    userId: req.user?.id,
  });

  if (!hasFullAccess && !chapter.isFree) {
    return res.status(402).json({
      error: "Chapter is locked",
      paywall: true,
      itemType: "book",
      itemId: book._id.toString(),
      chapterId: chapter._id.toString(),
    });
  }

  return res.json({
    _id: chapter._id.toString(),
    bookId: chapter.bookId.toString(),
    title: chapter.title || "",
    order: Number(chapter.order) || 0,
    content: chapter.content || "",
    isFree: Boolean(chapter.isFree),
    locked: false,
  });
});
