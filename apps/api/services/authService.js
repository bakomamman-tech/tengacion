const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const { config } = require("../config/env");
const userRepository = require("../repositories/userRepository");
const User = require("../../../backend/models/User");
const Otp = require("../../../backend/models/Otp");
const AuthChallenge = require("../../../backend/models/AuthChallenge");
const sendOtpEmail = require("../../../backend/utils/sendOtpEmail");
const sendSecurityEmail = require("../../../backend/utils/sendSecurityEmail");
const { ensureOnboardingReminderMessage } = require("../../../backend/services/onboardingReminderService");
const { normalizeMediaValue } = require("../../../backend/utils/userMedia");
const { normalizeAudioPrefs } = require("../../../backend/utils/audioPrefs");
const { isValidPhoneNumber, normalizePhoneNumber } = require("../../../backend/utils/phone");
const {
  hashToken,
  signAccessToken,
  signRefreshToken,
  signStepUpToken,
  signChallengeToken,
  verifyRefreshToken,
  verifyChallengeToken,
  encryptSecret,
  decryptSecret,
} = require("../../../backend/services/authTokens");
const {
  generateSecret,
  verifyTotp,
  buildOtpauthUrl,
} = require("../../../backend/utils/totp");
const {
  normalizeSessionMeta,
  scoreLoginRisk,
  updateTrustedDevice,
} = require("../../../backend/services/loginRisk");
const { getEffectivePermissions } = require("../../../backend/services/permissionService");

const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const LOGIN_CHALLENGE_TTL_MS = 10 * 60 * 1000;

const extractDuplicateField = (err) => {
  if (!err) return "";

  const keyPatternField = err.keyPattern ? Object.keys(err.keyPattern)[0] : "";
  if (keyPatternField) return keyPatternField;

  const keyValueField = err.keyValue ? Object.keys(err.keyValue)[0] : "";
  if (keyValueField) return keyValueField;

  const message = err.message || "";
  const match = message.match(/dup key:\s*\{\s*([^:]+)\s*:/i);
  if (match && match[1]) {
    return String(match[1]).replace(/["'`]/g, "").trim();
  }

  return "";
};

const setByPath = (target, path, value) => {
  if (!path) return;

  if (!path.includes(".")) {
    target[path] = value;
    return;
  }

  const keys = path.split(".");
  let cursor = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!cursor[key] || typeof cursor[key] !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }

  cursor[keys[keys.length - 1]] = value;
};

const buildTransparentMediaFallback = (stamp) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="transparent"/><!--${stamp}--></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const buildFieldFallback = (field) => {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (field === "phone") return `tmp_phone_${stamp}`;
  if (field === "country") return `tmp_country_${stamp}`;
  if (field === "joined") return new Date(Date.now() + Math.floor(Math.random() * 1000));
  if (field === "dob") return new Date(Date.now() - Math.floor(Math.random() * 1000000000));
  if (field === "avatar") return { public_id: "", url: buildTransparentMediaFallback(stamp) };
  if (field === "cover") return { public_id: "", url: buildTransparentMediaFallback(stamp) };
  if (field === "avatar.url") return buildTransparentMediaFallback(stamp);
  if (field === "cover.url") return buildTransparentMediaFallback(stamp);
  if (field === "gender") return `unspecified_${stamp}`;
  if (field === "pronouns") return `n/a_${stamp}`;

  return null;
};

const tryCreateWithFallbacks = async (baseData) => {
  const draft = { ...baseData };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await userRepository.create(draft);
    } catch (err) {
      if (err?.code !== 11000) {
        throw err;
      }

      const duplicateField = extractDuplicateField(err);
      if (!duplicateField) {
        throw err;
      }

      const hasExplicitValue = Object.prototype.hasOwnProperty.call(baseData, duplicateField);
      const fallback = buildFieldFallback(duplicateField);
      if (hasExplicitValue || fallback === null) {
        throw err;
      }

      setByPath(draft, duplicateField, fallback);
    }
  }

  throw new Error("Registration retries exceeded");
};

const tryLegacyInsertFallback = async ({
  displayName,
  username,
  email,
  password,
  phone,
  country,
  stateOfOrigin,
  dob,
  gender,
}) => {
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const draft = {
    name: displayName,
    username,
    email,
    password: passwordHash,
    phone: phone || "",
    country: country || "",
    stateOfOrigin: stateOfOrigin || "",
    bio: "",
    gender: (gender || "").trim(),
    pronouns: "",
    role: "user",
    isVerified: true,
    isActive: true,
    joined: now,
    followers: [],
    following: [],
    friends: [],
    friendRequests: [],
    createdAt: now,
    updatedAt: now,
    dob: dob ? new Date(dob) : null,
    avatar: { public_id: "", url: "" },
    cover: { public_id: "", url: "" },
  };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const inserted = await userRepository.insertOne(draft);
      return await userRepository.findById(inserted.insertedId);
    } catch (err) {
      if (err?.code !== 11000) {
        throw err;
      }
      const duplicateField = extractDuplicateField(err);
      const fallback = buildFieldFallback(duplicateField);
      if (!duplicateField || fallback === null) {
        throw err;
      }
      setByPath(draft, duplicateField, fallback);
    }
  }

  throw new Error("Legacy registration fallback failed");
};

const makeTokenHash = (token = "") =>
  crypto.createHash("sha256").update(String(token)).digest("hex");
const makeRawToken = (size = 32) => crypto.randomBytes(size).toString("hex");
const generateSessionId = () => crypto.randomUUID();
const getBaseUrl = () =>
  config.APP_URL ||
  config.CLIENT_URL ||
  config.APP_ORIGIN ||
  config.WEB_ORIGIN ||
  "http://localhost:5173";

const formatSession = (entry) => ({
  sessionId: entry?.sessionId || "",
  deviceName: entry?.deviceName || "",
  ip: entry?.ip || "",
  userAgent: entry?.userAgent || "",
  country: entry?.country || "",
  city: entry?.city || "",
  createdAt: entry?.createdAt || null,
  lastSeenAt: entry?.lastSeenAt || null,
  revokedAt: entry?.revokedAt || null,
});

const isOtpRequired = () => config.REQUIRE_EMAIL_OTP === "true";
const OTP_CODE_TTL_MS = 10 * 60 * 1000;
const OTP_VERIFIED_TTL_MS = 30 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_RESEND_WINDOW_MS = 60 * 60 * 1000;
const OTP_MAX_RESENDS_PER_WINDOW = 5;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const OTP_LOCKOUT_MS = 15 * 60 * 1000;

const sanitizeRegistrationPayload = (payload = {}) => {
  const rawName = (payload.name || "").trim();
  const username = (payload.username || "").trim().toLowerCase();
  const email = (payload.email || "").trim().toLowerCase();
  const password = payload.password || "";
  const phone = normalizePhoneNumber(payload.phone);
  const country = (payload.country || "").trim();
  const stateOfOrigin = (payload.stateOfOrigin || "").trim();
  const dob = payload.dob || "";
  const gender = payload.gender || "";
  return { rawName, username, email, password, phone, country, stateOfOrigin, dob, gender };
};

const sanitizeIdentifier = (value = "") => (value || "").trim().toLowerCase();
const makeOtpHash = (email = "", otp = "") =>
  crypto
    .createHmac("sha256", config.JWT_SECRET)
    .update(`${sanitizeIdentifier(email)}:${String(otp || "").trim()}`)
    .digest("hex");
const buildOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const getOtpRecord = (email) =>
  Otp.findOne({ email: sanitizeIdentifier(email) }).sort({ updatedAt: -1 });
const msUntil = (futureValue, now = Date.now()) => {
  const future = new Date(futureValue || 0).getTime();
  return Math.max(0, future - now);
};
const buildChallengeCodeHash = (challengeId, code) =>
  hashToken(`${String(challengeId || "")}:${String(code || "").trim()}`);

const maskEmail = (email = "") => {
  const value = String(email || "").trim();
  const [local, domain] = value.split("@");
  if (!local || !domain) {
    return "";
  }
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
};

const isAdminRole = (role = "") =>
  ["admin", "super_admin", "trust_safety_admin"].includes(String(role || "").toLowerCase());

const EMAIL_CHALLENGE_PURPOSE_COPY = {
  login_mfa: {
    subject: "Your Tengacion sign-in code",
    title: "Complete your Tengacion sign-in",
    intro: "Enter the verification code below to finish signing in.",
  },
  step_up: {
    subject: "Your Tengacion security code",
    title: "Confirm this sensitive action",
    intro: "Enter the verification code below to continue with this security-sensitive action.",
  },
};

const MFA_SUMMARY_SELECT =
  "twoFactor.enabled twoFactor.method twoFactor.setupPending twoFactor.enabledAt twoFactor.lastVerifiedAt";
const MFA_SECRET_SELECT = `${MFA_SUMMARY_SELECT} +twoFactor.secretCipher`;
const MFA_SETUP_SECRET_SELECT = `${MFA_SECRET_SELECT} +twoFactor.pendingSecretCipher`;
const USER_PROFILE_SELECT =
  "_id name username email role permissions moderationProfile avatar cover audioPrefs emailVerified isActive isBanned isDeleted isSuspended lastLogin lastLoginAt lastSeenAt";
const SESSION_SELECT =
  "sessions.sessionId sessions.deviceName sessions.ip sessions.userAgent sessions.country sessions.city sessions.fingerprint sessions.createdAt sessions.lastSeenAt sessions.revokedAt";
const SESSION_SELECT_WITH_HASH = `${SESSION_SELECT} +sessions.refreshTokenHash`;
const USER_SESSION_SELECT = `${USER_PROFILE_SELECT} tokenVersion ${SESSION_SELECT} trustedDevices`;
const LOGIN_USER_SELECT = `+password ${MFA_SETUP_SECRET_SELECT} ${USER_SESSION_SELECT}`;
const CHALLENGE_USER_SELECT = `${MFA_SECRET_SELECT} ${USER_SESSION_SELECT}`;
const REFRESH_USER_SELECT =
  `${MFA_SUMMARY_SELECT} ${USER_PROFILE_SELECT} tokenVersion trustedDevices ${SESSION_SELECT_WITH_HASH}`;

const verifyEmailChallengeCode = (challenge, code) =>
  String(challenge?.codeHash || "") ===
  buildChallengeCodeHash(String(challenge?._id || ""), String(code || "").trim());

const assertUserCanSignIn = (user) => {
  if (!user) {
    throw ApiError.unauthorized("Invalid credentials");
  }
  if (user.isDeleted) {
    throw ApiError.forbidden("Account is deleted");
  }
  if (!user.isActive) {
    throw ApiError.forbidden("Account is inactive");
  }
  if (user.isBanned) {
    throw ApiError.forbidden("Your account is banned");
  }
  if (user.isSuspended) {
    throw ApiError.forbidden("Your account is suspended");
  }
};

const getSessionById = (user, sessionId = "") =>
  (Array.isArray(user?.sessions) ? user.sessions : []).find(
    (entry) => String(entry?.sessionId || "") === String(sessionId || "")
  );

const buildMfaSummary = (user) => ({
  enabled: Boolean(user?.twoFactor?.enabled),
  method: user?.twoFactor?.method || "none",
  adminRequired: isAdminRole(user?.role),
});

const buildProfilePayload = (user) => {
  const avatar = normalizeMediaValue(user?.avatar);
  const cover = normalizeMediaValue(user?.cover);
  const payload = user?.toObject ? user.toObject() : { ...user };
  delete payload.password;
  delete payload.sessions;
  delete payload.tokenVersion;
  delete payload.trustedDevices;
  delete payload.passwordChangedAt;
  delete payload.emailVerifyTokenHash;
  delete payload.emailVerifyExpiresAt;
  delete payload.resetPasswordTokenHash;
  delete payload.resetPasswordExpiresAt;
  delete payload.__v;
  payload.displayName = payload.name || "";
  payload.avatar = avatar;
  payload.cover = cover;
  payload.audioPrefs = normalizeAudioPrefs(payload.audioPrefs);
  payload.avatarUrl = avatar.url;
  payload.coverUrl = cover.url;
  payload.emailVerified = Boolean(payload.emailVerified);
  if (payload.twoFactor && typeof payload.twoFactor === "object") {
    delete payload.twoFactor.secretCipher;
    delete payload.twoFactor.pendingSecretCipher;
  }
  payload.twoFactor = buildMfaSummary(payload);
  payload.permissions = [...getEffectivePermissions(payload)];
  payload.moderationProfile = payload.moderationProfile || {
    isPrimaryAuthority: false,
    escalationEmail: "",
  };
  return payload;
};

const createChallengeResponse = ({
  challenge,
  user,
  method,
  purpose,
  risk = {},
  secret = "",
}) => ({
  challengeRequired: true,
  challenge: {
    token: signChallengeToken({
      challengeId: challenge._id.toString(),
      userId: user._id.toString(),
      purpose,
    }),
    method,
    purpose,
    expiresAt: challenge.expiresAt,
    riskReasons: Array.isArray(risk?.reasons) ? risk.reasons : [],
    maskedEmail: method === "email" ? maskEmail(user.email) : "",
    setup:
      purpose === "mfa_setup"
        ? {
            secret,
            issuer: "Tengacion",
            label: user.email || user.username || "user",
            otpauthUrl: buildOtpauthUrl({
              issuer: "Tengacion",
              label: user.email || user.username || "user",
              secret,
            }),
          }
        : null,
  },
});

const sendChallengeEmail = async ({ user, challenge, purpose, code }) => {
  const copy = EMAIL_CHALLENGE_PURPOSE_COPY[purpose] || {
    subject: "Your Tengacion verification code",
    title: "Enter your verification code",
    intro: "Use the code below to continue.",
  };

  await sendSecurityEmail({
    to: user.email,
    subject: copy.subject,
    html: `
      <div style="font-family: Arial; padding: 12px;">
        <h2>${copy.title}</h2>
        <p>${copy.intro}</p>
        <p>Your code is <strong style="font-size: 20px; letter-spacing: 3px;">${code}</strong></p>
        <p>This code expires in 10 minutes.</p>
        <p style="color:#64748b;font-size:13px;">Challenge: ${String(challenge._id || "")}</p>
      </div>
    `,
  });
};

const createAuthChallenge = async ({
  user,
  purpose,
  method,
  sessionMeta,
  risk = {},
  secret = "",
}) => {
  const challenge = await AuthChallenge.create({
    userId: user._id,
    purpose,
    method,
    sessionMeta,
    riskScore: Number(risk?.score || 0),
    riskReasons: Array.isArray(risk?.reasons) ? risk.reasons : [],
    secretCipher: secret ? encryptSecret(secret) : "",
    expiresAt: new Date(Date.now() + LOGIN_CHALLENGE_TTL_MS),
  });

  if (method === "email") {
    const code = buildOtpCode();
    challenge.codeHash = buildChallengeCodeHash(challenge._id.toString(), code);
    await challenge.save();
    await sendChallengeEmail({ user, challenge, purpose, code });
  }

  if (risk?.isSuspicious) {
    sendSecurityEmail({
      to: user.email,
      subject: "New Tengacion login challenge",
      html: `
        <div style="font-family: Arial; padding: 12px;">
          <h2>We protected a login attempt</h2>
          <p>Device: ${sessionMeta.deviceName || "Unknown device"}</p>
          <p>Location: ${sessionMeta.city || sessionMeta.country || "Unknown location"}</p>
          <p>Reasons: ${(risk.reasons || []).join(", ") || "risk_check"}</p>
        </div>
      `,
    }).catch(() => null);
  }

  return createChallengeResponse({ challenge, user, method, purpose, risk, secret });
};

const markChallengeFailure = async (challenge) => {
  challenge.attempts = Number(challenge.attempts || 0) + 1;
  await challenge.save();
  if (challenge.attempts >= Number(challenge.maxAttempts || 5)) {
    throw ApiError.tooManyRequests("Too many invalid verification attempts");
  }
};

const markMfaEnabled = (user, method = "totp") => {
  user.twoFactor = user.twoFactor || {};
  user.twoFactor.enabled = true;
  user.twoFactor.method = method;
  user.twoFactor.setupPending = false;
  user.twoFactor.enabledAt = new Date();
  user.twoFactor.lastVerifiedAt = null;
};

const clearMfaState = (user) => {
  user.twoFactor = user.twoFactor || {};
  user.twoFactor.enabled = false;
  user.twoFactor.method = "none";
  user.twoFactor.setupPending = false;
  user.twoFactor.secretCipher = "";
  user.twoFactor.pendingSecretCipher = "";
  user.twoFactor.enabledAt = null;
  user.twoFactor.lastVerifiedAt = null;
};

const assertEmailMfaEligible = (user) => {
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  if (isAdminRole(user.role)) {
    throw ApiError.conflict("Admin accounts must use an authenticator app");
  }
  if (!user.emailVerified) {
    throw ApiError.conflict("Verify your email before enabling email-code authentication");
  }
};

const attachNewSession = (user, sessionMeta = {}) => {
  const sessionId = generateSessionId();
  const refreshToken = signRefreshToken({
    userId: user._id.toString(),
    tokenVersion: user.tokenVersion,
    sessionId,
  });
  const refreshTokenHash = hashToken(refreshToken);

  user.sessions = Array.isArray(user.sessions) ? user.sessions : [];
  user.sessions.push({
    sessionId,
    refreshTokenHash,
    deviceName: sessionMeta.deviceName || "",
    ip: sessionMeta.ip || "",
    userAgent: sessionMeta.userAgent || "",
    country: sessionMeta.country || "",
    city: sessionMeta.city || "",
    fingerprint: sessionMeta.fingerprint || "",
    createdAt: new Date(),
    lastSeenAt: new Date(),
    revokedAt: null,
  });
  if (user.sessions.length > 30) {
    user.sessions = user.sessions.slice(-30);
  }

  return {
    sessionId,
    refreshToken,
    accessToken: signAccessToken({
      userId: user._id.toString(),
      tokenVersion: user.tokenVersion,
      sessionId,
    }),
  };
};

const shouldNotifyLoginRisk = (risk = {}) =>
  Boolean(
    risk?.shouldNotify ||
      (Array.isArray(risk?.reasons) && risk.reasons.length > 0) ||
      Number(risk?.score || 0) >= 20
  );

const sendLoginAlert = async (user, sessionMeta = {}, risk = {}) => {
  if (!user?.email || !shouldNotifyLoginRisk(risk) || risk?.isSuspicious) {
    return;
  }

  await sendSecurityEmail({
    to: user.email,
    subject: "New Tengacion login detected",
    html: `
      <div style="font-family: Arial; padding: 12px;">
        <h2>New login detected</h2>
        <p>Device: ${sessionMeta.deviceName || "Unknown device"}</p>
        <p>Location: ${sessionMeta.city || sessionMeta.country || "Unknown location"}</p>
        <p>Risk signals: ${(risk.reasons || []).join(", ") || "new_login"}</p>
      </div>
    `,
  });
};

const finalizeLogin = async (
  user,
  sessionMeta = {},
  {
    markMfaVerified = false,
    loginRisk = null,
    sendOnboardingReminder = true,
    reminderContext = {},
  } = {}
) => {
  const tokens = attachNewSession(user, sessionMeta);
  updateTrustedDevice(user, sessionMeta);
  user.lastLogin = new Date();
  user.lastLoginAt = new Date();
  user.lastSeenAt = new Date();
  if (markMfaVerified) {
    user.twoFactor = user.twoFactor || {};
    user.twoFactor.lastVerifiedAt = new Date();
  }
  await user.save();
  if (sendOnboardingReminder) {
    try {
      await ensureOnboardingReminderMessage({
        userId: user._id,
        io: reminderContext.io || null,
        onlineUsers: reminderContext.onlineUsers || null,
      });
    } catch (error) {
      console.warn("Onboarding reminder failed:", error);
    }
  }
  sendLoginAlert(user, sessionMeta, loginRisk).catch(() => null);

  return {
    user: buildProfilePayload(user),
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    sessionId: tokens.sessionId,
    stepUpToken:
      markMfaVerified || isAdminRole(user.role)
        ? signStepUpToken({
            userId: user._id.toString(),
            sessionId: tokens.sessionId,
            scope: "default",
          })
        : "",
  };
};

class AuthService {
  static async checkUsername(username) {
    const normalized = sanitizeIdentifier(username);
    if (!normalized || normalized.length < 3) {
      throw ApiError.badRequest("Username must be at least 3 characters");
    }
    const exists = await userRepository.findOne({ username: normalized });
    return { available: !exists };
  }

  static async requestOtp(email) {
    const normalized = sanitizeIdentifier(email);
    if (!normalized) {
      throw ApiError.badRequest("Email required");
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw ApiError.serviceUnavailable("Email verification is not configured");
    }

    const now = Date.now();
    const existing = await getOtpRecord(normalized);
    const lockedMs = msUntil(existing?.lockedUntil, now);
    if (lockedMs > 0) {
      throw ApiError.tooManyRequests(
        `Too many invalid OTP attempts. Try again in ${Math.ceil(lockedMs / 1000)} seconds.`
      );
    }

    const cooldownMs = msUntil(
      existing?.lastSentAt ? new Date(existing.lastSentAt).getTime() + OTP_RESEND_COOLDOWN_MS : 0,
      now
    );
    if (cooldownMs > 0) {
      throw ApiError.tooManyRequests(
        `Please wait ${Math.ceil(cooldownMs / 1000)} seconds before requesting another code.`
      );
    }

    const windowStartedAt = existing?.windowStartedAt
      ? new Date(existing.windowStartedAt).getTime()
      : 0;
    const withinSendWindow = windowStartedAt && now - windowStartedAt < OTP_RESEND_WINDOW_MS;
    const resendCount = withinSendWindow ? Number(existing?.resendCount || 0) : 0;
    if (withinSendWindow && resendCount >= OTP_MAX_RESENDS_PER_WINDOW) {
      throw ApiError.tooManyRequests(
        "Too many OTP requests for this email. Please try again later."
      );
    }

    const otp = buildOtpCode();
    const record = existing || new Otp({ email: normalized });
    record.email = normalized;
    record.otp = "";
    record.otpHash = makeOtpHash(normalized, otp);
    record.expiresAt = new Date(now + OTP_CODE_TTL_MS);
    record.verified = false;
    record.verifiedAt = null;
    record.attemptCount = 0;
    record.resendCount = withinSendWindow ? resendCount + 1 : 1;
    record.lastSentAt = new Date(now);
    record.lastAttemptAt = null;
    record.lockedUntil = null;
    record.windowStartedAt = withinSendWindow ? existing.windowStartedAt : new Date(now);
    await record.save();
    await Otp.deleteMany({ email: normalized, _id: { $ne: record._id } }).catch(() => null);
    await sendOtpEmail({ email: normalized, otp });

    return { message: "OTP sent" };
  }

  static async verifyOtp({ email, otp }) {
    const normalizedEmail = sanitizeIdentifier(email);
    const normalizedOtp = (otp || "").trim();

    if (!normalizedEmail || !normalizedOtp) {
      throw ApiError.badRequest("Email and OTP are required");
    }

    const record = await getOtpRecord(normalizedEmail);
    const now = Date.now();
    if (!record) {
      throw ApiError.badRequest("Invalid or expired OTP");
    }

    const lockedMs = msUntil(record.lockedUntil, now);
    if (lockedMs > 0) {
      throw ApiError.tooManyRequests(
        `Too many invalid OTP attempts. Try again in ${Math.ceil(lockedMs / 1000)} seconds.`
      );
    }

    if (record.verified && record.expiresAt && new Date(record.expiresAt).getTime() > now) {
      return { message: "OTP already verified" };
    }

    if (!record.expiresAt || new Date(record.expiresAt).getTime() <= now) {
      throw ApiError.badRequest("Invalid or expired OTP");
    }

    const hashMatches =
      Boolean(record.otpHash) && record.otpHash === makeOtpHash(normalizedEmail, normalizedOtp);
    const legacyMatches = Boolean(record.otp) && record.otp === normalizedOtp;
    if (!hashMatches && !legacyMatches) {
      record.attemptCount = Number(record.attemptCount || 0) + 1;
      record.lastAttemptAt = new Date(now);
      if (record.attemptCount >= OTP_MAX_VERIFY_ATTEMPTS) {
        record.lockedUntil = new Date(now + OTP_LOCKOUT_MS);
      }
      await record.save();

      if (record.lockedUntil && new Date(record.lockedUntil).getTime() > now) {
        throw ApiError.tooManyRequests(
          `Too many invalid OTP attempts. Try again in ${Math.ceil(OTP_LOCKOUT_MS / 1000)} seconds.`
        );
      }

      throw ApiError.badRequest("Invalid or expired OTP");
    }

    record.verified = true;
    record.verifiedAt = new Date(now);
    record.expiresAt = new Date(now + OTP_VERIFIED_TTL_MS);
    record.otp = "";
    record.otpHash = "";
    record.attemptCount = 0;
    record.lastAttemptAt = new Date(now);
    record.lockedUntil = null;
    await record.save();

    return { message: "OTP verified" };
  }

  static async register(payload = {}) {
    const normalizedSessionMeta = normalizeSessionMeta(payload.sessionMeta || {});
    const reminderContext = payload.reminderContext || {};
    const {
      rawName,
      username,
      email,
      password,
      phone,
      country,
      stateOfOrigin,
      dob,
      gender,
    } = sanitizeRegistrationPayload(payload);

    if (!username || !email || !phone || !password) {
      throw ApiError.badRequest("Username, email, mobile number, and password are required");
    }
    if (!country || !stateOfOrigin) {
      throw ApiError.badRequest("Country and state of origin are required");
    }
    if (password.length < 8) {
      throw ApiError.badRequest("Password must be at least 8 characters");
    }
    if (!USERNAME_REGEX.test(username)) {
      throw ApiError.badRequest(
        "Username can only contain letters, numbers, dots and underscores (3-30 chars)"
      );
    }
    if (!EMAIL_REGEX.test(email)) {
      throw ApiError.badRequest("Please use a valid email address");
    }
    if (!isValidPhoneNumber(phone)) {
      throw ApiError.badRequest("Please enter a valid international mobile number");
    }

    const [usernameExists, emailExists] = await Promise.all([
      userRepository.exists({ username }),
      userRepository.exists({ email }),
    ]);
    if (usernameExists) {
      throw ApiError.conflict("Username already taken");
    }
    if (emailExists) {
      throw ApiError.conflict("Email already registered");
    }

    if (isOtpRequired()) {
      const verified = await Otp.findOne({
        email,
        verified: true,
        expiresAt: { $gt: new Date() },
      })
        .sort({ updatedAt: -1 })
        .catch(() => null);
      if (!verified) {
        throw ApiError.unauthorized("Email not verified");
      }
    }

    const displayName = rawName || username;
    const baseUserData = {
      name: displayName,
      username,
      email,
      password,
      isVerified: true,
      joined: new Date(),
      phone: phone || undefined,
      country: country || undefined,
      stateOfOrigin: stateOfOrigin || undefined,
      dob: dob ? new Date(dob) : undefined,
      gender: gender || undefined,
    };

    Object.keys(baseUserData).forEach((key) => {
      if (baseUserData[key] === undefined) {
        delete baseUserData[key];
      }
    });

    let user;
    try {
      user = await tryCreateWithFallbacks(baseUserData);
    } catch (_createErr) {
      user = await tryLegacyInsertFallback({
        displayName,
        username,
        email,
        password,
        phone,
        country,
        stateOfOrigin,
        dob,
        gender,
      });
    }

    if (isOtpRequired()) {
      Otp.deleteMany({ email }).catch(() => null);
    }

    const rawVerifyToken = makeRawToken(24);
    user.emailVerifyTokenHash = makeTokenHash(rawVerifyToken);
    user.emailVerifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    try {
      const verifyUrl = `${getBaseUrl()}/verify-email?token=${encodeURIComponent(rawVerifyToken)}`;
      await sendSecurityEmail({
        to: user.email,
        subject: "Verify your Tengacion email",
        html: `
          <div style="font-family: Arial; padding: 12px;">
            <h2>Verify your email</h2>
            <p>Click the button below to verify your account.</p>
            <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 14px;background:#b77a3b;color:#fff;text-decoration:none;border-radius:8px;">Verify email</a></p>
            <p>This link expires in 24 hours.</p>
          </div>
        `,
      });
    } catch {
      // Non-fatal.
    }

    return finalizeLogin(user, normalizedSessionMeta, {
      sendOnboardingReminder: false,
      reminderContext,
    });
  }

  static async login({ email, password, sessionMeta = {}, reminderContext = {} }) {
    const identifier = sanitizeIdentifier(email);
    if (!identifier || !password) {
      throw ApiError.badRequest("Email and password are required");
    }

    const user = await userRepository
      .findOne({ email: identifier })
      .select(LOGIN_USER_SELECT);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw ApiError.unauthorized("Invalid credentials");
    }

    assertUserCanSignIn(user);

    const normalizedSessionMeta = normalizeSessionMeta(sessionMeta);
    const risk = scoreLoginRisk(user, normalizedSessionMeta);
    const hasTotp =
      Boolean(user?.twoFactor?.enabled) &&
      user?.twoFactor?.method === "totp" &&
      Boolean(user?.twoFactor?.secretCipher);
    const hasEmailMfa =
      Boolean(user?.twoFactor?.enabled) && user?.twoFactor?.method === "email";

    if (isAdminRole(user.role) && !hasTotp) {
      const secret = generateSecret();
      return createAuthChallenge({
        user,
        purpose: "mfa_setup",
        method: "totp",
        sessionMeta: normalizedSessionMeta,
        risk,
        secret,
      });
    }

    if (hasTotp) {
      return createAuthChallenge({
        user,
        purpose: "login_mfa",
        method: "totp",
        sessionMeta: normalizedSessionMeta,
        risk,
      });
    }

    if (hasEmailMfa) {
      return createAuthChallenge({
        user,
        purpose: "login_mfa",
        method: "email",
        sessionMeta: normalizedSessionMeta,
        risk,
      });
    }

    if (risk.isSuspicious) {
      return createAuthChallenge({
        user,
        purpose: "login_mfa",
        method: "email",
        sessionMeta: normalizedSessionMeta,
        risk,
      });
    }

    return finalizeLogin(user, normalizedSessionMeta, {
      loginRisk: risk,
      reminderContext,
    });
  }

  static async verifyAuthChallenge({ challengeToken, code, reminderContext = {} }) {
    if (!challengeToken || !code) {
      throw ApiError.badRequest("Challenge token and code are required");
    }

    let decoded;
    try {
      decoded = verifyChallengeToken(challengeToken);
    } catch {
      throw ApiError.unauthorized("Challenge expired or invalid");
    }

    const challenge = await AuthChallenge.findById(decoded.cid);
    if (!challenge || challenge.usedAt || new Date(challenge.expiresAt).getTime() <= Date.now()) {
      throw ApiError.unauthorized("Challenge expired or invalid");
    }

    const user = await User.findById(challenge.userId).select(CHALLENGE_USER_SELECT);
    assertUserCanSignIn(user);

    const normalizedCode = String(code || "").trim();
    let valid = false;

    if (challenge.method === "totp" && challenge.purpose === "login_mfa") {
      const secret = decryptSecret(user?.twoFactor?.secretCipher || "");
      valid = verifyTotp({ secret, token: normalizedCode, window: 2 });
    } else if (challenge.method === "email" && challenge.purpose === "login_mfa") {
      valid = verifyEmailChallengeCode(challenge, normalizedCode);
    } else if (challenge.method === "totp" && challenge.purpose === "mfa_setup") {
      const secret = decryptSecret(challenge.secretCipher || "");
      valid = verifyTotp({ secret, token: normalizedCode, window: 2 });
      if (valid) {
        markMfaEnabled(user, "totp");
        user.twoFactor.secretCipher = challenge.secretCipher;
        user.twoFactor.pendingSecretCipher = "";
        user.twoFactor.lastVerifiedAt = new Date();
      }
    }

    if (!valid) {
      await markChallengeFailure(challenge);
      throw ApiError.badRequest("Invalid authentication code");
    }

    challenge.usedAt = new Date();
    await challenge.save();

    return finalizeLogin(user, challenge.sessionMeta || {}, {
      markMfaVerified: true,
      loginRisk: {
        score: Number(challenge.riskScore || 0),
        reasons: Array.isArray(challenge.riskReasons) ? challenge.riskReasons : [],
        isSuspicious: Number(challenge.riskScore || 0) >= 60,
        shouldNotify: Array.isArray(challenge.riskReasons) && challenge.riskReasons.length > 0,
      },
      reminderContext,
    });
  }

  static async refreshSession({ refreshToken }) {
    const rawToken = String(refreshToken || "").trim();
    if (!rawToken) {
      throw ApiError.unauthorized("Refresh token missing");
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(rawToken);
    } catch {
      throw ApiError.unauthorized("Session expired");
    }

    const user = await User.findById(decoded.id).select(REFRESH_USER_SELECT);
    assertUserCanSignIn(user);

    const session = getSessionById(user, decoded.sid);
    if (!session || session.revokedAt) {
      throw ApiError.unauthorized("Session revoked. Please login again.");
    }
    if (Number(decoded.tv ?? 0) !== Number(user.tokenVersion || 0)) {
      throw ApiError.unauthorized("Session revoked. Please login again.");
    }
    if (String(session.refreshTokenHash || "") !== hashToken(rawToken)) {
      throw ApiError.unauthorized("Session revoked. Please login again.");
    }

    const nextRefreshToken = signRefreshToken({
      userId: user._id.toString(),
      tokenVersion: user.tokenVersion,
      sessionId: decoded.sid,
    });
    session.refreshTokenHash = hashToken(nextRefreshToken);
    session.lastSeenAt = new Date();
    user.lastSeenAt = new Date();
    await user.save();

    return {
      user: buildProfilePayload(user),
      token: signAccessToken({
        userId: user._id.toString(),
        tokenVersion: user.tokenVersion,
        sessionId: decoded.sid,
      }),
      refreshToken: nextRefreshToken,
      sessionId: decoded.sid,
    };
  }

  static async getProfile(userId) {
    if (!userId) {
      throw ApiError.badRequest("Missing user identifier");
    }

    const user = await userRepository
      .findById(userId)
      .select(`${USER_PROFILE_SELECT} ${MFA_SUMMARY_SELECT}`);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    return buildProfilePayload(user);
  }

  static async getMfaStatus(userId) {
    const user = await User.findById(userId).select(
      `_id email username role ${MFA_SUMMARY_SELECT}`
    );
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    return {
      ...buildMfaSummary(user),
      email: user.email || "",
      username: user.username || "",
    };
  }

  static async beginTwoFactorSetup({ userId }) {
    const user = await User.findById(userId).select(
      `_id email username role ${MFA_SETUP_SECRET_SELECT}`
    );
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    if (user?.twoFactor?.enabled) {
      throw ApiError.conflict("Two-factor authentication is already enabled");
    }

    const secret = generateSecret();
    user.twoFactor = user.twoFactor || {};
    user.twoFactor.setupPending = true;
    user.twoFactor.pendingSecretCipher = encryptSecret(secret);
    await user.save();

    return {
      enabled: false,
      method: "totp",
      setupPending: true,
      secret,
      issuer: "Tengacion",
      label: user.email || user.username || "user",
      otpauthUrl: buildOtpauthUrl({
        issuer: "Tengacion",
        label: user.email || user.username || "user",
        secret,
      }),
    };
  }

  static async verifyTwoFactorSetup({ userId, code }) {
    const user = await User.findById(userId).select(`_id role ${MFA_SETUP_SECRET_SELECT}`);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    const pendingSecret = decryptSecret(user?.twoFactor?.pendingSecretCipher || "");
    if (!pendingSecret) {
      throw ApiError.badRequest("Two-factor setup was not started");
    }

    const valid = verifyTotp({
      secret: pendingSecret,
      token: String(code || "").trim(),
      window: 2,
    });
    if (!valid) {
      throw ApiError.badRequest("Invalid authentication code");
    }

    markMfaEnabled(user, "totp");
    user.twoFactor.secretCipher = user.twoFactor.pendingSecretCipher;
    user.twoFactor.pendingSecretCipher = "";
    user.twoFactor.lastVerifiedAt = new Date();
    await user.save();

    return buildMfaSummary(user);
  }

  static async enableEmailTwoFactor({ userId }) {
    const user = await User.findById(userId).select(
      `_id email username role emailVerified ${MFA_SUMMARY_SELECT} +twoFactor.pendingSecretCipher +twoFactor.secretCipher`
    );
    assertEmailMfaEligible(user);

    if (user?.twoFactor?.enabled) {
      throw ApiError.conflict("Two-factor authentication is already enabled");
    }

    markMfaEnabled(user, "email");
    user.twoFactor.secretCipher = "";
    user.twoFactor.pendingSecretCipher = "";
    await user.save();

    return {
      ...buildMfaSummary(user),
      message: `Email codes will be sent to ${maskEmail(user.email) || user.email}.`,
    };
  }

  static async disableTwoFactor({ userId, password, code }) {
    const user = await User.findById(userId).select(`+password _id role ${MFA_SECRET_SELECT}`);
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    if (!user?.twoFactor?.enabled || user?.twoFactor?.method === "none") {
      throw ApiError.badRequest("Two-factor authentication is not enabled");
    }

    const validPassword = await bcrypt.compare(String(password || ""), user.password);
    if (!validPassword) {
      throw ApiError.unauthorized("Current password is incorrect");
    }

    if (user.twoFactor.method === "totp") {
      const secret = decryptSecret(user?.twoFactor?.secretCipher || "");
      const validCode = verifyTotp({
        secret,
        token: String(code || "").trim(),
        window: 2,
      });
      if (!validCode) {
        throw ApiError.badRequest("Invalid authentication code");
      }
    }

    clearMfaState(user);
    await user.save();

    return buildMfaSummary(user);
  }

  static async verifyStepUp({ userId, sessionId, code, challengeToken }) {
    const user = await User.findById(userId).select(`_id role ${MFA_SECRET_SELECT}`);
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    if (!user?.twoFactor?.enabled || user?.twoFactor?.method === "none") {
      throw ApiError.badRequest("Two-factor authentication is required for step-up");
    }

    if (user.twoFactor.method === "email") {
      const normalizedCode = String(code || "").trim();
      if (!challengeToken) {
        return createAuthChallenge({
          user,
          purpose: "step_up",
          method: "email",
          sessionMeta: normalizeSessionMeta({}),
          risk: {},
        });
      }

      let decoded;
      try {
        decoded = verifyChallengeToken(challengeToken);
      } catch {
        throw ApiError.unauthorized("Challenge expired or invalid");
      }

      const challenge = await AuthChallenge.findById(decoded.cid);
      if (
        !challenge ||
        challenge.usedAt ||
        challenge.purpose !== "step_up" ||
        String(challenge.userId || "") !== String(userId || "") ||
        new Date(challenge.expiresAt).getTime() <= Date.now()
      ) {
        throw ApiError.unauthorized("Challenge expired or invalid");
      }

      const valid = verifyEmailChallengeCode(challenge, normalizedCode);
      if (!valid) {
        await markChallengeFailure(challenge);
        throw ApiError.badRequest("Invalid authentication code");
      }

      challenge.usedAt = new Date();
      await challenge.save();
    } else {
      const secret = decryptSecret(user?.twoFactor?.secretCipher || "");
      const valid = verifyTotp({
        secret,
        token: String(code || "").trim(),
        window: 2,
      });
      if (!valid) {
        throw ApiError.badRequest("Invalid authentication code");
      }
    }

    user.twoFactor.lastVerifiedAt = new Date();
    await user.save();

    return {
      success: true,
      stepUpToken: signStepUpToken({
        userId: user._id.toString(),
        sessionId,
        scope: "default",
      }),
    };
  }

  static async requestEmailVerification({ userId, email }) {
    const user = userId
      ? await userRepository.findById(userId)
      : await userRepository.findOne({ email: sanitizeIdentifier(email) });
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    if (user.emailVerified) {
      return { message: "Email already verified" };
    }

    const rawVerifyToken = makeRawToken(24);
    user.emailVerifyTokenHash = makeTokenHash(rawVerifyToken);
    user.emailVerifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const verifyUrl = `${getBaseUrl()}/verify-email?token=${encodeURIComponent(rawVerifyToken)}`;
    await sendSecurityEmail({
      to: user.email,
      subject: "Verify your Tengacion email",
      html: `
        <div style="font-family: Arial; padding: 12px;">
          <h2>Verify your email</h2>
          <p><a href="${verifyUrl}">Click here to verify your account</a></p>
          <p>This link expires in 24 hours.</p>
        </div>
      `,
    });

    return { message: "Verification email sent" };
  }

  static async confirmEmailVerification(rawToken) {
    const token = String(rawToken || "").trim();
    if (!token) {
      throw ApiError.badRequest("Verification token is required");
    }
    const tokenHash = makeTokenHash(token);
    const user = await userRepository
      .findOne({
        emailVerifyTokenHash: tokenHash,
        emailVerifyExpiresAt: { $gt: new Date() },
      })
      .select("+emailVerifyTokenHash +emailVerifyExpiresAt");
    if (!user) {
      throw ApiError.badRequest("Verification link is invalid or expired");
    }

    user.emailVerified = true;
    user.isVerified = true;
    user.emailVerifyTokenHash = "";
    user.emailVerifyExpiresAt = null;
    await user.save();
    return { success: true };
  }

  static async forgotPassword(email) {
    const normalized = sanitizeIdentifier(email);
    if (!normalized) {
      throw ApiError.badRequest("Email required");
    }
    const user = await userRepository.findOne({ email: normalized }).select(
      "+resetPasswordTokenHash +resetPasswordExpiresAt"
    );
    if (!user) {
      return { message: "If this email exists, a reset link was sent." };
    }

    const rawToken = makeRawToken(24);
    user.resetPasswordTokenHash = makeTokenHash(rawToken);
    user.resetPasswordExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const resetUrl = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
    await sendSecurityEmail({
      to: user.email,
      subject: "Reset your Tengacion password",
      html: `
        <div style="font-family: Arial; padding: 12px;">
          <h2>Reset your password</h2>
          <p><a href="${resetUrl}">Reset password</a></p>
          <p>This link expires in 30 minutes.</p>
        </div>
      `,
    });

    return { message: "If this email exists, a reset link was sent." };
  }

  static async resetPassword({ token, newPassword }) {
    const rawToken = String(token || "").trim();
    if (!rawToken || !newPassword || String(newPassword).length < 8) {
      throw ApiError.badRequest("Valid token and new password are required");
    }
    const user = await userRepository
      .findOne({
        resetPasswordTokenHash: makeTokenHash(rawToken),
        resetPasswordExpiresAt: { $gt: new Date() },
      })
      .select("+password +resetPasswordTokenHash +resetPasswordExpiresAt");
    if (!user) {
      throw ApiError.badRequest("Reset token is invalid or expired");
    }

    user.password = String(newPassword);
    user.resetPasswordTokenHash = "";
    user.resetPasswordExpiresAt = null;
    user.passwordChangedAt = new Date();
    user.tokenVersion = (Number(user.tokenVersion) || 0) + 1;
    const revokedSessionIds = (user.sessions || [])
      .map((entry) => entry?.sessionId || "")
      .filter(Boolean);
    user.sessions = [];
    await user.save();

    return {
      success: true,
      userId: user._id.toString(),
      revokedSessionIds,
    };
  }

  static async changePassword({ userId, oldPassword, newPassword }) {
    if (!oldPassword || !newPassword || String(newPassword).length < 8) {
      throw ApiError.badRequest("Current password and a strong new password are required");
    }

    const user = await userRepository.findById(userId).select("+password");
    if (!user) throw ApiError.notFound("User not found");

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) throw ApiError.unauthorized("Current password is incorrect");

    user.password = String(newPassword);
    user.passwordChangedAt = new Date();
    user.tokenVersion = (Number(user.tokenVersion) || 0) + 1;
    const revokedSessionIds = (user.sessions || [])
      .map((entry) => entry?.sessionId || "")
      .filter(Boolean);
    user.sessions = [];
    await user.save();
    return {
      success: true,
      userId: user._id.toString(),
      revokedSessionIds,
    };
  }

  static async listSessions(userId) {
    const user = await userRepository.findById(userId).select(SESSION_SELECT);
    if (!user) throw ApiError.notFound("User not found");
    return (user.sessions || []).map(formatSession).sort((a, b) => {
      const at = new Date(a.lastSeenAt || a.createdAt || 0).getTime();
      const bt = new Date(b.lastSeenAt || b.createdAt || 0).getTime();
      return bt - at;
    });
  }

  static async revokeSession({ userId, sessionId }) {
    const user = await userRepository.findById(userId).select(SESSION_SELECT_WITH_HASH);
    if (!user) throw ApiError.notFound("User not found");
    const session = (user.sessions || []).find((entry) => entry.sessionId === sessionId);
    if (!session) throw ApiError.notFound("Session not found");
    session.revokedAt = new Date();
    session.refreshTokenHash = "";
    await user.save();
    return { success: true, userId: user._id.toString(), sessionId };
  }

  static async revokeAllSessions({ userId, exceptSessionId = "" }) {
    const user = await userRepository
      .findById(userId)
      .select(`tokenVersion ${SESSION_SELECT_WITH_HASH}`);
    if (!user) throw ApiError.notFound("User not found");
    const now = new Date();
    const revokedSessionIds = [];
    (user.sessions || []).forEach((entry) => {
      if (!exceptSessionId || entry.sessionId !== exceptSessionId) {
        entry.revokedAt = now;
        entry.refreshTokenHash = "";
        if (entry.sessionId) {
          revokedSessionIds.push(entry.sessionId);
        }
      }
    });
    if (!exceptSessionId) {
      user.tokenVersion = (Number(user.tokenVersion) || 0) + 1;
    }
    await user.save();
    return {
      success: true,
      userId: user._id.toString(),
      exceptSessionId: String(exceptSessionId || ""),
      revokedSessionIds,
    };
  }

  static async touchSession({ userId, sessionId }) {
    if (!sessionId) return;
    const user = await userRepository.findById(userId).select("sessions");
    if (!user) return;
    const session = (user.sessions || []).find((entry) => entry.sessionId === sessionId);
    if (!session) return;
    session.lastSeenAt = new Date();
    await user.save();
  }
}

module.exports = AuthService;
