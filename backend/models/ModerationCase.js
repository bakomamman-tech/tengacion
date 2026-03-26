const mongoose = require("mongoose");
const {
  MODERATION_QUEUES,
  MODERATION_SEVERITIES,
  MODERATION_STATUSES,
  MODERATION_WORKFLOW_STATES,
} = require("../config/moderation");

const MediaAssetSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      default: "primary",
      trim: true,
      maxlength: 40,
    },
    mediaId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    mediaType: {
      type: String,
      default: "unknown",
      trim: true,
      maxlength: 40,
    },
    mimeType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    sourceUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
    },
    previewUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
    },
    restrictedPreviewUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
    },
    originalFilename: {
      type: String,
      default: "",
      trim: true,
      maxlength: 260,
    },
    storageKey: {
      type: String,
      default: "",
      trim: true,
      maxlength: 260,
    },
    thumbnailKey: {
      type: String,
      default: "",
      trim: true,
      maxlength: 260,
    },
    provider: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    providerMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    fileSizeBytes: {
      type: Number,
      default: 0,
      min: 0,
    },
    hashIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MediaHash",
      },
    ],
  },
  { _id: false }
);

const CaseHistoryEntrySchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    adminEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    previousStatus: {
      type: String,
      enum: MODERATION_STATUSES,
      default: "ALLOW",
    },
    newStatus: {
      type: String,
      enum: MODERATION_STATUSES,
      default: "ALLOW",
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const AdminActionHistoryEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actorEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    previousStatus: {
      type: String,
      enum: MODERATION_STATUSES,
      default: "pending",
    },
    newStatus: {
      type: String,
      enum: MODERATION_STATUSES,
      default: "pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ModerationCaseSchema = new mongoose.Schema(
  {
    queue: {
      type: String,
      enum: MODERATION_QUEUES,
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
      index: true,
    },
    targetId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    fileUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
      index: true,
    },
    mimeType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    labels: {
      type: [String],
      default: [],
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    confidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    status: {
      type: String,
      enum: MODERATION_STATUSES,
      default: "pending",
      index: true,
    },
    visibility: {
      type: String,
      enum: ["private", "public", "blocked"],
      default: "private",
      index: true,
    },
    storageStage: {
      type: String,
      enum: ["temporary", "quarantine", "permanent"],
      default: "temporary",
      index: true,
    },
    workflowState: {
      type: String,
      enum: MODERATION_WORKFLOW_STATES,
      default: "OPEN",
      index: true,
    },
    severity: {
      type: String,
      enum: MODERATION_SEVERITIES,
      default: "MEDIUM",
      index: true,
    },
    priorityScore: {
      type: Number,
      default: 0,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    adminActionHistory: {
      type: [AdminActionHistoryEntrySchema],
      default: [],
    },
    riskLabels: {
      type: [String],
      default: [],
    },
    detectionSource: {
      type: String,
      default: "automated_upload_scan",
      trim: true,
      maxlength: 80,
    },
    visibilityDecision: {
      type: String,
      enum: ["blocked", "review", "restricted", "allowed"],
      default: "review",
      index: true,
    },
    modelSignals: {
      nudityScore: { type: Number, default: 0, min: 0, max: 1 },
      sexualActivityScore: { type: Number, default: 0, min: 0, max: 1 },
      minorRiskScore: { type: Number, default: 0, min: 0, max: 1 },
      goreScore: { type: Number, default: 0, min: 0, max: 1 },
      bloodScore: { type: Number, default: 0, min: 0, max: 1 },
      animalCrueltyScore: { type: Number, default: 0, min: 0, max: 1 },
      coercionScore: { type: Number, default: 0, min: 0, max: 1 },
      ocrFlags: { type: [String], default: [] },
      duplicateBanMatch: { type: Boolean, default: false },
      repeatOffenderScore: { type: Number, default: 0, min: 0, max: 1 },
    },
    subject: {
      targetType: {
        type: String,
        required: true,
        trim: true,
        maxlength: 40,
        index: true,
      },
      targetId: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
        index: true,
      },
      title: {
        type: String,
        default: "",
        trim: true,
        maxlength: 240,
      },
      description: {
        type: String,
        default: "",
        trim: true,
        maxlength: 3000,
      },
      mediaType: {
        type: String,
        default: "unknown",
        trim: true,
        maxlength: 40,
      },
      createdAt: {
        type: Date,
        default: null,
      },
      baselineAccess: {
        isPublished: { type: Boolean, default: false },
        publishedStatus: { type: String, default: "" },
        albumStatus: { type: String, default: "" },
      },
    },
    uploader: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
      },
      email: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
        maxlength: 160,
      },
      username: {
        type: String,
        default: "",
        trim: true,
        maxlength: 80,
      },
      displayName: {
        type: String,
        default: "",
        trim: true,
        maxlength: 160,
      },
    },
    media: {
      type: [MediaAssetSchema],
      default: [],
    },
    quarantine: {
      isQuarantined: {
        type: Boolean,
        default: false,
        index: true,
      },
      quarantinedAt: {
        type: Date,
        default: null,
      },
      neverGeneratePreview: {
        type: Boolean,
        default: false,
      },
    },
    escalation: {
      required: {
        type: Boolean,
        default: false,
      },
      status: {
        type: String,
        default: "not_required",
        trim: true,
        maxlength: 40,
      },
      escalatedAt: {
        type: Date,
        default: null,
      },
      escalatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      notes: {
        type: String,
        default: "",
        trim: true,
        maxlength: 2000,
      },
    },
    evidence: {
      preservedAt: {
        type: Date,
        default: null,
      },
      preservedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      notes: {
        type: String,
        default: "",
        trim: true,
        maxlength: 2000,
      },
    },
    linkedReportIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Report",
      },
    ],
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reviewerNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    latestDecisionSummary: {
      actionType: {
        type: String,
        default: "",
        trim: true,
        maxlength: 80,
      },
      adminUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      adminEmail: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
        maxlength: 160,
      },
      previousStatus: {
        type: String,
        enum: MODERATION_STATUSES,
        default: "ALLOW",
      },
      newStatus: {
        type: String,
        enum: MODERATION_STATUSES,
        default: "ALLOW",
      },
      reason: {
        type: String,
        default: "",
        trim: true,
        maxlength: 1000,
      },
      decidedAt: {
        type: Date,
        default: null,
      },
    },
    history: {
      type: [CaseHistoryEntrySchema],
      default: [],
    },
    internalNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 4000,
    },
    publicWarningLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
  },
  { timestamps: true }
);

ModerationCaseSchema.index(
  { "subject.targetType": 1, "subject.targetId": 1, updatedAt: -1 },
  { name: "moderation_target_lookup" }
);
ModerationCaseSchema.index(
  { targetType: 1, targetId: 1, updatedAt: -1 },
  { name: "moderation_upload_target_lookup" }
);
ModerationCaseSchema.index(
  { "media.mediaId": 1, updatedAt: -1 },
  { name: "moderation_media_lookup" }
);
ModerationCaseSchema.index(
  { queue: 1, severity: -1, priorityScore: -1, createdAt: -1 },
  { name: "moderation_queue_lookup" }
);
ModerationCaseSchema.index(
  { status: 1, updatedAt: -1 },
  { name: "moderation_status_lookup" }
);

module.exports = mongoose.model("ModerationCase", ModerationCaseSchema);
