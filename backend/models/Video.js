const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema({
  userId: String,
  name: String,
  username: String,
  avatar: String,

  videoUrl: String,   // uploaded OR link
  coverImageUrl: { type: String, default: "" },
  caption: String,
  durationSec: { type: Number, default: 0 },
  viewsCount: { type: Number, default: 0 },
  price: { type: Number, default: 0, min: 0 },
  priceGlobal: { type: Number, default: 0, min: 0 },
  isFree: { type: Boolean, default: true },
  creatorProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CreatorProfile",
    default: null,
    index: true,
  },

  likes: [String],
  comments: [
    {
      userId: String,
      name: String,
      text: String
    }
  ],

  time: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Video", VideoSchema);
