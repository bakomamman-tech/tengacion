/* =====================================================
   🔐 CREATE ADMIN USER SCRIPT
===================================================== */

require("dotenv").config({ path: "../.env" });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Otp = require("../models/Otp");

async function createAdmin() {
  try {
    // Connect to MongoDB
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    // Admin credentials
    const adminData = {
      name: "Admin User",
      username: "admin",
      email: "admin@tengacion.com",
      password: "Admin@123456",
      phone: "+1234567890",
      country: "USA",
      bio: "Administrator of Tengacion",
      isVerified: true,
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      $or: [{ username: adminData.username }, { email: adminData.email }],
    });

    if (existingAdmin) {
      console.log("⚠️  Admin user already exists!");
      console.log(`Email: ${existingAdmin.email}`);
      console.log(`Username: ${existingAdmin.username}`);
      await mongoose.disconnect();
      return;
    }

    // Hash password
    console.log("🔐 Hashing password...");
    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    // Create admin user
    console.log("👤 Creating admin user...");
    const admin = await User.create({
      ...adminData,
      password: hashedPassword,
    });

    console.log("\n✅ ADMIN USER CREATED SUCCESSFULLY!\n");
    console.log("=" * 50);
    console.log("📋 ADMIN LOGIN CREDENTIALS:");
    console.log("=" * 50);
    console.log(`📧 Email:    ${adminData.email}`);
    console.log(`👤 Username: ${adminData.username}`);
    console.log(`🔑 Password: ${adminData.password}`);
    console.log("=" * 50);
    console.log("\nUser ID:", admin._id);
    console.log("Created at:", admin.joined);
    console.log("\n💡 Use these credentials to login at http://localhost:3000\n");

    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  } catch (err) {
    console.error("❌ Error creating admin:", err.message);
    process.exit(1);
  }
}

// Run the script
createAdmin();
