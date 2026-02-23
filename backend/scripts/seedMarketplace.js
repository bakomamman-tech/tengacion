require("dotenv").config();
require("../config/env");

const connectDB = require("../config/db");
const User = require("../models/User");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const Book = require("../models/Book");
const Chapter = require("../models/Chapter");

const run = async () => {
  await connectDB();

  const seedEmail = (process.env.SEED_CREATOR_EMAIL || "creator@tengacion.dev")
    .trim()
    .toLowerCase();
  const seedPassword = process.env.SEED_CREATOR_PASSWORD || "Password123!";
  const seedUsernameBase = (process.env.SEED_CREATOR_USERNAME || "creator_mvp")
    .trim()
    .toLowerCase();
  const seedDisplayName = (process.env.SEED_CREATOR_DISPLAY_NAME || "Tengacion Creator").trim();

  let user = await User.findOne({ email: seedEmail });
  if (!user) {
    const suffix = Date.now().toString().slice(-4);
    user = await User.create({
      name: seedDisplayName,
      username: `${seedUsernameBase}_${suffix}`,
      email: seedEmail,
      password: seedPassword,
      isVerified: true,
    });
    console.log(`Created seed user: ${user.email}`);
  } else {
    console.log(`Using existing seed user: ${user.email}`);
  }

  const creatorProfile = await CreatorProfile.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        displayName: seedDisplayName,
        bio: "Sample creator profile seeded for Chat + Creator Marketplace MVP.",
        coverImageUrl:
          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
        links: [
          { label: "Instagram", url: "https://instagram.com/tengacion" },
          { label: "YouTube", url: "https://youtube.com/@tengacion" },
        ],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const track = await Track.findOneAndUpdate(
    { creatorId: creatorProfile._id, title: "Midnight Echoes (Sample)" },
    {
      $set: {
        description: "Sample paid track with preview URL for MVP testing.",
        price: 2500,
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        durationSec: 180,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const book = await Book.findOneAndUpdate(
    { creatorId: creatorProfile._id, title: "The Quiet Signal (Sample)" },
    {
      $set: {
        description:
          "Sample book with free and locked chapters for MVP paywall testing.",
        price: 5000,
        coverImageUrl:
          "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Chapter.findOneAndUpdate(
    { bookId: book._id, order: 1 },
    {
      $set: {
        title: "Chapter 1 - The Call",
        content:
          "This is a free sample chapter. Readers can preview this section before buying the full book.",
        isFree: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Chapter.findOneAndUpdate(
    { bookId: book._id, order: 2 },
    {
      $set: {
        title: "Chapter 2 - Hidden Rooms",
        content:
          "This chapter is locked in the MVP flow. Purchase unlocks all paid chapters instantly.",
        isFree: false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log("Seed complete:");
  console.log(`CreatorProfile: ${creatorProfile._id}`);
  console.log(`Track: ${track._id}`);
  console.log(`Book: ${book._id}`);

  process.exit(0);
};

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
