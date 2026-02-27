const mongoose = require("mongoose");

const LiveSessionSchema = new mongoose.Schema(
  {
    hostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    hostName: {
      type: String,
      trim: true,
      required: true,
    },
    hostUsername: {
      type: String,
      trim: true,
      required: true,
    },
    hostAvatar: {
      type: String,
      trim: true,
      default: "",
    },
    roomName: {
      type: String,
      trim: true,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "ended"],
      default: "active",
      index: true,
    },
    viewerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

LiveSessionSchema.index({ status: 1, startedAt: -1 });

LiveSessionSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("LiveSession", LiveSessionSchema);
