const { deleteUploadedMedia } = require("../services/mediaStore");
const { isCloudinaryMediaValue, mediaToPublicId, normalizeMediaValue } = require("./userMedia");

const toMediaDocument = (value = null) => normalizeMediaValue(value);

const mediaDocumentToUrl = (value = null, fallback = "") => {
  const normalized = normalizeMediaValue(value);
  return normalized.secureUrl || normalized.url || String(fallback || "").trim();
};

const cleanupReplacedMedia = async (previous = null, next = null) => {
  if (!isCloudinaryMediaValue(previous)) {
    return false;
  }

  const previousPublicId = mediaToPublicId(previous);
  const nextPublicId = mediaToPublicId(next);
  if (!previousPublicId || previousPublicId === nextPublicId) {
    return false;
  }

  return deleteUploadedMedia(previous);
};

module.exports = {
  cleanupReplacedMedia,
  mediaDocumentToUrl,
  toMediaDocument,
};
