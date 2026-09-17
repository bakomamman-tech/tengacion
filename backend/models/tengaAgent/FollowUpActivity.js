const mongoose = require("mongoose");

const TengaAgentFollowUpActivitySchema = new mongoose.Schema(
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
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["email", "phone", "manual"],
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ["outbound", "inbound"],
      default: "outbound",
      index: true,
    },
    status: {
      type: String,
      enum: ["logged", "sending", "sent", "failed"],
      required: true,
      index: true,
    },
    recipient: {
      type: String,
      default: "",
      trim: true,
      maxlength: 320,
    },
    subject: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 4000,
    },
    provider: {
      type: String,
      default: "manual",
      trim: true,
      maxlength: 80,
    },
    attemptedAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastError: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

TengaAgentFollowUpActivitySchema.index({
  organizationId: 1,
  appointmentId: 1,
  occurredAt: -1,
  createdAt: -1,
});

TengaAgentFollowUpActivitySchema.index({
  organizationId: 1,
  status: 1,
  occurredAt: -1,
});

module.exports = mongoose.model(
  "TengaAgentFollowUpActivity",
  TengaAgentFollowUpActivitySchema
);
