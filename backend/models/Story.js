const mongoose = require("mongoose");

const StorySchema = new mongoose.Schema({
  userId: String,
  name: String,
  username: String,
  avatar: String,
  image: String,
  mediaUrl: String,
  mediaType: {
    type: String,
    enum: ["image", "video"],
    default: "image"
  },
  thumbnailUrl: String,
  text: String,
  time: { type: Date, default: Date.now },

  // NEW
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  },

  seenBy: [String]
});

StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Story", StorySchema);
