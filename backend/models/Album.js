const mongoose = require("mongoose");

const AlbumTrackSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    trackUrl: {
      type: String,
      required: true,
      trim: true,
    },
    previewUrl: {
      type: String,
      default: "",
      trim: true,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const AlbumSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorProfile",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    description: {
      type: String,
      default: "",
      maxlength: 4000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    coverUrl: {
      type: String,
      required: true,
      trim: true,
    },
    tracks: {
      type: [AlbumTrackSchema],
      default: [],
      validate: {
        validator: (tracks) => Array.isArray(tracks) && tracks.length >= 1 && tracks.length <= 25,
        message: "Album must have between 1 and 25 tracks",
      },
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
      index: true,
    },
    totalTracks: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Album", AlbumSchema);
