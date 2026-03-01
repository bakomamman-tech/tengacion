const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const { config } = require("../config/env");
const userRepository = require("../repositories/userRepository");
const Otp = require("../../../backend/models/Otp");
const sendOtpEmail = require("../../../backend/utils/sendOtpEmail");

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
  if (field === "avatar") return `tmp_avatar_${stamp}`;
  if (field === "cover") return `tmp_cover_${stamp}`;
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

  const legacyDoc = {
    ...shared,
    dob: dob || "",
    avatar: "",
    cover: "",
  };

  const variants = [modernDoc, legacyDoc];
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

const generateToken = (id, tokenVersion = 0) =>
  jwt.sign({ id, tv: Number(tokenVersion) || 0 }, config.JWT_SECRET, { expiresIn: "7d" });

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

    return {
      user,
      token: generateToken(user._id, user.tokenVersion),
    };
  }

  static async login({ emailOrUsername, email, username, password }) {
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

    return {
      user,
      token: generateToken(user._id, user.tokenVersion),
    };
  }

  static async getProfile(userId) {
    if (!userId) {
      throw ApiError.badRequest("Missing user identifier");
    }

    const user = await userRepository.findById(userId).select("-password");
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    return user;
  }
}

module.exports = AuthService;
