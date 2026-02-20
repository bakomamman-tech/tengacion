const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Otp = require("../models/Otp");
const sendOtpEmail = require("../utils/sendOtpEmail");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const isOtpRequired = () => process.env.REQUIRE_EMAIL_OTP === "true";

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

const legacyFallbackValue = (field) => {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (field === "phone") return `tmp_${stamp}`;
  if (field === "country") return `tmp_${stamp}`;
  if (field === "joined") return new Date();
  return null;
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

/* ================= CHECK USERNAME ================= */
exports.checkUsername = async (req, res) => {
  const username = (req.query.username || "").toLowerCase().trim();
  if (!username || username.length < 3) {
    return res.status(400).json({ available: false });
  }

  const exists = await User.findOne({ username });
  res.json({ available: !exists });
};

/* ================= REQUEST OTP ================= */
exports.requestOtp = async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(503).json({
        message: "Email verification is not configured",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.deleteMany({ email });
    await Otp.create({ email, otp, expiresAt, verified: false });
    await sendOtpEmail({ email, otp });

    return res.json({ message: "OTP sent" });
  } catch (err) {
    console.error("Request OTP error:", err);
    return res.status(503).json({
      message: "Email verification is temporarily unavailable",
    });
  }
};

/* ================= VERIFY OTP ================= */
exports.verifyOtp = async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const otp = (req.body.otp || "").trim();

  const record = await Otp.findOne({ email, otp });
  if (!record || record.expiresAt < new Date()) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  record.verified = true;
  await record.save();

  res.json({ message: "OTP verified" });
};

/* ================= REGISTER ================= */
exports.register = async (req, res) => {
  try {
    const rawName = (req.body.name || "").trim();
    const username = (req.body.username || "").trim().toLowerCase();
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    const [usernameExists, emailExists] = await Promise.all([
      User.exists({ username }),
      User.exists({ email }),
    ]);

    if (usernameExists) {
      return res.status(409).json({ message: "Username already taken" });
    }

    if (emailExists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const requireOtp = isOtpRequired();
    if (requireOtp) {
      let verified;
      try {
        verified = await Otp.findOne({ email, verified: true });
      } catch (otpErr) {
        console.error("Register OTP lookup error:", otpErr);
        return res.status(503).json({
          message: "Email verification service unavailable",
        });
      }

      if (!verified) {
        return res.status(401).json({ message: "Email not verified" });
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
    };

    const phone = (req.body.phone || "").trim();
    const country = (req.body.country || "").trim();
    if (phone) baseUserData.phone = phone;
    if (country) baseUserData.country = country;

    let user;
    try {
      // Password is hashed by the User model pre-save hook.
      user = await User.create(baseUserData);
    } catch (createErr) {
      const duplicateField = extractDuplicateField(createErr);
      const hasExplicitValue =
        Object.prototype.hasOwnProperty.call(baseUserData, duplicateField);
      const fallback = legacyFallbackValue(duplicateField);

      if (
        createErr?.code === 11000 &&
        duplicateField &&
        !hasExplicitValue &&
        fallback !== null
      ) {
        user = await User.create({
          ...baseUserData,
          [duplicateField]: fallback,
        });
      } else {
        throw createErr;
      }
    }

    if (requireOtp) {
      try {
        await Otp.deleteMany({ email });
      } catch (otpCleanupErr) {
        console.warn("Register OTP cleanup failed:", otpCleanupErr.message);
      }
    }

    return res.status(201).json({
      token: generateToken(user._id),
      user,
    });
  } catch (err) {
    if (err?.code === 11000) {
      const field = extractDuplicateField(err);
      if (field === "email") {
        return res.status(409).json({ message: "Email already registered" });
      }
      if (field === "username") {
        return res.status(409).json({ message: "Username already taken" });
      }
      return res.status(409).json({
        message: field ? `Duplicate ${field} value` : "Duplicate value",
      });
    }

    if (err?.name === "ValidationError") {
      const firstError = Object.values(err.errors || {})[0];
      return res.status(400).json({
        message: firstError?.message || "Invalid registration data",
      });
    }

    if (err?.name === "MongoServerError") {
      const code = err.code || 0;

      if (code === 121) {
        return res.status(400).json({
          message: "Registration rejected by database validation",
          code,
          detail: summarizeMongoDetails(err),
        });
      }

      return res.status(500).json({
        message: "Registration database write failed",
        code,
      });
    }

    console.error("Register error:", err);
    return res.status(500).json({ message: "Registration failed" });
  }
};

/* ================= LOGIN ================= */
exports.login = async (req, res) => {
  const identifier = (req.body.emailOrUsername || "").trim().toLowerCase();
  const password = req.body.password || "";

  const user = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  }).select("+password");

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  res.json({
    token: generateToken(user._id),
    user,
  });
};
