const mongoose = require("mongoose");
const { sanitizePlainObject } = require("../config/storage");

const CREATOR_LIFECYCLE_PROGRAMS = [
  "new_creator_activation",
  "first_paid_drop",
  "subscription_launch",
  "live_event_launch",
  "dormant_creator_reactivation",
  "high_potential_creator_growth",
];

const CREATOR_LIFECYCLE_STATUSES = [
  "candidate",
  "enrolled",
  "active",
  "paused",
  "graduated",
];

const CreatorLifecycleEnrollmentSchema = new mongoose.Schema(
  {
    creatorProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorProfile",
      required: true,
      index: true,
    },
    creatorUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    programKey: {
      type: String,
      enum: CREATOR_LIFECYCLE_PROGRAMS,
      required: true,
      index: true,
    },
    lifecycleStage: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      index: true,
    },
    status: {
      type: String,
      enum: CREATOR_LIFECYCLE_STATUSES,
      default: "enrolled",
      required: true,
      index: true,
    },
    ownerName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    ownerRole: {
      type: String,
      default: "Creator growth",
      trim: true,
      maxlength: 120,
    },
    checklist: [
      {
        key: { type: String, required: true, trim: true, maxlength: 80 },
        label: { type: String, required: true, trim: true, maxlength: 180 },
        complete: { type: Boolean, default: false },
        completedAt: { type: Date, default: null },
      },
    ],
    metricSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    entryReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 800,
    },
    enrolledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    enrolledAt: { type: Date, default: Date.now },
    launchedAt: { type: Date, default: null },
    graduatedAt: { type: Date, default: null },
    lastEvaluatedAt: { type: Date, default: Date.now },
    statusHistory: [
      {
        status: {
          type: String,
          enum: CREATOR_LIFECYCLE_STATUSES,
          required: true,
        },
        at: { type: Date, default: Date.now },
        actorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        note: { type: String, default: "", trim: true, maxlength: 500 },
      },
    ],
  },
  { timestamps: true }
);

CreatorLifecycleEnrollmentSchema.index(
  { creatorProfile: 1, programKey: 1 },
  { unique: true }
);
CreatorLifecycleEnrollmentSchema.index({ programKey: 1, status: 1, updatedAt: -1 });

CreatorLifecycleEnrollmentSchema.pre("validate", function () {
  if (this.metricSnapshot && typeof this.metricSnapshot === "object") {
    this.metricSnapshot = sanitizePlainObject(this.metricSnapshot, {
      maxDepth: 2,
      maxKeys: 20,
      maxStringLength: 300,
      maxArrayLength: 12,
    });
  }
});

module.exports = mongoose.model(
  "CreatorLifecycleEnrollment",
  CreatorLifecycleEnrollmentSchema
);
module.exports.CREATOR_LIFECYCLE_PROGRAMS = CREATOR_LIFECYCLE_PROGRAMS;
module.exports.CREATOR_LIFECYCLE_STATUSES = CREATOR_LIFECYCLE_STATUSES;
