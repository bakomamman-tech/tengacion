const mongoose = require("mongoose");

const WeeklyWindowSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    startMinutes: {
      type: Number,
      required: true,
      min: 0,
      max: 1439,
    },
    endMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 1440,
    },
  },
  { _id: false }
);

const BlockedIntervalSchema = new mongoose.Schema(
  {
    startAt: {
      type: Date,
      required: true,
    },
    endAt: {
      type: Date,
      required: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240,
    },
  },
  { _id: true }
);

const TengaAgentAvailabilityScheduleSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaAgentOrganization",
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    timezone: {
      type: String,
      default: "Africa/Lagos",
      trim: true,
      maxlength: 100,
    },
    source: {
      type: String,
      enum: ["internal_schedule"],
      default: "internal_schedule",
    },
    minimumNoticeMinutes: {
      type: Number,
      default: 60,
      min: 0,
      max: 10080,
    },
    bookingHorizonDays: {
      type: Number,
      default: 30,
      min: 1,
      max: 365,
    },
    slotStepMinutes: {
      type: Number,
      enum: [15, 30, 60],
      default: 30,
    },
    defaultDurationMinutes: {
      type: Number,
      default: 30,
      min: 15,
      max: 180,
    },
    bufferBeforeMinutes: {
      type: Number,
      default: 0,
      min: 0,
      max: 180,
    },
    bufferAfterMinutes: {
      type: Number,
      default: 0,
      min: 0,
      max: 180,
    },
    weeklyHours: {
      type: [WeeklyWindowSchema],
      default: [],
    },
    blockedIntervals: {
      type: [BlockedIntervalSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "TengaAgentAvailabilitySchedule",
  TengaAgentAvailabilityScheduleSchema
);
