const mongoose = require("mongoose");
const {
  buildExpiryDate,
  newsFeedImpressionRetentionDays,
  sanitizePlainObject,
  limitArray,
} = require("../config/storage");

const NewsFeedImpressionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    sessionId: { type: String, default: "", trim: true, maxlength: 120, index: true },
    surface: {
      type: String,
      enum: ["news", "home", "topic", "source"],
      default: "news",
      index: true,
    },
    feedTab: {
      type: String,
      enum: ["for-you", "local", "nigeria", "world", "topic", "source"],
      default: "for-you",
      index: true,
    },
    cursor: { type: String, default: "", trim: true, maxlength: 220 },
    requestId: { type: String, default: "", trim: true, maxlength: 120, index: true },
    cardType: {
      type: String,
      enum: ["story", "cluster"],
      required: true,
      index: true,
    },
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsStory",
      default: null,
      index: true,
    },
    clusterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsCluster",
      default: null,
      index: true,
    },
    sourceSlug: { type: String, default: "", trim: true, lowercase: true, maxlength: 80, index: true },
    topicTags: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    position: { type: Number, default: 0, min: 0 },
    action: {
      type: String,
      enum: ["impression", "click", "open", "hide", "follow_source", "report", "why_this", "dwell"],
      default: "impression",
      index: true,
    },
    dwellMs: { type: Number, default: 0, min: 0 },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    expiresAt: {
      type: Date,
      default: () =>
        buildExpiryDate({
          createdAt: new Date(),
          retentionDays: newsFeedImpressionRetentionDays,
        }),
    },
  },
  { timestamps: true }
);

NewsFeedImpressionSchema.index({ userId: 1, createdAt: -1 });
NewsFeedImpressionSchema.index({ storyId: 1, action: 1, createdAt: -1 });
NewsFeedImpressionSchema.index({ clusterId: 1, action: 1, createdAt: -1 });
NewsFeedImpressionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

NewsFeedImpressionSchema.pre("validate", function () {
  this.topicTags = limitArray(this.topicTags, 12).map((entry) => String(entry || "").slice(0, 80)).filter(Boolean);
  if (this.metadata && typeof this.metadata === "object") {
    this.metadata = sanitizePlainObject(this.metadata, {
      maxDepth: 1,
      maxKeys: 10,
      maxStringLength: 220,
      maxArrayLength: 6,
    });
  }
});

NewsFeedImpressionSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("NewsFeedImpression", NewsFeedImpressionSchema);
