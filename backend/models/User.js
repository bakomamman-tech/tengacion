const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { normalizeMediaValue } = require("../utils/userMedia");
const { normalizeAudioPrefs, DEFAULT_WELCOME_VOICE_VOLUME } = require("../utils/audioPrefs");
const { sanitizeCountryValue, sanitizePhoneValue } = require("../utils/profileFields");

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

    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    emailVerifyTokenHash: {
      type: String,
      default: "",
      select: false,
    },

    emailVerifyExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    resetPasswordTokenHash: {
      type: String,
      default: "",
      select: false,
    },

    resetPasswordExpiresAt: {
      type: Date,
      default: null,
      select: false,
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

    status: {
      text: { type: String, default: "", maxlength: 120, trim: true },
      emoji: { type: String, default: "", maxlength: 8, trim: true },
      updatedAt: { type: Date, default: null },
    },

    birthday: {
      day: { type: Number, default: 0, min: 0, max: 31 },
      month: { type: Number, default: 0, min: 0, max: 12 },
      year: { type: Number, default: 0, min: 0, max: 9999 },
      visibility: {
        type: String,
        enum: ["private", "friends", "public"],
        default: "private",
      },
    },

    avatar: {
      type: new mongoose.Schema(
        {
          public_id: { type: String, default: "" },
          url: { type: String, default: "" },
        },
        { _id: false }
      ),
      default: () => ({ public_id: "", url: "" }),
    },

    cover: {
      type: new mongoose.Schema(
        {
          public_id: { type: String, default: "" },
          url: { type: String, default: "" },
        },
        { _id: false }
      ),
      default: () => ({ public_id: "", url: "" }),
    },

    /* ================= ACCOUNT ================= */
    role: {
      type: String,
      enum: ["user", "artist", "admin", "moderator", "super_admin"],
      default: "user",
    },

    isArtist: {
      type: Boolean,
      default: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isBanned: {
      type: Boolean,
      default: false,
      index: true,
    },

    banReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    bannedAt: {
      type: Date,
      default: null,
    },

    bannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    forcePasswordReset: {
      type: Boolean,
      default: false,
    },

    sessions: [
      {
        sessionId: { type: String, required: true, trim: true, index: true },
        deviceName: { type: String, default: "", trim: true, maxlength: 180 },
        ip: { type: String, default: "", trim: true, maxlength: 180 },
        userAgent: { type: String, default: "", trim: true, maxlength: 400 },
        country: { type: String, default: "", trim: true, maxlength: 32 },
        city: { type: String, default: "", trim: true, maxlength: 120 },
        fingerprint: { type: String, default: "", trim: true, maxlength: 128 },
        refreshTokenHash: { type: String, default: "", select: false },
        createdAt: { type: Date, default: Date.now },
        lastSeenAt: { type: Date, default: Date.now },
        revokedAt: { type: Date, default: null },
      },
    ],

    tokenVersion: {
      type: Number,
      default: 0,
    },

    twoFactor: {
      enabled: {
        type: Boolean,
        default: false,
      },
      method: {
        type: String,
        enum: ["none", "totp", "email"],
        default: "none",
      },
      setupPending: {
        type: Boolean,
        default: false,
      },
      secretCipher: {
        type: String,
        default: "",
        select: false,
      },
      pendingSecretCipher: {
        type: String,
        default: "",
        select: false,
      },
      enabledAt: {
        type: Date,
        default: null,
      },
      lastVerifiedAt: {
        type: Date,
        default: null,
      },
    },

    trustedDevices: [
      {
        fingerprint: { type: String, required: true, trim: true, maxlength: 128 },
        deviceName: { type: String, default: "", trim: true, maxlength: 180 },
        userAgent: { type: String, default: "", trim: true, maxlength: 400 },
        firstSeenAt: { type: Date, default: Date.now },
        lastSeenAt: { type: Date, default: Date.now },
        lastIp: { type: String, default: "", trim: true, maxlength: 180 },
        lastCountry: { type: String, default: "", trim: true, maxlength: 32 },
      },
    ],

    lastLogin: Date,

    lastLoginAt: {
      type: Date,
      default: null,
      index: true,
    },

    lastSeenAt: {
      type: Date,
      default: null,
      index: true,
    },

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

    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    blocks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    mutes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    restricts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    hiddenStoriesFrom: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    privacy: {
      profileVisibility: {
        type: String,
        enum: ["public", "friends", "private"],
        default: "public",
      },
      defaultPostAudience: {
        type: String,
        enum: ["public", "friends", "close_friends"],
        default: "friends",
      },
      allowMessagesFrom: {
        type: String,
        enum: ["everyone", "friends", "no_one"],
        default: "everyone",
      },
    },

    notificationPrefs: {
      likes: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      follows: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      reports: { type: Boolean, default: true },
      system: { type: Boolean, default: true },
    },

    audioPrefs: {
      type: new mongoose.Schema(
        {
          welcomeVoiceEnabled: { type: Boolean, default: true },
          welcomeVoiceVolume: {
            type: Number,
            default: DEFAULT_WELCOME_VOICE_VOLUME,
            min: 0,
            max: 0.45,
          },
        },
        { _id: false }
      ),
      default: () => normalizeAudioPrefs(),
    },

    onboarding: {
      completed: { type: Boolean, default: false },
      steps: {
        avatar: { type: Boolean, default: false },
        bio: { type: Boolean, default: false },
        interests: { type: Boolean, default: false },
        followSuggestions: { type: Boolean, default: false },
      },
    },

    interests: [{ type: String, default: "", trim: true, maxlength: 50 }],

    closeFriends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    badges: [
      {
        key: { type: String, required: true, trim: true, maxlength: 80 },
        label: { type: String, required: true, trim: true, maxlength: 160 },
        earnedAt: { type: Date, default: Date.now },
      },
    ],

    streaks: {
      checkIn: {
        count: { type: Number, default: 0, min: 0 },
        lastCheckInAt: { type: Date, default: null },
      },
    },

    achievementsStats: {
      posts: { type: Number, default: 0, min: 0 },
      comments: { type: Number, default: 0, min: 0 },
      reactions: { type: Number, default: 0, min: 0 },
      followers: { type: Number, default: 0, min: 0 },
    },
  },
  {
    timestamps: true, // replaces joined
  }
);

/* ================= INDEXES ================= */
UserSchema.index({ username: "text", name: "text" });

/* ================= HOOKS ================= */
UserSchema.pre("save", async function () {
  const canNormalizeAvatar =
    this.isNew ||
    this.isModified("avatar") ||
    (typeof this.isSelected === "function" && this.isSelected("avatar"));
  const canNormalizeCover =
    this.isNew ||
    this.isModified("cover") ||
    (typeof this.isSelected === "function" && this.isSelected("cover"));
  const canNormalizeAudioPrefs =
    this.isNew ||
    this.isModified("audioPrefs") ||
    (typeof this.isSelected === "function" && this.isSelected("audioPrefs"));

  // Avoid wiping media when saving partially selected documents (e.g. auth session touch).
  if (canNormalizeAvatar) {
    this.avatar = normalizeMediaValue(this.avatar);
  }
  if (canNormalizeCover) {
    this.cover = normalizeMediaValue(this.cover);
  }
  if (canNormalizeAudioPrefs) {
    this.audioPrefs = normalizeAudioPrefs(this.audioPrefs);
  }

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
  obj.phone = sanitizePhoneValue(obj.phone);
  obj.country = sanitizeCountryValue(obj.country);
  obj.avatar = normalizeMediaValue(obj.avatar);
  obj.cover = normalizeMediaValue(obj.cover);
  obj.audioPrefs = normalizeAudioPrefs(obj.audioPrefs);
  return obj;
};

module.exports = mongoose.model("User", UserSchema);
