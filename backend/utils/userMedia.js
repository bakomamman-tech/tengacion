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
});

const LEGACY_TEMP_MEDIA_PREFIXES = ["/uploads/tmp_avatar_", "/uploads/tmp_cover_"];

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

const normalizeMediaValue = (value) => {
  if (!value) {
    return { ...DEFAULT_MEDIA };
  }

  if (typeof value === "string") {
    const url = toStringValue(value);
    if (!url || isLegacyTempMediaUrl(url)) {
      return { ...DEFAULT_MEDIA };
    }
    return {
      ...DEFAULT_MEDIA,
      url,
      secureUrl: url,
      secure_url: url,
    };
  }

  if (typeof value === "object") {
    const url = toStringValue(value.secureUrl || value.secure_url || value.url);
    const publicId = toStringValue(value.publicId || value.public_id);
    const resourceType = toStringValue(value.resourceType || value.resource_type);
    if (!url || isLegacyTempMediaUrl(url)) {
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
    };
  }

  return { ...DEFAULT_MEDIA };
};

const mediaToUrl = (value) => {
  const normalized = normalizeMediaValue(value);
  return normalized.secureUrl || normalized.url;
};

const mediaToPublicId = (value) => normalizeMediaValue(value).publicId;

const isCloudinaryMediaValue = (value) => {
  const normalized = normalizeMediaValue(value);
  return Boolean(normalized.publicId) || /(^https?:\/\/)?res\.cloudinary\.com\//i.test(normalized.url);
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
  isCloudinaryMediaValue,
  isLegacyTempMediaUrl,
  mediaToPublicId,
  normalizeMediaValue,
  mediaToUrl,
  normalizeUserMediaDocument,
};
