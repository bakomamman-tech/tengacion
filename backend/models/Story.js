const mongoose = require("mongoose");

const StorySchema = new mongoose.Schema({
  userId: String,
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  },
  name: String,
  username: String,
  avatar: String,
  image: String,
  media: {
    url: { type: String, default: "" },
    public_id: { type: String, default: "" },
    type: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
  },
  mediaUrl: String,
  mediaType: {
    type: String,
    enum: ["image", "video"],
    default: "image",
  },
  thumbnailUrl: String,
  text: String,
  visibility: {
    type: String,
    enum: ["public", "friends", "close_friends"],
    default: "friends",
    index: true,
  },
  reactions: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
      emoji: { type: String, default: "", maxlength: 8, trim: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  replies: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      text: { type: String, default: "", trim: true, maxlength: 600 },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  time: { type: Date, default: Date.now },

  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
  },

  seenBy: [String],
});

StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Story", StorySchema);
