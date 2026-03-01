const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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

const run = async () => {
  if (
    String(process.env.NODE_ENV || "").toLowerCase() === "production" &&
    String(process.env.ALLOW_ADMIN_PASSWORD_RESET || "").toLowerCase() !== "true"
  ) {
    console.error("resetAdminPassword is blocked in production unless ALLOW_ADMIN_PASSWORD_RESET=true");
    process.exit(1);
  }

  const adminEmail = requiredEnv("ADMIN_EMAIL").toLowerCase();
  const adminPassword = requiredEnv("ADMIN_PASSWORD");

  await connectDB();
  try {
    const user = await User.findOne({ email: adminEmail }).select("_id email");
    if (!user) {
      console.error(`Admin user not found for ${adminEmail}`);
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    await User.collection.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          isActive: true,
          isDeleted: false,
          isBanned: false,
          banReason: "",
          forcePasswordReset: false,
        },
        $unset: {
          bannedAt: "",
          bannedBy: "",
          deletedAt: "",
        },
      }
    );

    console.log(`✅ Admin password reset for ${user.email}`);
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Failed to reset admin password:", error?.message || error);
  process.exit(1);
});
