const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const connectDB = require("../config/db");
const { getFallbackSchoolPageBySlug } = require("../data/schoolPageFallbacks");
const SchoolPage = require("../models/SchoolPage");
const User = require("../models/User");

const SCHOOL_SLUG = "kurahtechandartsacademy";
const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();

const run = async () => {
  await connectDB();

  try {
    const ownerEmail = normalizeEmail(process.env.KURAH_SCHOOL_OWNER_EMAIL || "");
    const owner = ownerEmail
      ? await User.findOne({ email: ownerEmail }).select("_id").lean()
      : null;
    const fallback = getFallbackSchoolPageBySlug(SCHOOL_SLUG);
    const {
      _id: fallbackId,
      owner: fallbackOwner,
      createdAt,
      updatedAt,
      ...schoolProfile
    } = fallback;
    void fallbackId;
    void fallbackOwner;
    void createdAt;
    void updatedAt;

    const school = await SchoolPage.findOneAndUpdate(
      { slug: SCHOOL_SLUG },
      {
        $set: {
          ...schoolProfile,
          owner: owner?._id || null,
          slug: SCHOOL_SLUG,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    console.log(`School page ready: ${school.schoolName} /${school.slug}`);
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Failed to seed Kurah school page:", error?.message || error);
  process.exit(1);
});
