const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema({
  userId: String,
  name: String,
  username: String,
  avatar: String,

  videoUrl: String,   // uploaded OR link
  caption: String,

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
