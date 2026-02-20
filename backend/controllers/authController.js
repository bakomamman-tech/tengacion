const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Otp = require("../models/Otp");
const sendOtpEmail = require("../utils/sendOtpEmail");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const isOtpRequired = () => process.env.REQUIRE_EMAIL_OTP === "true";

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

    // Password is hashed by the User model pre-save hook.
    const user = await User.create({
      name: displayName,
      username,
      email,
      password,
      isVerified: true,
    });

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
    if (err?.code === 11000 && err?.keyPattern) {
      const field = Object.keys(err.keyPattern)[0];
      if (field === "email") {
        return res.status(409).json({ message: "Email already registered" });
      }
      if (field === "username") {
        return res.status(409).json({ message: "Username already taken" });
      }
      return res.status(409).json({ message: "Duplicate value" });
    }

    if (err?.name === "ValidationError") {
      const firstError = Object.values(err.errors || {})[0];
      return res.status(400).json({
        message: firstError?.message || "Invalid registration data",
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
