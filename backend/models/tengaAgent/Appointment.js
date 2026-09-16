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
      enum: ["requested", "confirmed", "completed", "cancelled"],
      default: "requested",
      index: true,
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
