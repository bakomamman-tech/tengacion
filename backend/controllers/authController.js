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
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await Otp.deleteMany({ email });
  await Otp.create({ email, otp, expiresAt, verified: false });

  await sendOtpEmail({ email, otp });
  res.json({ message: "OTP sent" });
};

/* ================= VERIFY OTP ================= */
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

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
  const { name, username, email, password } = req.body;

  const verified = await Otp.findOne({ email, verified: true });
  if (!verified) {
    return res.status(401).json({ message: "Email not verified" });
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    username,
    email,
    password: hashed,
    isVerified: true,
  });

  await Otp.deleteMany({ email });

  res.status(201).json({
    token: generateToken(user._id),
    user,
  });
};

/* ================= LOGIN ================= */
exports.login = async (req, res) => {
  const { emailOrUsername, password } = req.body;

  const user = await User.findOne({
    $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
  }).select("+password");

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  res.json({
    token: generateToken(user._id),
    user,
  });
};
