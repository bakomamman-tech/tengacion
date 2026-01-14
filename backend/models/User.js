const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    username: { type: String, required: true, unique: true, trim: true },

    email: { type: String, required: true, unique: true, lowercase: true },

    password: { type: String, required: true },

    phone: { type: String, default: "" },

    country: { type: String, default: "" },

    dob: { type: String, default: "" },

    /* ================= PROFILE ================= */

    avatar: {
      type: String,
      default: "" // /uploads/filename.jpg
    },

    cover: {
      type: String,
      default: ""
    },

    bio: {
      type: String,
      default: ""
    },

    gender: {
      type: String,
      default: ""
    },

    pronouns: {
      type: String,
      default: ""
    },

    joined: {
      type: Date,
      default: Date.now
    },

    /* ================= SOCIAL ================= */

    followers: {
      type: [String],
      default: []
    },

    following: {
      type: [String],
      default: []
    },

    friends: {
      type: [String],
      default: []
    },

    friendRequests: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", UserSchema);
