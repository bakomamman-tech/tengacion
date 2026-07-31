const mongoose = require("mongoose");

const KadahiveResourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200,
    },
    category: {
      type: String,
      enum: ["technology", "business", "career", "funding", "community", "other"],
      default: "technology",
      index: true,
    },
    resourceType: {
      type: String,
      enum: ["guide", "course", "template", "report", "link", "video"],
      default: "guide",
    },
    url: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    accessLevel: {
      type: String,
      enum: ["public", "member", "premium"],
      default: "member",
    },
    progressLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("KadahiveResource", KadahiveResourceSchema);
