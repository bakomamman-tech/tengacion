const mongoose = require("mongoose");

const KadahiveEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
      index: true,
    },
    category: {
      type: String,
      enum: ["workshop", "bootcamp", "community", "training", "conference", "other"],
      default: "community",
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 320,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 6000,
    },
    dateLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    startsAt: {
      type: Date,
      default: null,
      index: true,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    location: {
      type: String,
      default: "KADA Hive Innovation & Tech Hub, 11B Sambo Road, Kaduna",
      trim: true,
      maxlength: 240,
    },
    capacity: {
      type: Number,
      default: 0,
      min: 0,
      max: 100000,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    registrationCount: {
      type: Number,
      default: 0,
      min: 0,
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

KadahiveEventSchema.index({ status: 1, startsAt: 1 });

module.exports = mongoose.model("KadahiveEvent", KadahiveEventSchema);
