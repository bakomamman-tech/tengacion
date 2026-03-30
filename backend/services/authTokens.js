const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { config } = require("../../apps/api/config/env");

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "30d";
const STEP_UP_TOKEN_TTL = process.env.STEP_UP_TOKEN_TTL || "30m";
const CHALLENGE_TOKEN_TTL = process.env.AUTH_CHALLENGE_TTL || "10m";

const REFRESH_COOKIE_NAME = "tg_refresh";
const STEP_UP_COOKIE_NAME = "tg_stepup";

const accessTokenSecret = config.JWT_SECRET;
const refreshTokenSecret = config.JWT_REFRESH_SECRET || (config.isProduction ? "" : config.JWT_SECRET);
const challengeTokenSecret =
  config.AUTH_CHALLENGE_SECRET || (config.isProduction ? "" : config.JWT_SECRET);

if (config.isProduction && !refreshTokenSecret) {
  throw new Error("JWT_REFRESH_SECRET is required in production");
}

if (config.isProduction && !challengeTokenSecret) {
  throw new Error("AUTH_CHALLENGE_SECRET is required in production");
}

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: config.NODE_ENV === "production",
  path: "/",
};

const hashToken = (token = "") =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");

const signAccessToken = ({ userId, tokenVersion = 0, sessionId = "" }) =>
  jwt.sign(
    {
      id: String(userId || ""),
      tv: Number(tokenVersion) || 0,
      sid: String(sessionId || ""),
      kind: "access",
    },
    accessTokenSecret,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

const signRefreshToken = ({ userId, tokenVersion = 0, sessionId = "" }) =>
  jwt.sign(
    {
      id: String(userId || ""),
      tv: Number(tokenVersion) || 0,
      sid: String(sessionId || ""),
      kind: "refresh",
    },
    refreshTokenSecret,
    { expiresIn: REFRESH_TOKEN_TTL }
  );

const signStepUpToken = ({ userId, sessionId = "", scope = "default" }) =>
  jwt.sign(
    {
      id: String(userId || ""),
      sid: String(sessionId || ""),
      scope: String(scope || "default"),
      kind: "step_up",
    },
    accessTokenSecret,
    { expiresIn: STEP_UP_TOKEN_TTL }
  );

const signChallengeToken = ({ challengeId, userId, purpose }) =>
  jwt.sign(
    {
      cid: String(challengeId || ""),
      id: String(userId || ""),
      purpose: String(purpose || ""),
      kind: "auth_challenge",
    },
    challengeTokenSecret,
    { expiresIn: CHALLENGE_TOKEN_TTL }
  );

const verifyRefreshToken = (token) => {
  const decoded = jwt.verify(String(token || "").trim(), refreshTokenSecret);
  if (decoded?.kind !== "refresh") {
    throw new Error("Invalid refresh token");
  }
  return decoded;
};

const verifyStepUpToken = (token) => {
  const decoded = jwt.verify(String(token || "").trim(), accessTokenSecret);
  if (decoded?.kind !== "step_up") {
    throw new Error("Invalid step-up token");
  }
  return decoded;
};

const verifyChallengeToken = (token) => {
  const decoded = jwt.verify(String(token || "").trim(), challengeTokenSecret);
  if (decoded?.kind !== "auth_challenge") {
    throw new Error("Invalid challenge token");
  }
  return decoded;
};

const setRefreshCookie = (res, refreshToken) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...baseCookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions);
};

const setStepUpCookie = (res, stepUpToken) => {
  res.cookie(STEP_UP_COOKIE_NAME, stepUpToken, {
    ...baseCookieOptions,
    maxAge: 30 * 60 * 1000,
  });
};

const clearStepUpCookie = (res) => {
  res.clearCookie(STEP_UP_COOKIE_NAME, baseCookieOptions);
};

const encryptSecret = (plaintext = "") => {
  const key = crypto.createHash("sha256").update(accessTokenSecret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext || ""), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
};

const decryptSecret = (payload = "") => {
  const [ivValue, tagValue, dataValue] = String(payload || "").split(".");
  if (!ivValue || !tagValue || !dataValue) {
    return "";
  }
  const key = crypto.createHash("sha256").update(accessTokenSecret).digest();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

module.exports = {
  REFRESH_COOKIE_NAME,
  STEP_UP_COOKIE_NAME,
  ACCESS_TOKEN_TTL,
  hashToken,
  signAccessToken,
  signRefreshToken,
  signStepUpToken,
  signChallengeToken,
  verifyRefreshToken,
  verifyStepUpToken,
  verifyChallengeToken,
  setRefreshCookie,
  clearRefreshCookie,
  setStepUpCookie,
  clearStepUpCookie,
  encryptSecret,
  decryptSecret,
};
