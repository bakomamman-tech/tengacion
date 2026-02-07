const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    /* ================= IDENTITY ================= */
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      select: false, // 🔐 never return password by default
    },

    /* ================= PROFILE ================= */
    phone: { type: String, default: "" },

    country: { type: String, default: "" },

    dob: {
      type: Date,
      default: null,
    },

    avatar: {
      type: String,
      default: "",
    },

    cover: {
      type: String,
      default: "",
    },

    bio: {
      type: String,
      default: "",
      maxlength: 300,
    },

    gender: {
      type: String,
      default: "",
    },

    pronouns: {
      type: String,
      default: "",
    },

    joined: {
      type: Date,
      default: Date.now,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    /* ================= SOCIAL ================= */
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    friendRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

/* ================= INDEXES ================= */

// Fast search
UserSchema.index({ username: "text", name: "text" });

// Clean JSON output
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", UserSchema);
