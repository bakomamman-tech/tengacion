const DEFAULT_MEDIA = Object.freeze({
  publicId: "",
  public_id: "",
  url: "",
  secureUrl: "",
  secure_url: "",
  resourceType: "",
  resource_type: "",
  format: "",
  bytes: 0,
  width: 0,
  height: 0,
  duration: 0,
  originalFilename: "",
  folder: "",
  provider: "",
  legacyPath: "",
});

const LEGACY_TEMP_MEDIA_PREFIXES = ["/uploads/tmp_avatar_", "/uploads/tmp_cover_"];
const CLOUDINARY_URL_PATTERN = /(^https?:\/\/)?res\.cloudinary\.com\//i;
const LEGACY_LOCAL_MEDIA_PATTERN = /^(?:\/)?(?:uploads\/|public\/uploads\/|api\/media\/)/i;

const toStringValue = (value) => {
  if (value == null) {
    return "";
  }
  return String(value).trim();
};

const toNumberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const isLegacyTempMediaUrl = (value = "") => {
  const normalized = toStringValue(value).toLowerCase();
  return LEGACY_TEMP_MEDIA_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const isCloudinaryUrl = (value = "") => CLOUDINARY_URL_PATTERN.test(toStringValue(value));

const inferCloudinaryPublicIdFromUrl = (value = "") => {
  const url = toStringValue(value);
  if (!isCloudinaryUrl(url)) {
    return "";
  }

  const withoutQuery = url.split("?")[0];
  const match = withoutQuery.match(/\/upload\/(?:[^/]+\/)*(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
  return match?.[1] || "";
};

const inferLegacyPath = (value = "") => {
  const normalized = toStringValue(value);
  if (!normalized) {
    return "";
  }
  return LEGACY_LOCAL_MEDIA_PATTERN.test(normalized) ? normalized : "";
};

const normalizeProvider = (value = "", { publicId = "", url = "", legacyPath = "" } = {}) => {
  const provider = toStringValue(value).toLowerCase();
  if (provider === "cloudinary") {
    return "cloudinary";
  }
  if (!legacyPath && (publicId || isCloudinaryUrl(url))) {
    return "cloudinary";
  }
  return "";
};

const normalizeMediaValue = (value) => {
  if (!value) {
    return { ...DEFAULT_MEDIA };
  }

  if (typeof value === "string") {
    const url = toStringValue(value);
    if (!url || isLegacyTempMediaUrl(url)) {
      return { ...DEFAULT_MEDIA };
    }
    const publicId = inferCloudinaryPublicIdFromUrl(url);
    const legacyPath = inferLegacyPath(url);
    return {
      ...DEFAULT_MEDIA,
      publicId,
      public_id: publicId,
      url,
      secureUrl: url,
      secure_url: url,
      provider: normalizeProvider("", { publicId, url, legacyPath }),
      legacyPath,
    };
  }

  if (typeof value === "object") {
    const url = toStringValue(value.secureUrl || value.secure_url || value.url || value.legacyPath);
    const publicId = toStringValue(value.publicId || value.public_id || inferCloudinaryPublicIdFromUrl(url));
    const resourceType = toStringValue(value.resourceType || value.resource_type);
    const legacyPath = inferLegacyPath(value.legacyPath || url);
    const provider = normalizeProvider(value.provider, { publicId, url, legacyPath });
    if ((!url && !publicId) || isLegacyTempMediaUrl(url || value.legacyPath)) {
      return { ...DEFAULT_MEDIA };
    }
    return {
      ...DEFAULT_MEDIA,
      publicId,
      public_id: publicId,
      url,
      secureUrl: url,
      secure_url: url,
      resourceType,
      resource_type: resourceType,
      format: toStringValue(value.format),
      bytes: toNumberValue(value.bytes),
      width: toNumberValue(value.width),
      height: toNumberValue(value.height),
      duration: toNumberValue(value.duration),
      originalFilename: toStringValue(value.originalFilename),
      folder: toStringValue(value.folder),
      provider,
      legacyPath,
    };
  }

  return { ...DEFAULT_MEDIA };
};

const getMediaUrl = (value) => {
  const normalized = normalizeMediaValue(value);
  return normalized.secureUrl || normalized.url;
};

const getMediaPreviewUrl = (value) => {
  const normalized = normalizeMediaValue(value);
  return (
    toStringValue(value?.thumbnailUrl) ||
    toStringValue(value?.previewUrl) ||
    normalized.secureUrl ||
    normalized.url
  );
};

const mediaToUrl = (value) => getMediaUrl(value);

const mediaToPublicId = (value) => {
  const normalized = normalizeMediaValue(value);
  return normalized.publicId || inferCloudinaryPublicIdFromUrl(normalized.url);
};

const isLegacyLocalMediaValue = (value) => {
  const normalized = normalizeMediaValue(value);
  return Boolean(normalized.legacyPath);
};

const isCloudinaryMediaValue = (value) => {
  const normalized = normalizeMediaValue(value);
  return (
    normalized.provider === "cloudinary" ||
    (Boolean(normalized.publicId) && !normalized.legacyPath) ||
    isCloudinaryUrl(normalized.url)
  );
};

const normalizeUserMediaDocument = (userDoc) => {
  if (!userDoc) {
    return userDoc;
  }

  const avatar = normalizeMediaValue(userDoc.avatar);
  const cover = normalizeMediaValue(userDoc.cover);
  userDoc.set("avatar", avatar);
  userDoc.set("cover", cover);
  return userDoc;
};

module.exports = {
  DEFAULT_MEDIA,
  getMediaPreviewUrl,
  getMediaUrl,
  inferCloudinaryPublicIdFromUrl,
  isCloudinaryMediaValue,
  isCloudinaryUrl,
  isLegacyLocalMediaValue,
  isLegacyTempMediaUrl,
  mediaToPublicId,
  normalizeMediaValue,
  mediaToUrl,
  normalizeUserMediaDocument,
};
