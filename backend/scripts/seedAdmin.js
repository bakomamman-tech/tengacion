const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const connectDB = require("../config/db");
const User = require("../models/User");

const requiredEnv = (key) => {
  const value = String(process.env[key] || "").trim();
  if (!value) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
  return value;
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const toUsernameBase = (email) =>
  String(email || "")
    .toLowerCase()
    .split("@")[0]
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 20) || "admin";

const ensureUniqueUsername = async (base) => {
  const normalizedBase = (base || "admin").slice(0, 24);
  let candidate = normalizedBase.length >= 3 ? normalizedBase : "admin_user";
  let attempt = 0;

  while (attempt < 20) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.exists({ username: candidate });
    if (!exists) return candidate;
    attempt += 1;
    candidate = `${normalizedBase}_${attempt}`.slice(0, 30);
  }

  return `admin_${Date.now().toString().slice(-6)}`;
};

const run = async () => {
  const email = normalizeEmail(requiredEnv("ADMIN_EMAIL"));
  const password = requiredEnv("ADMIN_PASSWORD");
  const displayName = String(process.env.ADMIN_DISPLAY_NAME || "Tengacion Admin").trim();

  await connectDB();

  try {
    let user = await User.findOne({ email }).select("+password");

    if (!user) {
      const username = await ensureUniqueUsername(toUsernameBase(email));
      user = await User.create({
        name: displayName || "Tengacion Admin",
        username,
        email,
        password, // hashed by User pre-save hook
        role: "super_admin",
        isVerified: true,
        isActive: true,
        isBanned: false,
        isDeleted: false,
      });

      console.log(`✅ Admin ready: ${email} role=${user.role}`);
      return;
    }

    let changed = false;
    const setPayload = {};
    const unsetPayload = {};

    if (!["admin", "super_admin"].includes(String(user.role || "").toLowerCase())) {
      setPayload.role = "super_admin";
      changed = true;
    }
    if (!user.isActive) {
      setPayload.isActive = true;
      changed = true;
    }
    if (user.isBanned) {
      setPayload.isBanned = false;
      setPayload.banReason = "";
      unsetPayload.bannedAt = "";
      unsetPayload.bannedBy = "";
      changed = true;
    }
    if (user.isDeleted) {
      setPayload.isDeleted = false;
      unsetPayload.deletedAt = "";
      changed = true;
    }
    if (!String(user.name || "").trim()) {
      setPayload.name = displayName || "Tengacion Admin";
      changed = true;
    }

    if (changed) {
      const update = { $set: setPayload };
      if (Object.keys(unsetPayload).length > 0) {
        update.$unset = unsetPayload;
      }
      await User.collection.updateOne({ _id: user._id }, update);
      user = await User.findById(user._id).lean();
    }

    console.log(`✅ Admin ready: ${email} role=${user.role}`);
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Failed to seed admin account:", error?.message || error);
  process.exit(1);
});
