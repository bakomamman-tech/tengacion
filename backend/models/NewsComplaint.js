const mongoose = require("mongoose");
const { NEWS_SENSITIVE_FLAGS } = require("./newsSubschemas");

const NewsComplaintSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsSource",
      default: null,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      index: true,
    },
    details: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["open", "reviewing", "resolved", "dismissed"],
      default: "open",
      index: true,
    },
    sensitiveFlags: {
      type: [String],
      default: [],
      validate: {
        validator(value) {
          return (Array.isArray(value) ? value : []).every((entry) =>
            NEWS_SENSITIVE_FLAGS.includes(String(entry || ""))
          );
        },
        message: "Invalid sensitive complaint flag",
      },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

NewsComplaintSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("NewsComplaint", NewsComplaintSchema);
