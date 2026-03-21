const mongoose = require("mongoose");

const UserSavedNewsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsStory",
      required: true,
      index: true,
    },
    clusterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsCluster",
      default: null,
      index: true,
    },
    sourceSlug: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 80,
    },
    canonicalUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    topicTags: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    savedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

UserSavedNewsSchema.index({ userId: 1, articleId: 1 }, { unique: true });

UserSavedNewsSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("UserSavedNews", UserSavedNewsSchema);
