const mongoose = require("mongoose");

const AlbumSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    coverUrl: { type: String, default: "", trim: true },
    price: { type: Number, default: 0 },
    currency: { type: String, default: "NGN" },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tracks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Track",
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Album", AlbumSchema);
