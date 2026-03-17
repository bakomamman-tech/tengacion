const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const Book = require("../models/Book");
const Chapter = require("../models/Chapter");
const CreatorProfile = require("../models/CreatorProfile");
const { saveUploadedFile } = require("../services/mediaStore");
const { hasEntitlement } = require("../services/entitlementService");
const { logAnalyticsEvent } = require("../services/analyticsService");
const { evaluateVerification } = require("../services/contentVerificationService");
const { creatorHasCategory } = require("../services/creatorProfileService");

// TODO(phase2): add audiobook media support alongside chapter text content.

const toBookPayload = (book) => ({
  _id: book._id.toString(),
  creatorId:
    book.creatorId?._id?.toString() ||
    book.creatorId?.toString() ||
    "",
  title: book.title || "",
  authorName: book.authorName || "",
  subtitle: book.subtitle || "",
  description: book.description || "",
  price: Number(book.price) || 0,
  genre: book.genre || "",
  language: book.language || "",
  pageCount: Number(book.pageCount || 0),
  isbn: book.isbn || "",
  edition: book.edition || "",
  audience: book.audience || "",
  readingAge: book.readingAge || "",
  tableOfContents: book.tableOfContents || "",
  tags: Array.isArray(book.tags) ? book.tags : [],
  coverImageUrl: book.coverImageUrl || "",
  contentUrl: book.contentUrl || "",
  previewUrl: book.previewUrl || "",
  fileFormat: book.fileFormat || "",
  previewExcerptText: book.previewExcerptText || "",
  copyrightDeclared: Boolean(book.copyrightDeclared),
  createdAt: book.createdAt,
  updatedAt: book.updatedAt,
  publishedStatus: book.publishedStatus || (book.isPublished ? "published" : "draft"),
  copyrightScanStatus: book.copyrightScanStatus || "pending_scan",
  verificationNotes: book.verificationNotes || "",
  reviewRequired: Boolean(book.reviewRequired),
  creatorCategory: "books",
  contentType: book.contentType || "ebook",
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

const resolveRequestedStatus = (body = {}) => {
  const value = String(
    body?.publishedStatus || body?.publishMode || body?.status || ""
  )
    .trim()
    .toLowerCase();
  if (value === "draft" || body?.saveAsDraft === true || body?.saveAsDraft === "true") {
    return "draft";
  }
  return "published";
};

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
  if (!creatorHasCategory(req.creatorProfile, "books")) {
    return res.status(403).json({ error: "Books publishing is not enabled on this creator profile" });
  }

  const title = String(req.body?.title || "").trim();
  const description = String(req.body?.description || "").trim();
  let coverImageUrl = String(req.body?.coverImageUrl || "").trim();
  let contentUrl = String(req.body?.contentUrl || req.body?.fileUrl || "").trim();
  let previewUrl = String(req.body?.previewUrl || "").trim();
  const price = Number(req.body?.price);
  const genre = String(req.body?.genre || "").trim();
  const language = String(req.body?.language || "").trim();
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags
    : String(req.body?.tags || "")
        .split(",")
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .slice(0, 12);
  const fileFormat = String(req.body?.fileFormat || "").trim().toLowerCase();
  const previewExcerptText = String(req.body?.previewExcerptText || req.body?.previewExcerpt || "").trim();
  const requestedStatus = resolveRequestedStatus(req.body);
  const coverFile = req.files?.cover?.[0] || null;
  const contentFile = req.files?.content?.[0] || null;
  const previewFile = req.files?.preview?.[0] || null;

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
  if (previewFile) {
    previewUrl = await saveUploadedFile(previewFile);
  }

  if (!contentUrl) {
    return res.status(400).json({ error: "content URL or upload is required" });
  }

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory: "books",
    contentType: fileFormat === "pdf" ? "pdf_book" : "ebook",
    requestedStatus,
    title,
    description,
    primaryFile: contentFile || null,
    metadata: {
      creatorId: req.creatorProfile._id?.toString?.() || "",
      authorName: req.creatorProfile.displayName || "",
      genre,
      language,
      fileFormat,
    },
  });

  const book = await Book.create({
    creatorId: req.creatorProfile._id,
    title,
    description,
    coverImageUrl,
    contentUrl,
    previewUrl,
    price,
    genre,
    language,
    tags,
    fileFormat,
    previewExcerptText,
    contentType: fileFormat === "pdf" ? "pdf_book" : "ebook",
    publishedStatus: verification.publishedStatus,
    copyrightScanStatus: verification.scanStatus,
    verificationNotes: verification.verificationNotes,
    reviewRequired: verification.reviewRequired,
    contentFingerprintHash: verification.contentFingerprintHash,
    contentFileHash: verification.contentFileHash,
    isPublished: verification.publishedStatus === "published",
    archivedAt: null,
  });

  const hydrated = await Book.findById(book._id)
    .populate({
      path: "creatorId",
      select: "displayName userId",
      populate: { path: "userId", select: "username" },
    })
    .lean();

  await logAnalyticsEvent({
    type: "book_uploaded",
    userId: req.user.id,
    actorRole: req.user.role,
    targetId: book._id,
    targetType: "book",
    contentType: "book",
    metadata: {
      creatorId: req.creatorProfile._id.toString(),
      price: Number(book.price || 0),
      title: book.title || "",
    },
  }).catch(() => null);

  return res.status(201).json(toBookPayload(hydrated));
});

exports.updateBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ error: "Invalid book id" });
  }
  if (!creatorHasCategory(req.creatorProfile, "books")) {
    return res.status(403).json({ error: "Books publishing is not enabled on this creator profile" });
  }

  const book = await Book.findById(bookId);
  if (!book || String(book.creatorId) !== String(req.creatorProfile._id)) {
    return res.status(404).json({ error: "Book not found" });
  }

  const title = String(req.body?.title || book.title || "").trim();
  const description = String(req.body?.description || book.description || "").trim();
  const genre = String(req.body?.genre || book.genre || "").trim();
  const language = String(req.body?.language || book.language || "").trim();
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags
    : String(req.body?.tags || book.tags || "")
        .split(",")
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .slice(0, 12);
  const fileFormat = String(req.body?.fileFormat || book.fileFormat || "").trim().toLowerCase();
  const previewExcerptText = String(
    req.body?.previewExcerptText || req.body?.previewExcerpt || book.previewExcerptText || ""
  ).trim();
  const price = Number(req.body?.price ?? book.price ?? 0);
  const requestedStatus = resolveRequestedStatus(req.body);

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "price must be a valid non-negative number" });
  }

  let coverImageUrl = String(req.body?.coverImageUrl || book.coverImageUrl || "").trim();
  let contentUrl = String(req.body?.contentUrl || req.body?.fileUrl || book.contentUrl || book.fileUrl || "").trim();
  let previewUrl = String(req.body?.previewUrl || book.previewUrl || "").trim();
  const coverFile = req.files?.cover?.[0] || null;
  const contentFile = req.files?.content?.[0] || null;
  const previewFile = req.files?.preview?.[0] || null;

  if (coverFile) {
    coverImageUrl = await saveUploadedFile(coverFile);
  }
  if (contentFile) {
    contentUrl = await saveUploadedFile(contentFile);
  }
  if (previewFile) {
    previewUrl = await saveUploadedFile(previewFile);
  }
  if (!contentUrl) {
    return res.status(400).json({ error: "content URL or upload is required" });
  }

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory: "books",
    contentType: fileFormat === "pdf" ? "pdf_book" : "ebook",
    requestedStatus,
    title,
    description,
    primaryFile: contentFile || null,
    metadata: {
      creatorId: req.creatorProfile._id?.toString?.() || "",
      authorName: req.creatorProfile.displayName || "",
      genre,
      language,
      fileFormat,
    },
  });

  book.title = title;
  book.description = description;
  book.genre = genre;
  book.language = language;
  book.tags = tags;
  book.fileFormat = fileFormat;
  book.previewExcerptText = previewExcerptText;
  book.coverImageUrl = coverImageUrl;
  book.contentUrl = contentUrl;
  book.previewUrl = previewUrl;
  book.price = price;
  book.contentType = fileFormat === "pdf" ? "pdf_book" : "ebook";
  book.publishedStatus = verification.publishedStatus;
  book.copyrightScanStatus = verification.scanStatus;
  book.verificationNotes = verification.verificationNotes;
  book.reviewRequired = verification.reviewRequired;
  book.contentFingerprintHash = verification.contentFingerprintHash;
  if (verification.contentFileHash) {
    book.contentFileHash = verification.contentFileHash;
  }
  book.isPublished = verification.publishedStatus === "published";

  await book.save();

  const hydrated = await Book.findById(book._id)
    .populate({
      path: "creatorId",
      select: "displayName userId",
      populate: { path: "userId", select: "username" },
    })
    .lean();

  return res.json(toBookPayload(hydrated));
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

  const book = await Book.findOne({ _id: bookId, isPublished: { $ne: false }, archivedAt: null })
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

  const book = await Book.findOne({ _id: bookId, isPublished: { $ne: false }, archivedAt: null })
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
    Book.findOne({ _id: bookId, isPublished: { $ne: false }, archivedAt: null }).populate("creatorId", "userId").lean(),
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
