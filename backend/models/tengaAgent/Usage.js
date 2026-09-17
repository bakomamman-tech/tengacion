const mongoose = require("mongoose");

const TengaAgentUsageSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaAgentOrganization",
      required: true,
      index: true,
    },
    periodKey: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}$/,
      index: true,
    },
    conversationsStarted: {
      type: Number,
      default: 0,
      min: 0,
    },
    customerMessages: {
      type: Number,
      default: 0,
      min: 0,
    },
    aiReplies: {
      type: Number,
      default: 0,
      min: 0,
    },
    whatsappInboundMessages: {
      type: Number,
      default: 0,
      min: 0,
    },
    whatsappOutboundMessages: {
      type: Number,
      default: 0,
      min: 0,
    },
    voiceNotes: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

TengaAgentUsageSchema.index(
  { organizationId: 1, periodKey: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "TengaAgentUsage",
  TengaAgentUsageSchema
);
