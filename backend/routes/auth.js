const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

/* ================= UTIL ================= */

const sanitizeUser = (user) => {
  const obj = user.toObject();
  delete obj.password;
  return obj;
};

const signToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
};

/* ================= REGISTER ================= */

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      username,
      email,
      password,
      phone,
      country,
      dob
    } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({
        error: "Email, username and password are required"
      });
    }

    const exists = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (exists) {
      return res.status(409).json({
        error: "Email or username already in use"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      username,
      email,
      password: hashedPassword,
      phone,
      country,
      dob,
      avatar: "",
      joined: new Date()
    });

    const token = signToken(user._id);

    return res.status(201).json({
      token,
      user: sanitizeUser(user)
    });

  } catch (err) {
    console.error("REGISTER:", err);
    return res.status(500).json({
      error: "Registration failed"
    });
  }
});

/* ================= LOGIN ================= */

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required"
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    const token = signToken(user._id);

    return res.json({
      token,
      user: sanitizeUser(user)
    });

  } catch (err) {
    console.error("LOGIN:", err);
    return res.status(500).json({
      error: "Login failed"
    });
  }
});

/* ================= CURRENT USER ================= */
/* Protected via middleware */

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    return res.json(sanitizeUser(user));

  } catch (err) {
    console.error("ME:", err);
    return res.status(500).json({
      error: "Failed to fetch user"
    });
  }
});

module.exports = router;
