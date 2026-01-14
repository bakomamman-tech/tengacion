const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  username: { type: String, unique: true },
  email: { type: String, unique: true },
  password: String,
  phone: String,
  country: String,
  dob: String,

  avatar: String,
  cover: String,
  bio: String,
  gender: String,
  pronouns: String,
  joined: String,

  followers: [String],
  following: [String],
  friends: [String],
  friendRequests: [String]
});

module.exports = mongoose.model("User", UserSchema);
