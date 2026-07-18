const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const Book = require("../models/Book");
const Chapter = require("../models/Chapter");
const CreatorProfile = require("../models/CreatorProfile");
const { deleteUploadedMediaBatch, saveUploadedMedia } = require("../services/mediaStore");
const { hasEntitlement } = require("../services/entitlementService");
const { logAnalyticsEvent } = require("../services/analyticsService");
const { evaluateVerification } = require("../services/contentVerificationService");
const { creatorHasCategory } = require("../services/creatorProfileService");
const { notifySavedContentUpdated } = require("../services/fanReturnPathService");
const { logCreatorUploadOnboardingMilestones } = require("../services/creatorOnboardingAnalyticsService");
const {
  buildBookPreviewEndpointUrl,
  canServeBookPreviewDocument,
  streamBookPreviewDocument,
} = require("../services/bookPreviewService");
const { cleanupReplacedMedia, mediaDocumentToUrl, toMediaDocument } = require("../utils/cloudinaryMedia");
const { createPublicModerationFilter } = require("../utils/publicModeration");

const PUBLIC_BOOK_FILTER = {
  isPublished: { $ne: false },
  archivedAt: null,
  ...createPublicModerationFilter(),
};

// Non-goal for the current book flow: audiobook media is handled through music/podcast uploads.
const BOOK_CHAPTER_ONE_PREVIEW_CHAR_LIMIT = 60000;

const collectBookMediaAssets = (book = {}) => [
  book?.coverMedia || book?.coverImageUrl,
  book?.contentMedia || book?.contentUrl || book?.fileUrl,
  book?.previewMedia || book?.previewUrl,
].filter(Boolean);

const toApprovalPayload = (content = {}) => {
  const publishedStatus = String(
    content.publishedStatus || (content.isPublished ? "published" : "draft")
  ).trim().toLowerCase();
  const approvalRequired = publishedStatus === "under_review";

  return {
    approvalRequired,
    message: approvalRequired
      ? "Submitted for Admin approval. This upload will go live after an Admin approves it."
      : publishedStatus === "draft"
        ? "Draft saved."
        : "",
  };
};

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
  chapterCount: Number(book.chapterCount || 0),
  isbn: book.isbn || "",
  edition: book.edition || "",
  audience: book.audience || "",
  readingAge: book.readingAge || "",
  tableOfContents: book.tableOfContents || "",
  tags: Array.isArray(book.tags) ? book.tags : [],
  coverImageUrl: mediaDocumentToUrl(book.coverMedia, book.coverImageUrl || ""),
  contentUrl: mediaDocumentToUrl(book.contentMedia, book.contentUrl || ""),
  previewUrl: mediaDocumentToUrl(book.previewMedia, book.previewUrl || ""),
  fileFormat: book.fileFormat || "",
  previewExcerptText: book.previewExcerptText || "",
  copyrightDeclared: Boolean(book.copyrightDeclared),
  createdAt: book.createdAt,
  updatedAt: book.updatedAt,
  publishedStatus: book.publishedStatus || (book.isPublished ? "published" : "draft"),
  copyrightScanStatus: book.copyrightScanStatus || "pending_scan",
  verificationNotes: book.verificationNotes || "",
  reviewRequired: Boolean(book.reviewRequired),
  ...toApprovalPayload(book),
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

const parseOptionalNonNegativeInteger = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const resolveChapterPreviewPage = (content = "") => {
  const normalized = String(content || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  const pageText = normalized;
  if (pageText.length <= BOOK_CHAPTER_ONE_PREVIEW_CHAR_LIMIT) {
    return pageText;
  }

  const hardCut = pageText.slice(0, BOOK_CHAPTER_ONE_PREVIEW_CHAR_LIMIT);
  const paragraphCut = hardCut.lastIndexOf("\n\n");
  const sentenceCut = Math.max(
    hardCut.lastIndexOf(". "),
    hardCut.lastIndexOf("! "),
    hardCut.lastIndexOf("? ")
  );
  const wordCut = hardCut.lastIndexOf(" ");
  const minCut = Math.floor(BOOK_CHAPTER_ONE_PREVIEW_CHAR_LIMIT * 0.62);
  const cutAt =
    paragraphCut >= minCut
      ? paragraphCut
      : sentenceCut >= minCut
        ? sentenceCut + 1
        : wordCut >= minCut
          ? wordCut
          : BOOK_CHAPTER_ONE_PREVIEW_CHAR_LIMIT;

  return `${pageText.slice(0, cutAt).trim()}...`;
};

const hasRequestedStatus = (body = {}) =>
  ["publishedStatus", "publishMode", "status", "saveAsDraft"].some((field) =>
    Object.prototype.hasOwnProperty.call(body || {}, field)
  );

const resolveRequestedStatus = (body = {}, { fallback = "published" } = {}) => {
  if (!hasRequestedStatus(body)) {
    const normalizedFallback = String(fallback || "published").trim().toLowerCase();
    return ["draft", "published", "under_review", "blocked"].includes(normalizedFallback)
      ? normalizedFallback
      : "published";
  }

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
    creatorId: book.creatorId?._id || book.creatorId,
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
  let coverMedia = null;
  let contentMedia = null;
  let previewMedia = null;
  const price = Number(req.body?.price);
  const genre = String(req.body?.genre || "").trim();
  const language = String(req.body?.language || "").trim();
  const chapterCount = parseOptionalNonNegativeInteger(req.body?.chapterCount);
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

  if (coverImageUrl && !coverFile) {
    return res.status(400).json({
      error: "Book covers must be uploaded through the moderated cover field",
    });
  }

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "price must be a valid non-negative number" });
  }

  if (coverFile) {
    coverMedia = await saveUploadedMedia(coverFile, {
      source: "book_cover",
      resourceType: "image",
    });
    coverImageUrl = mediaDocumentToUrl(coverMedia);
  }

  if (contentFile) {
    contentMedia = await saveUploadedMedia(contentFile, {
      source: "book_content",
      resourceType: "raw",
    });
    contentUrl = mediaDocumentToUrl(contentMedia);
  }
  if (previewFile) {
    previewMedia = await saveUploadedMedia(previewFile, {
      source: "book_preview",
      resourceType: "raw",
    });
    previewUrl = mediaDocumentToUrl(previewMedia);
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
    requireAdminApproval: true,
  });

  const book = await Book.create({
    creatorId: req.creatorProfile._id,
    title,
    description,
    coverImageUrl,
    coverMedia: coverMedia ? toMediaDocument(coverMedia) : null,
    contentUrl,
    contentMedia: contentMedia ? toMediaDocument(contentMedia) : null,
    previewUrl,
    previewMedia: previewMedia ? toMediaDocument(previewMedia) : null,
    price,
    genre,
    language,
    chapterCount,
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
  await logCreatorUploadOnboardingMilestones({
    userId: req.user.id,
    profile: req.creatorProfile,
    upload: book,
    source: "creator_book_upload",
    uploadContentType: "book",
    uploadTargetId: book._id,
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
  const chapterCountRequested = Object.prototype.hasOwnProperty.call(req.body || {}, "chapterCount");
  const chapterCount = chapterCountRequested
    ? parseOptionalNonNegativeInteger(req.body?.chapterCount)
    : book.chapterCount ?? null;
  const statusWasRequested = hasRequestedStatus(req.body);
  const requestedStatus = resolveRequestedStatus(req.body, {
    fallback: book.publishedStatus || (book.isPublished ? "published" : "draft"),
  });

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "price must be a valid non-negative number" });
  }

  let coverImageUrl = String(req.body?.coverImageUrl || book.coverImageUrl || "").trim();
  let contentUrl = String(req.body?.contentUrl || req.body?.fileUrl || book.contentUrl || book.fileUrl || "").trim();
  let previewUrl = String(req.body?.previewUrl || book.previewUrl || "").trim();
  let coverMedia = book.coverMedia || null;
  let contentMedia = book.contentMedia || null;
  let previewMedia = book.previewMedia || null;
  const previousCoverMedia = book.coverMedia || null;
  const previousContentMedia = book.contentMedia || null;
  const previousPreviewMedia = book.previewMedia || null;
  const coverFile = req.files?.cover?.[0] || null;
  const contentFile = req.files?.content?.[0] || null;
  const previewFile = req.files?.preview?.[0] || null;

  if (
    Object.prototype.hasOwnProperty.call(req.body || {}, "coverImageUrl")
    && coverImageUrl !== String(book.coverImageUrl || "").trim()
    && !coverFile
  ) {
    return res.status(400).json({
      error: "Book cover changes must use the moderated cover upload field",
    });
  }

  if (coverFile) {
    const uploadedCover = await saveUploadedMedia(coverFile, {
      source: "book_cover",
      resourceType: "image",
    });
    coverMedia = toMediaDocument(uploadedCover);
    coverImageUrl = mediaDocumentToUrl(uploadedCover);
  }
  if (contentFile) {
    const uploadedContent = await saveUploadedMedia(contentFile, {
      source: "book_content",
      resourceType: "raw",
    });
    contentMedia = toMediaDocument(uploadedContent);
    contentUrl = mediaDocumentToUrl(uploadedContent);
  }
  if (previewFile) {
    const uploadedPreview = await saveUploadedMedia(previewFile, {
      source: "book_preview",
      resourceType: "raw",
    });
    previewMedia = toMediaDocument(uploadedPreview);
    previewUrl = mediaDocumentToUrl(uploadedPreview);
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
    excludeContentId: book._id,
    metadata: {
      creatorId: req.creatorProfile._id?.toString?.() || "",
      authorName: req.creatorProfile.displayName || "",
      genre,
      language,
      fileFormat,
    },
    requireAdminApproval: statusWasRequested
      ? requestedStatus === "published"
      : requestedStatus === "under_review",
  });

  book.title = title;
  book.description = description;
  book.genre = genre;
  book.language = language;
  book.chapterCount = chapterCount;
  book.tags = tags;
  book.fileFormat = fileFormat;
  book.previewExcerptText = previewExcerptText;
  book.coverImageUrl = coverImageUrl;
  book.coverMedia = coverMedia;
  book.contentUrl = contentUrl;
  book.contentMedia = contentMedia;
  book.previewUrl = previewUrl;
  book.previewMedia = previewMedia;
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
  if (book.publishedStatus === "published") {
    await notifySavedContentUpdated({
      req,
      creatorProfile: req.creatorProfile,
      itemType: "book",
      itemId: book._id,
      title: book.title,
      reason: "metadata_updated",
    }).catch(() => null);
  }
  await Promise.all([
    coverFile ? cleanupReplacedMedia(previousCoverMedia, book.coverMedia) : Promise.resolve(false),
    contentFile ? cleanupReplacedMedia(previousContentMedia, book.contentMedia) : Promise.resolve(false),
    previewFile ? cleanupReplacedMedia(previousPreviewMedia, book.previewMedia) : Promise.resolve(false),
  ]).catch(() => null);

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
      returnDocument: "after",
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

  const book = await Book.findOne({ _id: bookId, ...PUBLIC_BOOK_FILTER })
    .populate({
      path: "creatorId",
      select: "displayName userId",
      populate: { path: "userId", select: "username" },
    })
    .lean();

  if (!book) {
    return res.status(404).json({ error: "Book not found" });
  }

  const savedChapterCount = Number(book.chapterCount || 0);
  const uploadedChapterCount = await Chapter.countDocuments({ bookId: book._id });
  const hasFullAccess = await canReadFullBook({
    book,
    userId: req.user?.id,
  });

  const payload = toBookPayload(book);
  if (!hasFullAccess) {
    payload.contentUrl = "";
    payload.fileUrl = "";
  }
  if (canServeBookPreviewDocument(book)) {
    payload.previewUrl = buildBookPreviewEndpointUrl({ req, bookId: book._id.toString() });
  }

  return res.json({
    ...payload,
    chapterCount: uploadedChapterCount || savedChapterCount,
    canReadFull: hasFullAccess,
    freeChaptersRecommended: 0,
    previewPagesRecommended: 24,
  });
});

exports.getBookPreviewDocument = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ error: "Invalid book id" });
  }

  const book = await Book.findOne({ _id: bookId, ...PUBLIC_BOOK_FILTER }).lean();
  if (!book) {
    return res.status(404).json({ error: "Book not found" });
  }

  const streamed = await streamBookPreviewDocument({
    req,
    res,
    book,
    headOnly: req.method === "HEAD",
  });

  if (!streamed && !res.headersSent) {
    return res.status(404).json({ error: "Book preview unavailable" });
  }
});

exports.getBookChapters = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ error: "Invalid book id" });
  }

  const book = await Book.findOne({ _id: bookId, ...PUBLIC_BOOK_FILTER })
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
  const previewChapterId = !hasFullAccess && chapters[0]?._id
    ? String(chapters[0]._id)
    : "";
  return res.json(
    chapters.map((chapter) => {
      const previewOnly = Boolean(previewChapterId && String(chapter._id) === previewChapterId);
      const locked = !hasFullAccess && !previewOnly;
      return {
        _id: chapter._id.toString(),
        title: chapter.title || "",
        order: Number(chapter.order) || 0,
        isFree: Boolean(hasFullAccess || previewOnly),
        locked,
        previewOnly,
        previewText: locked
          ? `${String(chapter.content || "").slice(0, 160)}...`
          : previewOnly
            ? resolveChapterPreviewPage(chapter.content)
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
    Book.findOne({ _id: bookId, ...PUBLIC_BOOK_FILTER }).populate("creatorId", "userId").lean(),
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
  const firstChapter = !hasFullAccess
    ? await Chapter.findOne({ bookId }).sort({ order: 1 }).select("_id").lean()
    : null;
  const previewOnly = Boolean(
    !hasFullAccess &&
    firstChapter?._id &&
    String(firstChapter._id) === String(chapter._id)
  );

  if (!hasFullAccess && !previewOnly) {
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
    content: previewOnly ? resolveChapterPreviewPage(chapter.content) : chapter.content || "",
    isFree: Boolean(hasFullAccess || previewOnly),
    previewOnly,
    locked: false,
  });
});

exports.deleteBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ error: "Invalid book id" });
  }
  if (!creatorHasCategory(req.creatorProfile, "books")) {
    return res.status(403).json({ error: "Books publishing is not enabled on this creator profile" });
  }

  const deleted = await Book.findOneAndDelete({
    _id: bookId,
    creatorId: req.creatorProfile._id,
  }).lean();
  if (!deleted) {
    return res.status(404).json({ error: "Book not found" });
  }

  await Chapter.deleteMany({ bookId: deleted._id }).catch(() => null);
  await deleteUploadedMediaBatch(collectBookMediaAssets(deleted)).catch(() => null);

  return res.json({ success: true, bookId: deleted._id.toString() });
});
