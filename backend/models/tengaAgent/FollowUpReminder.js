const mongoose = require("mongoose");

const TengaAgentFollowUpReminderSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaAgentOrganization",
      required: true,
      index: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaAgentAgent",
      required: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaAgentAppointment",
      required: true,
      index: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    dedupeKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "sending", "sent", "failed", "superseded"],
      default: "pending",
      index: true,
    },
    scheduledFor: {
      type: Date,
      default: Date.now,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    snapshot: {
      businessName: {
        type: String,
        default: "",
        trim: true,
        maxlength: 180,
      },
      visitorName: {
        type: String,
        default: "",
        trim: true,
        maxlength: 120,
      },
      visitorEmail: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
        maxlength: 254,
      },
      visitorPhone: {
        type: String,
        default: "",
        trim: true,
        maxlength: 40,
      },
      purpose: {
        type: String,
        default: "",
        trim: true,
        maxlength: 1000,
      },
      outcomeDisposition: {
        type: String,
        default: "unreviewed",
        trim: true,
        maxlength: 40,
      },
      outcomeNotes: {
        type: String,
        default: "",
        trim: true,
        maxlength: 4000,
      },
      followUpAt: {
        type: Date,
        default: null,
      },
      timezone: {
        type: String,
        default: "Africa/Lagos",
        trim: true,
        maxlength: 100,
      },
    },
  },
  {
    timestamps: true,
  }
);

TengaAgentFollowUpReminderSchema.index({
  status: 1,
  scheduledFor: 1,
  createdAt: 1,
});

TengaAgentFollowUpReminderSchema.index({
  appointmentId: 1,
  status: 1,
});

module.exports = mongoose.model(
  "TengaAgentFollowUpReminder",
  TengaAgentFollowUpReminderSchema
);
