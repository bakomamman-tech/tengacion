const mongoose = require("mongoose");

const AppointmentNotificationSchema = new mongoose.Schema(
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
    eventType: {
      type: String,
      enum: [
        "requested",
        "confirmed",
        "rescheduled",
        "completed",
        "cancelled",
        "reminder_24h",
      ],
      required: true,
      index: true,
    },
    recipientKind: {
      type: String,
      enum: ["visitor", "owner"],
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
    actor: {
      type: String,
      enum: ["visitor", "owner", "system"],
      default: "system",
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
      enum: [
        "pending",
        "sending",
        "sent",
        "failed",
        "superseded",
      ],
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
      purpose: {
        type: String,
        default: "",
        trim: true,
        maxlength: 1000,
      },
      preferredStartAt: {
        type: Date,
        default: null,
      },
      timezone: {
        type: String,
        default: "Africa/Lagos",
        trim: true,
        maxlength: 100,
      },
      durationMinutes: {
        type: Number,
        default: 30,
        min: 15,
        max: 180,
      },
      appointmentStatus: {
        type: String,
        default: "requested",
        trim: true,
        maxlength: 40,
      },
    },
  },
  {
    timestamps: true,
  }
);

AppointmentNotificationSchema.index({
  status: 1,
  scheduledFor: 1,
  createdAt: 1,
});

AppointmentNotificationSchema.index({
  appointmentId: 1,
  eventType: 1,
  status: 1,
});

module.exports = mongoose.model(
  "TengaAgentAppointmentNotification",
  AppointmentNotificationSchema
);
