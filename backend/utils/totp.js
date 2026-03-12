const crypto = require("crypto");

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Encode = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const base32Decode = (value = "") => {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let current = 0;
  const bytes = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      continue;
    }
    current = (current << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

const generateSecret = (size = 20) => base32Encode(crypto.randomBytes(size));

const hotp = ({ secret, counter, digits = 6, algorithm = "sha1" }) => {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);

  const digest = crypto.createHmac(algorithm, key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const code =
    ((digest[offset] & 127) << 24) |
    ((digest[offset + 1] & 255) << 16) |
    ((digest[offset + 2] & 255) << 8) |
    (digest[offset + 3] & 255);

  return String(code % 10 ** digits).padStart(digits, "0");
};

const totp = ({
  secret,
  timestamp = Date.now(),
  step = 30,
  digits = 6,
  algorithm = "sha1",
} = {}) => {
  const counter = Math.floor(Math.floor(timestamp / 1000) / step);
  return hotp({ secret, counter, digits, algorithm });
};

const verifyTotp = ({
  secret,
  token,
  timestamp = Date.now(),
  step = 30,
  digits = 6,
  algorithm = "sha1",
  window = 1,
} = {}) => {
  const normalizedToken = String(token || "").trim();
  if (!secret || !normalizedToken) {
    return false;
  }

  const currentCounter = Math.floor(Math.floor(timestamp / 1000) / step);
  for (let offset = -Math.abs(window); offset <= Math.abs(window); offset += 1) {
    const candidate = hotp({
      secret,
      counter: currentCounter + offset,
      digits,
      algorithm,
    });
    if (candidate === normalizedToken) {
      return true;
    }
  }

  return false;
};

const buildOtpauthUrl = ({ issuer = "Tengacion", label = "", secret = "" } = {}) => {
  const accountLabel = encodeURIComponent(label || "user");
  const appIssuer = encodeURIComponent(issuer || "Tengacion");
  return `otpauth://totp/${appIssuer}:${accountLabel}?secret=${encodeURIComponent(secret)}&issuer=${appIssuer}&algorithm=SHA1&digits=6&period=30`;
};

module.exports = {
  generateSecret,
  totp,
  verifyTotp,
  buildOtpauthUrl,
};
