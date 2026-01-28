const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Otp = require("../models/Otp");
const sendOtpEmail = require("../utils/sendOtpEmail");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

/* ✅ 1) Check Username Availability */
const checkUsername = async (req, res) => {
  try {
    const username = (req.query.username || "").trim().toLowerCase();

    if (!username || username.length < 3) {
      return res
        .status(400)
        .json({ available: false, message: "Username too short" });
    }

    const valid = /^[a-zA-Z0-9._]+$/.test(username);
    if (!valid) {
      return res.status(400).json({
        available: false,
        message: "Only letters, numbers, dots and underscores are allowed",
      });
    }

    const exists = await User.findOne({ username });
    if (exists) {
      return res
        .status(200)
        .json({ available: false, message: "Username is taken" });
    }

    return res
      .status(200)
      .json({ available: true, message: "Username is available" });
  } catch (err) {
    return res.status(500).json({ available: false, message: "Server error" });
  }
};

/* ✅ 2) Request OTP */
const requestOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const cleanEmail = email.trim().toLowerCase();

    // generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // expire in 10 mins
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // delete previous OTP for this email
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
    console.error("requestOtp error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};

/* ✅ 3) Verify OTP */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const code = otp.trim();

    const record = await Otp.findOne({ email: cleanEmail, otp: code });

    if (!record) return res.status(400).json({ message: "Invalid OTP" });

    if (record.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    record.verified = true;
    await record.save();

    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (err) {
    console.error("verifyOtp error:", err);
    return res.status(500).json({ message: "OTP verification failed" });
  }
};

/* ✅ 4) Register (Only allow if OTP verified) */
const registerUser = async (req, res) => {
  try {
    const { name, username, email, password, phone, country, dob, gender } =
      req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    // ✅ OTP must be verified
    const verifiedOtp = await Otp.findOne({ email: cleanEmail, verified: true });
    if (!verifiedOtp) {
      return res
        .status(401)
        .json({ message: "Email not verified. Please verify OTP." });
    }

    // prevent duplicates
    const existsEmail = await User.findOne({ email: cleanEmail });
    if (existsEmail)
      return res.status(400).json({ message: "Email already exists" });

    const existsUser = await User.findOne({ username: cleanUsername });
    if (existsUser)
      return res.status(400).json({ message: "Username already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      username: cleanUsername,
      email: cleanEmail,
      phone,
      country,
      dob,
      gender,
      password: hashed,
      isVerified: true,
    });

    // clean OTP after success
    await Otp.deleteMany({ email: cleanEmail });

    const token = generateToken(user._id);

    return res.status(201).json({
      message: "Registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar?.url || "",
      },
    });
  } catch (err) {
    console.error("registerUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ✅ 5) Resend OTP */
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const cleanEmail = email.trim().toLowerCase();

    // generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // expire in 10 mins
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // delete previous OTP for this email
    await Otp.deleteMany({ email: cleanEmail });

    await Otp.create({
      email: cleanEmail,
      otp,
      expiresAt,
      verified: false,
    });

    await sendOtpEmail({ email: cleanEmail, otp });

    return res.status(200).json({ message: "OTP resent successfully" });
  } catch (err) {
    console.error("resendOtp error:", err);
    return res.status(500).json({ message: "Failed to resend OTP" });
  }
};

/* ✅ 6) Login User */
const loginUser = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({
        message: "Email/Username and password are required",
      });
    }

    const input = emailOrUsername.trim().toLowerCase();

    // login via email OR username
    const user = await User.findOne({
      $or: [{ email: input }, { username: input }],
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // if you want to block login until verified:
    if (!user.isVerified) {
      return res.status(401).json({
        message: "Account not verified. Please verify OTP first.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      message: "Login successful ✅",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar?.url || "",
      },
    });
  } catch (err) {
    console.error("loginUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  checkUsername,
  requestOtp,
  resendOtp,
  verifyOtp,
  registerUser,
  loginUser,
};
