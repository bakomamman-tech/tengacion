const DEFAULT_MEDIA = Object.freeze({
  url: "",
  public_id: "",
});

const LEGACY_TEMP_MEDIA_PREFIXES = ["/uploads/tmp_avatar_", "/uploads/tmp_cover_"];

const toStringValue = (value) => {
  if (value == null) {
    return "";
  }
  return String(value).trim();
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
      url,
      public_id: "",
    };
  }

  if (typeof value === "object") {
    const url = toStringValue(value.url);
    if (!url || isLegacyTempMediaUrl(url)) {
      return { ...DEFAULT_MEDIA };
    }
    return {
      url,
      public_id: toStringValue(value.public_id),
    };
  }

  return { ...DEFAULT_MEDIA };
};

const mediaToUrl = (value) => normalizeMediaValue(value).url;

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
  isLegacyTempMediaUrl,
  normalizeMediaValue,
  mediaToUrl,
  normalizeUserMediaDocument,
};
