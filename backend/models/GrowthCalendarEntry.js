const mongoose = require("mongoose");

const GROWTH_CALENDAR_TYPES = [
  "featured_drop",
  "live_event",
  "subscription_push",
  "marketplace_spotlight",
  "fan_reminder",
  "editorial_collection",
];

const GROWTH_CALENDAR_STATUSES = ["planned", "ready", "live", "completed", "cancelled"];

const GrowthCalendarEntrySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    entryKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
      index: true,
    },
    type: { type: String, enum: GROWTH_CALENDAR_TYPES, required: true, index: true },
    status: {
      type: String,
      enum: GROWTH_CALENDAR_STATUSES,
      default: "planned",
      required: true,
      index: true,
    },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "RevenueCampaign", default: null },
    scheduledStartAt: { type: Date, required: true, index: true },
    scheduledEndAt: { type: Date, required: true, index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, default: "Product and growth", trim: true, maxlength: 120 },
    audience: { type: String, required: true, trim: true, maxlength: 240 },
    objective: { type: String, required: true, trim: true, maxlength: 300 },
    callToAction: { type: String, required: true, trim: true, maxlength: 240 },
    reportingKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
      index: true,
    },
    creatorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "CreatorProfile" }],
    contentIds: [{ type: mongoose.Schema.Types.ObjectId }],
    reminderPlan: { type: String, default: "", trim: true, maxlength: 300 },
    baselineWindowDays: { type: Number, default: 28, min: 7, max: 90 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    statusHistory: [
      {
        status: { type: String, enum: GROWTH_CALENDAR_STATUSES, required: true },
        at: { type: Date, default: Date.now },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reason: { type: String, default: "", trim: true, maxlength: 500 },
      },
    ],
  },
  { timestamps: true }
);

GrowthCalendarEntrySchema.index({ scheduledStartAt: 1, scheduledEndAt: 1, status: 1 });
GrowthCalendarEntrySchema.index({ type: 1, scheduledStartAt: 1 });

GrowthCalendarEntrySchema.pre("validate", function () {
  if (this.scheduledStartAt && this.scheduledEndAt && this.scheduledEndAt <= this.scheduledStartAt) {
    this.invalidate("scheduledEndAt", "Calendar entry end must be after its start");
  }
});

module.exports = mongoose.model("GrowthCalendarEntry", GrowthCalendarEntrySchema);
module.exports.GROWTH_CALENDAR_TYPES = GROWTH_CALENDAR_TYPES;
module.exports.GROWTH_CALENDAR_STATUSES = GROWTH_CALENDAR_STATUSES;
