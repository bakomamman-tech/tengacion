const mongoose = require("mongoose");

const KadahiveBookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    space: {
      type: String,
      enum: ["coworking-desk", "meeting-room", "training-hall", "event-space"],
      required: true,
    },
    startsAt: {
      type: Date,
      required: true,
      index: true,
    },
    durationHours: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    attendees: {
      type: Number,
      default: 1,
      min: 1,
      max: 500,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "declined", "cancelled", "completed"],
      default: "pending",
      index: true,
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

KadahiveBookingSchema.index({ userId: 1, startsAt: -1 });

module.exports = mongoose.model("KadahiveBooking", KadahiveBookingSchema);
