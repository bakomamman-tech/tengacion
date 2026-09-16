const mongoose = require("mongoose");

const TengaAgentAppointmentSchema = new mongoose.Schema(
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
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaAgentConversation",
      required: true,
      index: true,
    },
    sessionKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      index: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    company: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    purpose: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    preferredStartAt: {
      type: Date,
      required: true,
      index: true,
    },
    timezone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    durationMinutes: {
      type: Number,
      default: 30,
      min: 15,
      max: 180,
    },
    source: {
      type: String,
      enum: ["web", "whatsapp", "voice", "manual"],
      default: "web",
      index: true,
    },
    status: {
      type: String,
      enum: ["requested", "confirmed", "completed", "no_show", "cancelled"],
      default: "requested",
      index: true,
    },
    availabilityState: {
      type: String,
      enum: [
        "not_checked",
        "available_at_request",
        "conflict_at_confirmation",
        "confirmed_free",
      ],
      default: "not_checked",
      index: true,
    },
    availabilitySource: {
      type: String,
      enum: ["request_only", "internal_schedule"],
      default: "request_only",
    },
    availabilityCheckedAt: {
      type: Date,
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    rescheduledAt: {
      type: Date,
      default: null,
    },
    rescheduleCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: String,
      enum: ["owner", "system", null],
      default: null,
    },
    noShowAt: {
      type: Date,
      default: null,
    },
    noShowBy: {
      type: String,
      enum: ["owner", "system", null],
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: String,
      enum: ["owner", "visitor", "system", null],
      default: null,
    },
    consentToContact: {
      type: Boolean,
      default: false,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

TengaAgentAppointmentSchema.index(
  {
    organizationId: 1,
    agentId: 1,
    conversationId: 1,
  },
  {
    unique: true,
  }
);

TengaAgentAppointmentSchema.index({
  organizationId: 1,
  status: 1,
  preferredStartAt: 1,
});

module.exports = mongoose.model(
  "TengaAgentAppointment",
  TengaAgentAppointmentSchema
);
