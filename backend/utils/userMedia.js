const DEFAULT_MEDIA = Object.freeze({
  assetId: "",
  publicId: "",
  public_id: "",
  url: "",
  secureUrl: "",
  secure_url: "",
  resourceType: "",
  resource_type: "",
  mimeType: "",
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

const isLegacyLocalMediaUrl = (value = "") => Boolean(inferLegacyPath(value));

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
      assetId: "",
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
    const assetId = toStringValue(value.assetId || value.asset_id);
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
      assetId,
      publicId,
      public_id: publicId,
      url,
      secureUrl: url,
      secure_url: url,
      resourceType,
      resource_type: resourceType,
      mimeType: toStringValue(value.mimeType || value.mimetype),
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

const normalizeCloudinaryMediaValue = (value) => {
  const normalized = normalizeMediaValue(value);
  if (!isCloudinaryMediaValue(normalized)) {
    return normalized;
  }

  const url = toStringValue(normalized.secureUrl || normalized.url);
  const publicId = toStringValue(normalized.publicId || inferCloudinaryPublicIdFromUrl(url));
  const resourceType = toStringValue(normalized.resourceType || normalized.resource_type);

  return {
    ...DEFAULT_MEDIA,
    assetId: toStringValue(normalized.assetId || value?.assetId || value?.asset_id),
    publicId,
    public_id: publicId,
    url,
    secureUrl: url,
    secure_url: url,
    resourceType,
    resource_type: resourceType,
    mimeType: toStringValue(value?.mimeType || value?.mimetype || normalized.mimeType),
    format: toStringValue(normalized.format),
    bytes: toNumberValue(normalized.bytes),
    width: toNumberValue(normalized.width),
    height: toNumberValue(normalized.height),
    duration: toNumberValue(normalized.duration),
    originalFilename: toStringValue(normalized.originalFilename),
    folder: toStringValue(normalized.folder),
    provider: "cloudinary",
    legacyPath: "",
  };
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

const sanitizeMediaUrlForNewWrite = (value = "") =>
  isLegacyLocalMediaUrl(value) ? "" : toStringValue(value);

const tokenizePath = (path = "") =>
  String(path || "")
    .match(/[^.[\]]+/g)
    ?.filter(Boolean) || [];

const getPathValue = (target, path) => {
  if (!target || !path) {
    return undefined;
  }

  if (typeof target.get === "function") {
    try {
      return target.get(path);
    } catch {
      // Fall through to plain object traversal when the document path lookup fails.
    }
  }

  return tokenizePath(path).reduce((current, segment) => {
    if (current == null) {
      return undefined;
    }
    return current[segment];
  }, target);
};

const setPathValue = (target, path, value) => {
  if (!target || !path) {
    return;
  }

  if (typeof target.set === "function") {
    target.set(path, value);
    return;
  }

  const segments = tokenizePath(path);
  if (!segments.length) {
    return;
  }

  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];
    if (cursor[segment] == null || typeof cursor[segment] !== "object") {
      cursor[segment] = /^\d+$/.test(nextSegment) ? [] : {};
    }
    cursor = cursor[segment];
  }

  cursor[segments[segments.length - 1]] = value;
};

const shouldSyncCloudinaryAlias = (currentValue, nextUrl = "") => {
  const current = toStringValue(currentValue);
  const replacement = toStringValue(nextUrl);
  if (!replacement) {
    return false;
  }
  return !current || isLegacyLocalMediaUrl(current);
};

const sanitizeLegacyMediaFieldsForNewWrite = (
  recordOrPatch,
  { cloudinaryMedia = [], clearLegacyStringPaths = [] } = {}
) => {
  if (!recordOrPatch || typeof recordOrPatch !== "object") {
    return recordOrPatch;
  }

  (Array.isArray(cloudinaryMedia) ? cloudinaryMedia : []).forEach((rule = {}) => {
    const mediaPath = toStringValue(rule.mediaPath);
    if (!mediaPath) {
      return;
    }

    const normalizedMedia = normalizeCloudinaryMediaValue(getPathValue(recordOrPatch, mediaPath));
    if (!isCloudinaryMediaValue(normalizedMedia)) {
      return;
    }

    setPathValue(recordOrPatch, mediaPath, normalizedMedia);
    const canonicalUrl = getMediaUrl(normalizedMedia);
    (Array.isArray(rule.urlPaths) ? rule.urlPaths : []).forEach((urlPath) => {
      const normalizedUrlPath = toStringValue(urlPath);
      if (!normalizedUrlPath) {
        return;
      }
      if (shouldSyncCloudinaryAlias(getPathValue(recordOrPatch, normalizedUrlPath), canonicalUrl)) {
        setPathValue(recordOrPatch, normalizedUrlPath, canonicalUrl);
      }
    });
  });

  (Array.isArray(clearLegacyStringPaths) ? clearLegacyStringPaths : []).forEach((path) => {
    const normalizedPath = toStringValue(path);
    if (!normalizedPath) {
      return;
    }
    if (isLegacyLocalMediaUrl(getPathValue(recordOrPatch, normalizedPath))) {
      setPathValue(recordOrPatch, normalizedPath, "");
    }
  });

  return recordOrPatch;
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
  isLegacyLocalMediaUrl,
  isCloudinaryMediaValue,
  isCloudinaryMedia: isCloudinaryMediaValue,
  isCloudinaryUrl,
  isLegacyLocalMediaValue,
  isLegacyTempMediaUrl,
  mediaToPublicId,
  normalizeCloudinaryMediaValue,
  normalizeMediaValue,
  mediaToUrl,
  normalizeUserMediaDocument,
  sanitizeLegacyMediaFieldsForNewWrite,
  sanitizeMediaUrlForNewWrite,
};
