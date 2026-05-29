const path = require("path");

const FORMAT_METADATA = {
  epub: { extension: ".epub", contentType: "application/epub+zip" },
  mobi: { extension: ".mobi", contentType: "application/x-mobipocket-ebook" },
  pdf: { extension: ".pdf", contentType: "application/pdf" },
  txt: { extension: ".txt", contentType: "text/plain; charset=utf-8" },
};

const toText = (value = "") => String(value || "").trim();

const sanitizeFilename = (value = "", fallback = "book") => {
  const base = toText(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (base || fallback).slice(0, 180);
};

const resolveBookFormat = (book = {}) => {
  const fromBook = toText(book.fileFormat || book.contentType).toLowerCase();
  if (FORMAT_METADATA[fromBook]) {
    return fromBook;
  }

  const media = book.contentMedia || {};
  const fromMedia = toText(media.format || media.resourceType).toLowerCase();
  if (FORMAT_METADATA[fromMedia]) {
    return fromMedia;
  }

  const sourceName = toText(media.originalFilename || book.contentUrl || book.fileUrl).toLowerCase();
  const extension = path.extname(sourceName).replace(/^\./, "");
  return FORMAT_METADATA[extension] ? extension : "pdf";
};

const ensureFilenameExtension = (filename = "", extension = "") => {
  const clean = sanitizeFilename(filename, "book");
  const expectedExtension = extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  if (!expectedExtension || expectedExtension === ".") {
    return clean;
  }

  const currentExtension = path.extname(clean).toLowerCase();
  if (currentExtension === expectedExtension) {
    return clean;
  }

  const stem = currentExtension ? clean.slice(0, -currentExtension.length) : clean;
  return `${sanitizeFilename(stem, "book")}${expectedExtension}`;
};

const resolveBookDownloadMetadata = (book = {}) => {
  const format = resolveBookFormat(book);
  const metadata = FORMAT_METADATA[format] || FORMAT_METADATA.pdf;
  const media = book.contentMedia || {};
  const baseFilename =
    toText(media.originalFilename) ||
    toText(book.title) ||
    toText(book.contentUrl || book.fileUrl) ||
    "book";

  return {
    filename: ensureFilenameExtension(baseFilename, metadata.extension),
    contentType: metadata.contentType,
  };
};

module.exports = {
  ensureFilenameExtension,
  resolveBookDownloadMetadata,
  sanitizeFilename,
};
