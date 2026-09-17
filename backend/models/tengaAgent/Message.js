const mongoose = require("mongoose");

const TengaAgentMessageSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaAgentOrganization",
      required: true,
      index: true,
    },

    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaAgentConversation",
      required: true,
      index: true,
    },

    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaAgentAgent",
      required: true,
      index: true,
    },

    sender: {
      type: String,
      enum: ["customer", "agent", "human", "system", "tool"],
      required: true,
      index: true,
    },

    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    type: {
      type: String,
      enum: ["text"],
      default: "text",
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 6000,
    },

    provider: {
      type: String,
      enum: ["meta_whatsapp"],
      default: null,
      index: true,
    },

    providerMessageId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 300,
    },

    externalSenderId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 160,
    },

    providerTimestamp: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

TengaAgentMessageSchema.index({
  conversationId: 1,
  createdAt: 1,
});

TengaAgentMessageSchema.index({
  organizationId: 1,
  createdAt: -1,
});

TengaAgentMessageSchema.index(
  {
    organizationId: 1,
    provider: 1,
    providerMessageId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      providerMessageId: { $type: "string" },
    },
  }
);

module.exports = mongoose.model(
  "TengaAgentMessage",
  TengaAgentMessageSchema
);
