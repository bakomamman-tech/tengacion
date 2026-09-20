const crypto = require("crypto");

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const MIN_SECRET_LENGTH = 32;

const getSecret = () =>
  String(
    process.env.TENGAAGENT_CALENDAR_ENCRYPTION_KEY || ""
  ).trim();

const getKey = () => {
  const secret = getSecret();

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      "TengaAgent calendar encryption is not configured."
    );
  }

  if (/^[a-f0-9]{64}$/i.test(secret)) {
    return Buffer.from(secret, "hex");
  }

  return crypto
    .createHash("sha256")
    .update(secret, "utf8")
    .digest();
};

const toBase64Url = (buffer) =>
  Buffer.from(buffer).toString("base64url");

const fromBase64Url = (value) =>
  Buffer.from(String(value || ""), "base64url");

const encryptJson = (value) => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    key,
    iv
  );
  const plaintext = Buffer.from(
    JSON.stringify(value),
    "utf8"
  );
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    toBase64Url(iv),
    toBase64Url(tag),
    toBase64Url(ciphertext),
  ].join(".");
};

const decryptJson = (value) => {
  const parts = String(value || "").split(".");

  if (
    parts.length !== 4 ||
    parts[0] !== VERSION
  ) {
    throw new Error(
      "TengaAgent calendar encrypted data is invalid."
    );
  }

  const key = getKey();
  const iv = fromBase64Url(parts[1]);
  const tag = fromBase64Url(parts[2]);
  const ciphertext = fromBase64Url(parts[3]);
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    iv
  );

  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plaintext);
};

const isCalendarEncryptionConfigured = () =>
  getSecret().length >= MIN_SECRET_LENGTH;

module.exports = {
  decryptJson,
  encryptJson,
  isCalendarEncryptionConfigured,
};
