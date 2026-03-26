const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema({
  userId: String,
  name: String,
  username: String,
  avatar: String,

  videoUrl: String,   // uploaded OR link
  coverImageUrl: { type: String, default: "" },
  caption: String,
  description: { type: String, default: "" },
  durationSec: { type: Number, default: 0 },
  videoFormat: { type: String, default: "" },
  viewsCount: { type: Number, default: 0 },
  price: { type: Number, default: 0, min: 0 },
  priceGlobal: { type: Number, default: 0, min: 0 },
  isFree: { type: Boolean, default: true },
  previewClipUrl: { type: String, default: "" },
  isPublished: { type: Boolean, default: true, index: true },
  visibility: {
    type: String,
    enum: ["private", "public", "blocked"],
    default: "private",
    index: true,
  },
  creatorCategory: {
    type: String,
    enum: ["music", "books", "podcasts"],
    default: "music",
    index: true,
  },
  contentType: {
    type: String,
    enum: ["music_video"],
    default: "music_video",
    index: true,
  },
  publishedStatus: {
    type: String,
    enum: ["draft", "published", "under_review", "blocked"],
    default: "published",
    index: true,
  },
  archivedAt: { type: Date, default: null, index: true },
  copyrightScanStatus: {
    type: String,
    enum: ["pending_scan", "passed", "flagged", "blocked"],
    default: "pending_scan",
    index: true,
  },
  verificationNotes: {
    type: String,
    default: "",
    maxlength: 2000,
  },
  reviewRequired: {
    type: Boolean,
    default: false,
    index: true,
  },
  moderationStatus: {
    type: String,
    enum: [
      "pending",
      "approved",
      "rejected",
      "quarantined",
      "ALLOW",
      "HOLD_FOR_REVIEW",
      "RESTRICTED_BLURRED",
      "BLOCK_EXPLICIT_ADULT",
      "BLOCK_SUSPECTED_CHILD_EXPLOITATION",
      "BLOCK_EXTREME_GORE",
      "BLOCK_ANIMAL_CRUELTY",
      "BLOCK_REPEAT_VIOLATOR",
    ],
    default: "pending",
    trim: true,
    maxlength: 80,
    index: true,
  },
  moderationLabels: {
    type: [String],
    default: [],
  },
  moderationReason: {
    type: String,
    default: "",
    trim: true,
    maxlength: 2000,
  },
  moderationConfidence: {
    type: Number,
    default: 0,
    min: 0,
    max: 1,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
  storageStage: {
    type: String,
    enum: ["temporary", "quarantine", "permanent"],
    default: "temporary",
    index: true,
  },
  moderationCaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ModerationCase",
    default: null,
    index: true,
  },
  sensitiveContent: {
    type: Boolean,
    default: false,
    index: true,
  },
  sensitiveType: {
    type: String,
    default: "",
    trim: true,
    maxlength: 80,
  },
  blurPreviewUrl: {
    type: String,
    default: "",
    trim: true,
  },
  originalVisibility: {
    type: String,
    default: "",
    trim: true,
    maxlength: 40,
  },
  contentFingerprintHash: {
    type: String,
    default: "",
    trim: true,
    index: true,
  },
  contentFileHash: {
    type: String,
    default: "",
    trim: true,
    index: true,
  },
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

VideoSchema.pre("validate", function syncVideoFields(next) {
  this.creatorCategory = "music";
  this.contentType = "music_video";
  if (this.publishedStatus === "published") this.isPublished = true;
  if (["draft", "under_review", "blocked"].includes(this.publishedStatus)) this.isPublished = false;
  if (typeof next === "function") next();
});

module.exports = mongoose.model("Video", VideoSchema);
