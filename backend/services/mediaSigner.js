const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { config } = require("../config/env");

const TRACK_MEDIA_ITEM_TYPES = new Set(["track", "song", "podcast"]);
const TRACK_MEDIA_ACCESS_TYPES = new Set(["preview", "stream", "download"]);

const base64UrlEncode = (value) => Buffer.from(value).toString("base64url");
const base64UrlDecode = (value) => Buffer.from(value, "base64url").toString("utf8");

const toTokenText = (value = "", maxLength = 180) =>
  String(value || "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeTrackMediaDescriptor = ({ itemType = "", itemId = "", accessType = "" } = {}) => {
  const normalizedItemType = toTokenText(itemType, 24).toLowerCase();
  const normalizedItemId = toTokenText(itemId, 80);
  const normalizedAccessType = toTokenText(accessType, 24).toLowerCase();
  const protectedTrackMedia = TRACK_MEDIA_ITEM_TYPES.has(normalizedItemType);

  return {
    itemType: normalizedItemType,
    itemId: normalizedItemId,
    accessType: normalizedAccessType,
    protectedTrackMedia,
    validProtectedTrackMedia:
      protectedTrackMedia
      && Boolean(normalizedItemId)
      && TRACK_MEDIA_ACCESS_TYPES.has(normalizedAccessType),
  };
};

const getRequestBindingParts = (req = {}) => {
  const forwardedFor = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const ip = forwardedFor || String(req.ip || req.socket?.remoteAddress || "").trim();
  const userAgent = String(req.headers?.["user-agent"] || "").trim();
  return [ip, userAgent].filter(Boolean).join("|");
};

const buildRequestBindingHash = (req = {}) => {
  const value = getRequestBindingParts(req);
  if (!value) {
    return "";
  }
  return crypto.createHash("sha256").update(value).digest("base64url");
};

const getSecret = () => {
  const secret = config.MEDIA_SIGNING_SECRET || config.JWT_SECRET;
  if (!secret && config.NODE_ENV === "production") {
    throw new Error("MEDIA_SIGNING_SECRET is required");
  }
  return secret;
};

const createStableExpiry = (expiresInSec = 300) => {
  const ttl = Math.max(30, Number(expiresInSec) || 300);
  const now = Math.floor(Date.now() / 1000);
  const bucket = ttl >= 3600 ? 300 : ttl >= 300 ? 60 : 30;
  return Math.ceil((now + ttl) / bucket) * bucket;
};

const signEncodedPayload = (encodedPayload) =>
  crypto.createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");

const buildDeliveryToken = (payload) => {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signEncodedPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
};

const buildSignedMediaUrl = ({
  sourceUrl,
  userId = "",
  itemType = "",
  itemId = "",
  expiresInSec = 300,
  allowDownload = false,
  filename = "",
  contentType = "",
  disposition = "",
  accessType = "",
  bindToRequest = false,
  req,
}) => {
  if (!req) {
    return "";
  }

  const descriptor = normalizeTrackMediaDescriptor({ itemType, itemId, accessType });
  if (descriptor.protectedTrackMedia && !descriptor.validProtectedTrackMedia) {
    return "";
  }
  if (!descriptor.protectedTrackMedia && !sourceUrl) {
    return "";
  }

  const payload = {
    itemType: String(itemType || ""),
    itemId: String(itemId || ""),
    uid: String(userId || ""),
    dl: Boolean(allowDownload),
    exp: createStableExpiry(expiresInSec),
  };

  // Track/song/podcast tokens intentionally do not carry their raw storage URL.
  // A signed token is authorization metadata, not an encrypted container; embedding
  // the source would let anyone base64-decode the token and bypass Tengacion.
  if (!descriptor.protectedTrackMedia) {
    payload.src = sourceUrl;
  }

  const resolvedFilename = toTokenText(filename);
  const resolvedContentType = toTokenText(contentType, 120);
  if (resolvedFilename) {
    payload.filename = resolvedFilename;
  }
  if (resolvedContentType) {
    payload.contentType = resolvedContentType;
  }
  const resolvedDisposition = toTokenText(disposition, 24).toLowerCase();
  if (["inline", "attachment"].includes(resolvedDisposition)) {
    payload.disposition = resolvedDisposition;
  }
  const resolvedAccessType = descriptor.accessType;
  if (TRACK_MEDIA_ACCESS_TYPES.has(resolvedAccessType)) {
    payload.accessType = resolvedAccessType;
  }
  if (bindToRequest && req) {
    const binding = buildRequestBindingHash(req);
    if (binding) {
      payload.device = binding;
    }
  }

  const token = buildDeliveryToken(payload);
  return `${req.protocol}://${req.get("host")}/api/media/delivery/${encodeURIComponent(token)}`;
};

const validateVerifiedPayload = (payload = {}, { req } = {}) => {
  const descriptor = normalizeTrackMediaDescriptor(payload);

  if (!payload?.exp) {
    throw new Error("Invalid media payload");
  }
  if (!payload?.src && !descriptor.validProtectedTrackMedia) {
    throw new Error("Invalid media payload");
  }
  if (Number(payload.exp) <= Math.floor(Date.now() / 1000)) {
    throw new Error("Media token expired");
  }

  if (descriptor.validProtectedTrackMedia && req) {
    const fetchDest = String(req.headers?.["sec-fetch-dest"] || "").trim().toLowerCase();
    const fetchMode = String(req.headers?.["sec-fetch-mode"] || "").trim().toLowerCase();
    if (
      ["preview", "stream"].includes(descriptor.accessType)
      && (fetchDest === "document" || fetchMode === "navigate")
    ) {
      const error = new Error("Protected media must be played inside Tengacion");
      error.status = 403;
      throw error;
    }
  }

  if (payload.device && req) {
    const expectedBinding = buildRequestBindingHash(req);
    if (!expectedBinding || expectedBinding !== payload.device) {
      const error = new Error("Media token is bound to another device");
      error.status = 403;
      throw error;
    }
  }

  return payload;
};

const verifySignedMediaToken = (token, { req } = {}) => {
  const rawToken = String(token || "").trim();
  if (!rawToken) {
    throw new Error("Missing media token");
  }

  const parts = rawToken.split(".");
  if (parts.length === 2) {
    const [encodedPayload, signature] = parts;
    const expectedSignature = signEncodedPayload(encodedPayload);

    const signatureBuffer = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expectedSignature, "base64url");
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new Error("Invalid media signature");
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload) || "{}");
    return validateVerifiedPayload(payload, { req });
  }

  const secret = getSecret();
  const payload = jwt.verify(rawToken, secret);
  return validateVerifiedPayload(payload, { req });
};

module.exports = {
  buildSignedMediaUrl,
  verifySignedMediaToken,
};
