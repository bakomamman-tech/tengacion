const mongoose = require("mongoose");

const TengaAgentWhatsAppReplySchema = new mongoose.Schema(
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

    inboundMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaAgentMessage",
      required: true,
    },

    inboundProviderMessageId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    phoneNumberId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    recipientId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    status: {
      type: String,
      enum: ["queued", "processing", "accepted", "failed", "skipped"],
      default: "queued",
      index: true,
    },

    replyText: {
      type: String,
      default: "",
      trim: true,
      maxlength: 4096,
    },

    providerMessageId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastError: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

TengaAgentWhatsAppReplySchema.index(
  { inboundMessageId: 1 },
  { unique: true }
);

TengaAgentWhatsAppReplySchema.index({
  organizationId: 1,
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "TengaAgentWhatsAppReply",
  TengaAgentWhatsAppReplySchema
);
