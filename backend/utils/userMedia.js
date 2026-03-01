const DEFAULT_MEDIA = Object.freeze({
  url: "",
  public_id: "",
});

const toStringValue = (value) => {
  if (value == null) {
    return "";
  }
  return String(value).trim();
};

const normalizeMediaValue = (value) => {
  if (!value) {
    return { ...DEFAULT_MEDIA };
  }

  if (typeof value === "string") {
    return {
      url: toStringValue(value),
      public_id: "",
    };
  }

  if (typeof value === "object") {
    return {
      url: toStringValue(value.url),
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
  normalizeMediaValue,
  mediaToUrl,
  normalizeUserMediaDocument,
};
