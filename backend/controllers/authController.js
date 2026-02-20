const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Otp = require("../models/Otp");
const sendOtpEmail = require("../utils/sendOtpEmail");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

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
  const email = (req.body.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ message: "Email required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await Otp.deleteMany({ email });
  await Otp.create({ email, otp, expiresAt, verified: false });

  await sendOtpEmail({ email, otp });
  res.json({ message: "OTP sent" });
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

    const requireOtp = process.env.REQUIRE_EMAIL_OTP === "true";
    if (requireOtp) {
      const verified = await Otp.findOne({ email, verified: true });
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

    await Otp.deleteMany({ email });

    return res.status(201).json({
      token: generateToken(user._id),
      user,
    });
  } catch (err) {
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
