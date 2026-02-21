const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
      minlength: 3,
      maxlength: 30,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
      index: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false, // never return password
    },

    /* ================= PROFILE ================= */
    phone: { type: String, default: "" },

    country: { type: String, default: "" },

    dob: {
      type: Date,
      default: null,
    },

    bio: {
      type: String,
      maxlength: 300,
      default: "",
    },

    currentCity: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    hometown: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    workplace: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },

    education: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },

    website: {
      type: String,
      default: "",
      trim: true,
      maxlength: 220,
    },

    gender: { type: String, default: "" },

    pronouns: { type: String, default: "" },

    avatar: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },

    cover: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },

    /* ================= ACCOUNT ================= */
    role: {
      type: String,
      enum: ["user", "admin", "moderator"],
      default: "user",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: Date,

    passwordChangedAt: Date,

    joined: {
      type: Date,
      default: Date.now,
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
    timestamps: true, // replaces joined
  }
);

/* ================= INDEXES ================= */
UserSchema.index({ username: "text", name: "text" });

/* ================= HOOKS ================= */
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = Date.now() - 1000;
});

/* ================= METHODS ================= */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  if (typeof obj.phone === "string" && obj.phone.startsWith("tmp_phone_")) {
    obj.phone = "";
  }
  if (typeof obj.country === "string" && obj.country.startsWith("tmp_country_")) {
    obj.country = "";
  }
  if (obj.avatar && typeof obj.avatar === "object") {
    obj.avatar = obj.avatar.url || "";
  }
  if (obj.cover && typeof obj.cover === "object") {
    obj.cover = obj.cover.url || "";
  }
  return obj;
};

module.exports = mongoose.model("User", UserSchema);
