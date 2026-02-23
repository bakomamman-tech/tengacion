const jwt = require("jsonwebtoken");

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

  const secret = process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET;
  const ttl = Math.max(30, Number(expiresInSec) || 300);

  const payload = {
    src: sourceUrl,
    itemType: String(itemType || ""),
    itemId: String(itemId || ""),
    uid: String(userId || ""),
    dl: Boolean(allowDownload),
  };

  const token = jwt.sign(payload, secret, { expiresIn: ttl });
  return `${req.protocol}://${req.get("host")}/api/media/signed?token=${encodeURIComponent(token)}`;
};

const verifySignedMediaToken = (token) => {
  const secret = process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET;
  return jwt.verify(token, secret);
};

module.exports = {
  buildSignedMediaUrl,
  verifySignedMediaToken,
};
