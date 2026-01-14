const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
  userId: String,
  name: String,
  username: String,
  avatar: String,
  text: String,
  image: String,
  time: {
    type: Date,
    default: Date.now
  },
  likes: [String],

  comments: [
    {
      userId: String,
      name: String,
      username: String,
      text: String,
      time: {
        type: Date,
        default: Date.now
      }
    }
  ]
});

module.exports = mongoose.model("Post", PostSchema);
