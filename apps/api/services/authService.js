const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const { config } = require("../config/env");
const userRepository = require("../repositories/userRepository");
const Otp = require("../../../backend/models/Otp");
const sendOtpEmail = require("../../../backend/utils/sendOtpEmail");
const sendSecurityEmail = require("../../../backend/utils/sendSecurityEmail");
const { normalizeMediaValue } = require("../../../backend/utils/userMedia");

const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

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

const summarizeMongoDetails = (err) => {
  const details = err?.errInfo?.details;
  if (!details) return "";
  try {
    const raw = JSON.stringify(details);
    return raw.length > 600 ? `${raw.slice(0, 600)}...` : raw;
  } catch {
    return "";
  }
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

const buildFieldFallback = (field) => {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (field === "phone") return `tmp_phone_${stamp}`;
  if (field === "country") return `tmp_country_${stamp}`;
  if (field === "joined") return new Date(Date.now() + Math.floor(Math.random() * 1000));
  if (field === "dob") return new Date(Date.now() - Math.floor(Math.random() * 1000000000));
  if (field === "avatar") return { public_id: "", url: `/uploads/tmp_avatar_${stamp}.png` };
  if (field === "cover") return { public_id: "", url: `/uploads/tmp_cover_${stamp}.png` };
  if (field === "avatar.url") return `/uploads/tmp_avatar_${stamp}.png`;
  if (field === "cover.url") return `/uploads/tmp_cover_${stamp}.png`;
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
  dob,
  gender,
}) => {
  const passwordHash = await bcrypt.hash(password, 12);
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  const shared = {
    name: displayName,
    username,
    email,
    password: passwordHash,
    phone: phone || "",
    country: country || "",
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
  };

  const modernDoc = {
    ...shared,
    dob: dob ? new Date(dob) : null,
    avatar: { public_id: "", url: "" },
    cover: { public_id: "", url: "" },
  };

  const variants = [modernDoc];
  let lastError = null;

  for (const variant of variants) {
    const draft = { ...variant };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const inserted = await userRepository.insertOne(draft);
        return await userRepository.findById(inserted.insertedId);
      } catch (err) {
        lastError = err;

        if (err?.code !== 11000) {
          break;
        }

        const duplicateField = extractDuplicateField(err);
        const fallback = buildFieldFallback(duplicateField);

        if (!duplicateField || fallback === null) {
          break;
        }

        setByPath(draft, duplicateField, fallback);
      }
    }
  }

  throw lastError || new Error("Legacy registration fallback failed");
};

const makeTokenHash = (token = "") =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

const makeRawToken = (size = 32) => crypto.randomBytes(size).toString("hex");

const generateSessionId = () => crypto.randomUUID();

const generateToken = (id, tokenVersion = 0, sessionId = "") =>
  jwt.sign({ id, tv: Number(tokenVersion) || 0, sid: String(sessionId || "") }, config.JWT_SECRET, {
    expiresIn: "7d",
  });

const getBaseUrl = () => process.env.APP_ORIGIN || process.env.WEB_ORIGIN || "http://localhost:5173";

const formatSession = (entry) => ({
  sessionId: entry?.sessionId || "",
  deviceName: entry?.deviceName || "",
  ip: entry?.ip || "",
  userAgent: entry?.userAgent || "",
  createdAt: entry?.createdAt || null,
  lastSeenAt: entry?.lastSeenAt || null,
  revokedAt: entry?.revokedAt || null,
});

const isOtpRequired = () => config.REQUIRE_EMAIL_OTP === "true";

const sanitizeRegistrationPayload = (payload = {}) => {
  const rawName = (payload.name || "").trim();
  const username = (payload.username || "").trim().toLowerCase();
  const email = (payload.email || "").trim().toLowerCase();
  const password = payload.password || "";
  const phone = (payload.phone || "").trim();
  const country = (payload.country || "").trim();
  const dob = payload.dob || "";
  const gender = payload.gender || "";

  return {
    rawName,
    username,
    email,
    password,
    phone,
    country,
    dob,
    gender,
  };
};

const sanitizeIdentifier = (value = "") => (value || "").trim().toLowerCase();

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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.deleteMany({ email: normalized });
    await Otp.create({ email: normalized, otp, expiresAt, verified: false });
    await sendOtpEmail({ email: normalized, otp });

    return { message: "OTP sent" };
  }

  static async verifyOtp({ email, otp }) {
    const normalizedEmail = sanitizeIdentifier(email);
    const normalizedOtp = (otp || "").trim();

    if (!normalizedEmail || !normalizedOtp) {
      throw ApiError.badRequest("Email and OTP are required");
    }

    const record = await Otp.findOne({ email: normalizedEmail, otp: normalizedOtp });
    if (!record || record.expiresAt < new Date()) {
      throw ApiError.badRequest("Invalid or expired OTP");
    }

    record.verified = true;
    await record.save();

    return { message: "OTP verified" };
  }

  static async register(payload = {}) {
    const {
      rawName,
      username,
      email,
      password,
      phone,
      country,
      dob,
      gender,
    } = sanitizeRegistrationPayload(payload);

    if (!username || !email || !password) {
      throw ApiError.badRequest("Name, username, and password are required");
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
      const verified = await Otp.findOne({ email, verified: true }).catch(() => null);
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
    } catch (createErr) {
      user = await tryLegacyInsertFallback({
        displayName,
        username,
        email,
        password,
        phone,
        country,
        dob,
        gender,
      });
    }

    if (isOtpRequired()) {
      Otp.deleteMany({ email }).catch((otpCleanupErr) => {
        console.warn("Register OTP cleanup failed:", otpCleanupErr?.message || otpCleanupErr);
      });
    }

    const rawVerifyToken = makeRawToken(24);
    user.emailVerifyTokenHash = makeTokenHash(rawVerifyToken);
    user.emailVerifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const sessionId = generateSessionId();
    user.sessions = Array.isArray(user.sessions) ? user.sessions : [];
    user.sessions.push({
      sessionId,
      deviceName: "Current device",
      ip: "",
      userAgent: "",
      createdAt: new Date(),
      lastSeenAt: new Date(),
      revokedAt: null,
    });
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
    } catch (err) {
      // Non-fatal: account should still be created.
      console.warn("verify email send failed:", err?.message || err);
    }

    return {
      user,
      token: generateToken(user._id, user.tokenVersion, sessionId),
    };
  }

  static async login({ emailOrUsername, email, username, password, sessionMeta = {} }) {
    const identifier = sanitizeIdentifier(emailOrUsername || email || username);
    if (!identifier || !password) {
      throw ApiError.badRequest("Email/username and password are required");
    }

    const user = await userRepository
      .findOne({
        $or: [{ email: identifier }, { username: identifier }],
      })
      .select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw ApiError.unauthorized("Invalid credentials");
    }
    if (user.isDeleted) {
      console.warn(`Login blocked: deleted account ${user._id}`);
      throw ApiError.forbidden("Account is deleted");
    }
    if (!user.isActive) {
      console.warn(`Login blocked: inactive account ${user._id}`);
      throw ApiError.forbidden("Account is inactive");
    }
    if (user.isBanned) {
      console.warn(`Login blocked: banned account ${user._id}`);
      throw ApiError.forbidden("Your account is banned");
    }

    const sessionId = generateSessionId();
    user.sessions = Array.isArray(user.sessions) ? user.sessions : [];
    user.sessions.push({
      sessionId,
      deviceName: String(sessionMeta.deviceName || "").slice(0, 180),
      ip: String(sessionMeta.ip || "").slice(0, 180),
      userAgent: String(sessionMeta.userAgent || "").slice(0, 400),
      createdAt: new Date(),
      lastSeenAt: new Date(),
      revokedAt: null,
    });
    if (user.sessions.length > 30) {
      user.sessions = user.sessions.slice(-30);
    }
    user.lastLogin = new Date();
    await user.save();

    return {
      user,
      token: generateToken(user._id, user.tokenVersion, sessionId),
      sessionId,
    };
  }

  static async getProfile(userId) {
    if (!userId) {
      throw ApiError.badRequest("Missing user identifier");
    }

    const user = await userRepository
      .findById(userId)
      .select("_id name username email role avatar cover");
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    const avatar = normalizeMediaValue(user.avatar);
    const cover = normalizeMediaValue(user.cover);
    const payload = user.toObject ? user.toObject() : { ...user };
    payload.displayName = payload.name || "";
    payload.avatar = avatar;
    payload.cover = cover;
    payload.avatarUrl = avatar.url;
    payload.coverUrl = cover.url;
    return payload;
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
    user.sessions = [];
    await user.save();

    return { success: true };
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
    user.sessions = [];
    await user.save();
    return { success: true };
  }

  static async listSessions(userId) {
    const user = await userRepository.findById(userId).select("sessions");
    if (!user) throw ApiError.notFound("User not found");
    return (user.sessions || []).map(formatSession).sort((a, b) => {
      const at = new Date(a.lastSeenAt || a.createdAt || 0).getTime();
      const bt = new Date(b.lastSeenAt || b.createdAt || 0).getTime();
      return bt - at;
    });
  }

  static async revokeSession({ userId, sessionId }) {
    const user = await userRepository.findById(userId).select("sessions");
    if (!user) throw ApiError.notFound("User not found");
    const session = (user.sessions || []).find((entry) => entry.sessionId === sessionId);
    if (!session) throw ApiError.notFound("Session not found");
    session.revokedAt = new Date();
    await user.save();
    return { success: true };
  }

  static async revokeAllSessions({ userId, exceptSessionId = "" }) {
    const user = await userRepository.findById(userId).select("sessions tokenVersion");
    if (!user) throw ApiError.notFound("User not found");
    const now = new Date();
    (user.sessions || []).forEach((entry) => {
      if (!exceptSessionId || entry.sessionId !== exceptSessionId) {
        entry.revokedAt = now;
      }
    });
    user.tokenVersion = (Number(user.tokenVersion) || 0) + 1;
    await user.save();
    return { success: true };
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
