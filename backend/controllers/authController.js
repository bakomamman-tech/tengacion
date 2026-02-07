const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Otp = require("../models/Otp");
const sendOtpEmail = require("../utils/sendOtpEmail");

/* ================= HELPERS ================= */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

/* ================= 1️⃣ CHECK USERNAME ================= */
exports.checkUsername = async (req, res) => {
  try {
    const username = (req.query.username || "").trim().toLowerCase();

    if (!username || username.length < 3) {
      return res
        .status(400)
        .json({ available: false, message: "Username too short" });
    }

    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      return res.status(400).json({
        available: false,
        message: "Only letters, numbers, dots and underscores allowed",
      });
    }

    const exists = await User.findOne({ username });
    return res.status(200).json({
      available: !exists,
      message: exists ? "Username is taken" : "Username is available",
    });
  } catch (err) {
    return res.status(500).json({ available: false, message: "Server error" });
  }
};

/* ================= 2️⃣ REQUEST OTP ================= */
exports.requestOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const cleanEmail = email.trim().toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.deleteMany({ email: cleanEmail });

    await Otp.create({
      email: cleanEmail,
      otp,
      expiresAt,
      verified: false,
    });

    await sendOtpEmail({ email: cleanEmail, otp });

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("requestOtp:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};

/* ================= 3️⃣ VERIFY OTP ================= */
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP required" });
    }

    const record = await Otp.findOne({
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
    });

    if (!record) return res.status(400).json({ message: "Invalid OTP" });
    if (record.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    record.verified = true;
    await record.save();

    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (err) {
    console.error("verifyOtp:", err);
    return res.status(500).json({ message: "OTP verification failed" });
  }
};

/* ================= 4️⃣ REGISTER ================= */
exports.register = async (req, res) => {
  try {
    const { name, username, email, password, phone, country, dob, gender } =
      req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    const otpVerified = await Otp.findOne({
      email: cleanEmail,
      verified: true,
    });

    if (!otpVerified) {
      return res
        .status(401)
        .json({ message: "Email not verified. Verify OTP first." });
    }

    const exists = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }],
    });

    if (exists) {
      return res
        .status(400)
        .json({ message: "Email or username already exists" });
    }

    const user = await User.create({
      name,
      username: cleanUsername,
      email: cleanEmail,
      password, // 🔐 hashed by model hook
      phone,
      country,
      dob,
      gender,
      isVerified: true,
    });

    await Otp.deleteMany({ email: cleanEmail });

    const token = generateToken(user._id);

    return res.status(201).json({
      message: "Registration successful",
      token,
      user,
    });
  } catch (err) {
    console.error("register:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ================= 5️⃣ LOGIN ================= */
exports.login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res
        .status(400)
        .json({ message: "Email/Username and password required" });
    }

    const input = emailOrUsername.trim().toLowerCase();

    const user = await User.findOne({
      $or: [{ email: input }, { username: input }],
    }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Account not verified",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Account suspended",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    return res.status(200).json({
      message: "Login successful",
      token,
      user,
    });
  } catch (err) {
    console.error("login:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
