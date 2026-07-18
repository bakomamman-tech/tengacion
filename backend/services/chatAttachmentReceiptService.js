const crypto = require("crypto");
const { config } = require("../config/env");

const MAX_RECEIPT_TTL_SECONDS = 15 * 60;

const cleanText = (value = "", maxLength = 1200) =>
  String(value || "").trim().slice(0, maxLength);

const getSecret = () => {
  const secret = config.mediaSigningSecret || config.jwtSecret;
  if (!secret) {
    throw new Error("Media signing secret is required");
  }
  return secret;
};

const sign = (encodedPayload) =>
  crypto.createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");

const canonicalAttachment = (attachment = {}) => {
  const url = cleanText(
    attachment.secureUrl || attachment.secure_url || attachment.url,
    1200
  );
  return {
    url,
    secureUrl: url,
    secure_url: url,
    assetId: cleanText(attachment.assetId || attachment.asset_id, 240),
    publicId: cleanText(attachment.publicId || attachment.public_id, 240),
    public_id: cleanText(attachment.publicId || attachment.public_id, 240),
    resourceType: cleanText(attachment.resourceType || attachment.resource_type, 40),
    resource_type: cleanText(attachment.resourceType || attachment.resource_type, 40),
    provider: cleanText(attachment.provider, 40).toLowerCase(),
    folder: cleanText(attachment.folder, 240),
    legacyPath: cleanText(attachment.legacyPath, 1200),
    type: cleanText(attachment.type, 20).toLowerCase(),
    name: cleanText(attachment.name, 260),
    size: Math.max(0, Number(attachment.size) || 0),
    durationSeconds: Math.max(0, Number(attachment.durationSeconds) || 0),
  };
};

const issueChatAttachmentReceipt = ({ userId, attachment, expiresInSec = MAX_RECEIPT_TTL_SECONDS }) => {
  const normalized = canonicalAttachment(attachment);
  if (!userId || !normalized.url) {
    throw new Error("Cannot issue an attachment receipt without an owner and URL");
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    uid: String(userId),
    iat: now,
    exp: now + Math.min(MAX_RECEIPT_TTL_SECONDS, Math.max(30, Number(expiresInSec) || 0)),
    attachment: normalized,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
};

const verifyChatAttachmentReceipt = ({ token, userId }) => {
  const [encoded = "", signature = "", ...extra] = String(token || "").split(".");
  if (!encoded || !signature || extra.length > 0) {
    throw new Error("This attachment must be uploaded through Tengacion before it can be sent");
  }

  const actual = Buffer.from(signature, "base64url");
  const expected = Buffer.from(sign(encoded), "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new Error("Invalid chat attachment receipt");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid chat attachment receipt");
  }
  if (
    payload?.v !== 1
    || String(payload?.uid || "") !== String(userId || "")
    || Number(payload?.exp || 0) <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error("This attachment upload has expired; upload it again to send it safely");
  }

  const attachment = canonicalAttachment(payload.attachment);
  if (!attachment.url) {
    throw new Error("Invalid chat attachment receipt");
  }
  return attachment;
};

module.exports = {
  issueChatAttachmentReceipt,
  verifyChatAttachmentReceipt,
};
