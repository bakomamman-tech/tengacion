const mongoose = require("mongoose");
const { createMediaAssetSchema } = require("./subschemas/mediaAsset");

const StoryMusicAttachmentSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ["track", "album"],
      default: "",
      trim: true,
    },
    itemId: { type: String, default: "", trim: true },
    creatorId: { type: String, default: "", trim: true },
    creatorUserId: { type: String, default: "", trim: true },
    creatorName: { type: String, default: "", trim: true },
    creatorUsername: { type: String, default: "", trim: true },
    creatorAvatar: { type: String, default: "", trim: true },
    title: { type: String, default: "", trim: true },
    coverImage: { type: String, default: "", trim: true },
    sourceUrl: { type: String, default: "", trim: true },
    previewStartSec: { type: Number, default: 0, min: 0 },
    previewLimitSec: { type: Number, default: 30, min: 1 },
    durationSec: { type: Number, default: 0, min: 0 },
    releaseType: { type: String, default: "music", trim: true },
    summaryLabel: { type: String, default: "Music", trim: true },
  },
  { _id: false }
);

const StoryMediaSchema = createMediaAssetSchema({
  type: {
    type: String,
    enum: ["image", "video"],
    default: "image",
  },
});

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
    type: StoryMediaSchema,
    default: null,
  },
  mediaUrl: String,
  mediaType: {
    type: String,
    enum: ["image", "video"],
    default: "image",
  },
  thumbnailUrl: String,
  musicAttachment: {
    type: StoryMusicAttachmentSchema,
    default: null,
  },
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

  moderationStatus: {
    type: String,
    default: "ALLOW",
    trim: true,
    maxlength: 80,
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
  reviewRequired: {
    type: Boolean,
    default: false,
    index: true,
  },
});

StorySchema.pre("validate", function syncStoryMedia(next) {
  const mediaUrl = this.media?.secureUrl || this.media?.url || "";
  if (!this.mediaUrl && mediaUrl) this.mediaUrl = mediaUrl;
  if (!this.image && mediaUrl) this.image = mediaUrl;
  if (!this.thumbnailUrl && this.media?.type === "image" && mediaUrl) this.thumbnailUrl = mediaUrl;
  if (!this.mediaType && this.media?.type) this.mediaType = this.media.type;
  if (typeof next === "function") next();
});

StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Story", StorySchema);
