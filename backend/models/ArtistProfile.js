const mongoose = require("mongoose");

const platformLinksSchema = new mongoose.Schema(
  {
    spotify: { type: String, trim: true, default: "" },
    instagram: { type: String, trim: true, default: "" },
    facebook: { type: String, trim: true, default: "" },
    tiktok: { type: String, trim: true, default: "" },
    youtube: { type: String, trim: true, default: "" },
    appleMusic: { type: String, trim: true, default: "" },
    audiomack: { type: String, trim: true, default: "" },
    boomplay: { type: String, trim: true, default: "" },
    website: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const customLinkSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    url: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const ArtistProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    displayName: { type: String, trim: true, maxlength: 120 },
    bio: { type: String, default: "", maxlength: 2000 },
    links: { type: platformLinksSchema, default: () => ({}) },
    customLinks: { type: [customLinkSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ArtistProfile", ArtistProfileSchema);
