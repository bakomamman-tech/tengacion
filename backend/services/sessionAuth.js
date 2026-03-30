const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { config } = require("../config/env");

class SessionAuthError extends Error {
  constructor(message, code = "UNAUTHORIZED", statusCode = 401) {
    super(message);
    this.name = "SessionAuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const DEFAULT_USER_SELECT =
  "_id name username email role permissions moderationProfile isActive isBanned isDeleted isSuspended tokenVersion sessions twoFactor passwordChangedAt forceLogoutAt mustReauth";

const extractBearerToken = (authHeader = "") => {
  const header = String(authHeader || "").trim();
  if (!header) {
    return "";
  }

  const bearerMatch = header.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch && bearerMatch[1]) {
    return bearerMatch[1].trim();
  }

  return header;
};

const verifySessionToken = (token) => {
  const rawToken = String(token || "").trim();
  if (!rawToken) {
    throw new SessionAuthError("No token", "NO_TOKEN", 401);
  }

  try {
    const decoded = jwt.verify(rawToken, config.JWT_SECRET);
    if (decoded?.kind && decoded.kind !== "access") {
      throw new SessionAuthError("Invalid token", "INVALID_TOKEN", 401);
    }
    return decoded;
  } catch (err) {
    if (err?.name === "TokenExpiredError") {
      throw new SessionAuthError("Session expired", "TOKEN_EXPIRED", 401);
    }
    throw new SessionAuthError("Invalid token", "INVALID_TOKEN", 401);
  }
};

const buildAuthContext = (user, session, decoded) => ({
  user,
  session,
  userId: user._id.toString(),
  sessionId: String(session?.sessionId || "").trim(),
  tokenVersion: Number(user.tokenVersion) || 0,
  claims: decoded,
});

const validateSessionClaims = async (decoded, { touchSession = false } = {}) => {
  const user = await User.findById(decoded.id).select(DEFAULT_USER_SELECT);

  if (!user) {
    throw new SessionAuthError("User no longer exists", "USER_NOT_FOUND", 401);
  }

  if (!user.isActive || user.isDeleted) {
    throw new SessionAuthError("Account is inactive", "ACCOUNT_INACTIVE", 403);
  }

  if (user.isBanned) {
    throw new SessionAuthError("Account is banned", "ACCOUNT_BANNED", 403);
  }
  if (user.isSuspended) {
    throw new SessionAuthError("Account is suspended", "ACCOUNT_SUSPENDED", 403);
  }

  const tokenVersion = Number(user.tokenVersion) || 0;
  const claimVersion = Number(decoded.tv ?? 0);
  if (claimVersion !== tokenVersion) {
    throw new SessionAuthError(
      "Session revoked. Please login again.",
      "TOKEN_VERSION_MISMATCH",
      401
    );
  }

  const issuedAtMs = Number(decoded?.iat || 0) * 1000;
  const passwordChangedAtMs = new Date(user.passwordChangedAt || 0).getTime();
  if (passwordChangedAtMs && issuedAtMs && passwordChangedAtMs > issuedAtMs) {
    throw new SessionAuthError(
      "Session revoked. Please login again.",
      "PASSWORD_CHANGED",
      401
    );
  }

  const forceLogoutAtMs = new Date(user.forceLogoutAt || 0).getTime();
  if (forceLogoutAtMs && issuedAtMs && forceLogoutAtMs > issuedAtMs) {
    throw new SessionAuthError(
      "Session revoked. Please login again.",
      "FORCE_LOGOUT",
      401
    );
  }

  if (user.mustReauth) {
    throw new SessionAuthError("Session revoked. Please login again.", "MUST_REAUTH", 401);
  }

  const claimSessionId = String(decoded.sid || "").trim();
  if (!claimSessionId) {
    throw new SessionAuthError(
      "Session invalid. Please login again.",
      "SESSION_ID_MISSING",
      401
    );
  }

  const session = Array.isArray(user.sessions)
    ? user.sessions.find((entry) => String(entry?.sessionId || "") === claimSessionId)
    : null;

  if (!session || session.revokedAt) {
    throw new SessionAuthError(
      "Session revoked. Please login again.",
      "SESSION_REVOKED",
      401
    );
  }

  if (touchSession) {
    await User.updateOne(
      { _id: user._id, "sessions.sessionId": claimSessionId },
      { $set: { "sessions.$.lastSeenAt": new Date() } }
    );
  }

  return buildAuthContext(user, session, decoded);
};

const authenticateAccessToken = async (token, options = {}) => {
  const decoded = verifySessionToken(token);
  return validateSessionClaims(decoded, options);
};

module.exports = {
  SessionAuthError,
  extractBearerToken,
  verifySessionToken,
  validateSessionClaims,
  authenticateAccessToken,
};
