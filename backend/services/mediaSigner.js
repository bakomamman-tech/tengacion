const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { config } = require("../config/env");

const base64UrlEncode = (value) => Buffer.from(value).toString("base64url");
const base64UrlDecode = (value) => Buffer.from(value, "base64url").toString("utf8");

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
  req,
}) => {
  if (!sourceUrl || !req) {
    return "";
  }

  const payload = {
    src: sourceUrl,
    itemType: String(itemType || ""),
    itemId: String(itemId || ""),
    uid: String(userId || ""),
    dl: Boolean(allowDownload),
    exp: createStableExpiry(expiresInSec),
  };

  const token = buildDeliveryToken(payload);
  return `${req.protocol}://${req.get("host")}/api/media/delivery/${encodeURIComponent(token)}`;
};

const verifySignedMediaToken = (token) => {
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
    if (!payload?.src || !payload?.exp) {
      throw new Error("Invalid media payload");
    }
    if (Number(payload.exp) <= Math.floor(Date.now() / 1000)) {
      throw new Error("Media token expired");
    }
    return payload;
  }

  const secret = getSecret();
  return jwt.verify(rawToken, secret);
};

module.exports = {
  buildSignedMediaUrl,
  verifySignedMediaToken,
};
