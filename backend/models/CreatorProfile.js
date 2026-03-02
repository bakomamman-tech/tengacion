const mongoose = require("mongoose");

const CreatorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    bio: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    coverImageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    links: [
      {
        label: { type: String, trim: true, maxlength: 60 },
        url: { type: String, trim: true, maxlength: 500 },
      },
    ],
    isCreator: {
      type: Boolean,
      default: true,
      index: true,
    },
    onboardingComplete: {
      type: Boolean,
      default: false,
      index: true,
    },
    heroBannerUrl: {
      type: String,
      default: "",
      trim: true,
    },
    tagline: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    genres: [
      {
        type: String,
        trim: true,
        maxlength: 60,
      },
    ],
    paymentModeDefault: {
      type: String,
      enum: ["NG", "GLOBAL"],
      default: "NG",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CreatorProfile", CreatorProfileSchema);
