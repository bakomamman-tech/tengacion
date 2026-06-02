const { PDFDocument } = require("pdf-lib");

const {
  openMediaSourceStream,
  streamSourceMedia,
} = require("./mediaDeliveryService");
const {
  ensureFilenameExtension,
  sanitizeFilename,
} = require("../utils/bookDownloadMetadata");

const toText = (value = "") => String(value || "").trim();
const GENERATED_CHAPTER_ONE_PREVIEW_PAGE_LIMIT = 24;

const mediaUrl = (media = {}) => {
  const value = media || {};
  return toText(value.secureUrl || value.secure_url || value.url || value.fileUrl);
};

const getBookContentSource = (book = {}) =>
  mediaUrl(book.contentMedia) || toText(book.contentUrl || book.fileUrl);

const getBookExplicitPreviewSource = (book = {}) =>
  mediaUrl(book.previewMedia) || toText(book.previewUrl);

const sourceLooksPdf = (sourceUrl = "") => {
  const normalized = toText(sourceUrl).toLowerCase();
  return (
    normalized.startsWith("data:application/pdf") ||
    /\.pdf(?:$|[?#])/i.test(normalized)
  );
};

const isPdfBook = (book = {}) => {
  const format = toText(book.fileFormat).toLowerCase();
  const contentType = toText(book.contentType).toLowerCase();
  const media = book.contentMedia || {};
  return (
    format === "pdf" ||
    contentType === "pdf_book" ||
    toText(media.format).toLowerCase() === "pdf" ||
    toText(media.contentType).toLowerCase().includes("pdf") ||
    sourceLooksPdf(getBookContentSource(book))
  );
};

const canServeBookPreviewDocument = (book = {}) =>
  Boolean(getBookExplicitPreviewSource(book) || (isPdfBook(book) && getBookContentSource(book)));

const buildBookPreviewEndpointPath = (bookId = "") =>
  `/api/books/${encodeURIComponent(String(bookId || "").trim())}/preview`;

const buildBookPreviewEndpointUrl = ({ req, bookId = "" } = {}) => {
  const path = buildBookPreviewEndpointPath(bookId);
  if (!req) {
    return path;
  }
  return `${req.protocol}://${req.get("host")}${path}`;
};

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const resolvePreviewFilename = (book = {}) => {
  const media = book.contentMedia || {};
  const baseFilename =
    toText(media.originalFilename) ||
    toText(book.title) ||
    "book-preview";
  const clean = sanitizeFilename(baseFilename, "book-preview");
  const currentExtension = clean.toLowerCase().endsWith(".pdf") ? "" : ".pdf";
  return ensureFilenameExtension(
    currentExtension ? `${clean}-preview` : clean.replace(/\.pdf$/i, "-preview.pdf"),
    ".pdf"
  );
};

const resolveGeneratedPreviewPageLimit = (book = {}) => {
  const candidates = [
    book.previewPageCount,
    book.previewPages,
    process.env.BOOK_PREVIEW_PAGE_LIMIT,
    GENERATED_CHAPTER_ONE_PREVIEW_PAGE_LIMIT,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1, Math.min(80, Math.floor(parsed)));
    }
  }

  return GENERATED_CHAPTER_ONE_PREVIEW_PAGE_LIMIT;
};

const loadPdfPreviewPages = async (sourceUrl = "", pageLimit = GENERATED_CHAPTER_ONE_PREVIEW_PAGE_LIMIT) => {
  const source = await openMediaSourceStream(sourceUrl);
  const input = await streamToBuffer(source.stream);
  const sourcePdf = await PDFDocument.load(input, { ignoreEncryption: true });
  if (sourcePdf.getPageCount() < 1) {
    throw new Error("Book PDF has no readable pages");
  }

  const previewPdf = await PDFDocument.create();
  const pageCount = Math.min(sourcePdf.getPageCount(), Math.max(1, Number(pageLimit) || 1));
  const pageIndexes = Array.from({ length: pageCount }, (_, index) => index);
  const copiedPages = await previewPdf.copyPages(sourcePdf, pageIndexes);
  copiedPages.forEach((page) => previewPdf.addPage(page));
  return Buffer.from(await previewPdf.save());
};

const setPreviewHeaders = ({
  res,
  filename,
  length = 0,
  headOnly = false,
}) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${String(filename).replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "private, max-age=300, stale-while-revalidate=86400");
  res.setHeader("Accept-Ranges", "none");
  if (Number.isFinite(length) && length >= 0) {
    res.setHeader("Content-Length", length);
  }
  res.status(200);
  if (headOnly) {
    res.end();
    return true;
  }
  return false;
};

const streamBookPreviewDocument = async ({
  req,
  res,
  book,
  headOnly = false,
}) => {
  if (!book) {
    return false;
  }

  const explicitPreviewSource = getBookExplicitPreviewSource(book);
  const generatedPreviewSource = getBookContentSource(book);
  const generatedPreviewIsPdf = isPdfBook(book) && generatedPreviewSource;

  if (explicitPreviewSource) {
    return streamSourceMedia({
      req,
      res,
      sourceUrl: explicitPreviewSource,
      disposition: "inline",
      filename: ensureFilenameExtension(`${sanitizeFilename(book.title || "book", "book")}-preview`, ".pdf"),
      contentType: sourceLooksPdf(explicitPreviewSource) ? "application/pdf" : "",
      cacheControl: "private, max-age=300, stale-while-revalidate=86400",
      headOnly,
    });
  }

  if (generatedPreviewIsPdf) {
    try {
      const previewBuffer = await loadPdfPreviewPages(
        generatedPreviewSource,
        resolveGeneratedPreviewPageLimit(book)
      );
      const filename = resolvePreviewFilename(book);
      if (setPreviewHeaders({
        res,
        filename,
        length: previewBuffer.length,
        headOnly,
      })) {
        return true;
      }
      res.end(previewBuffer);
      return true;
    } catch {
      // Fall through to unavailable when PDF splitting fails.
    }
  }

  return false;
};

module.exports = {
  buildBookPreviewEndpointPath,
  buildBookPreviewEndpointUrl,
  canServeBookPreviewDocument,
  getBookContentSource,
  getBookExplicitPreviewSource,
  streamBookPreviewDocument,
};
