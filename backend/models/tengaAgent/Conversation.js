const mongoose = require("mongoose");

const TengaAgentConversationSchema = new mongoose.Schema(
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

    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    sessionKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      index: true,
    },

    channel: {
      type: String,
      enum: ["web", "whatsapp", "voice"],
      default: "web",
      index: true,
    },

    status: {
      type: String,
      enum: [
        "ai_active",
        "handoff_requested",
        "human_active",
        "closed",
      ],
      default: "ai_active",
      index: true,
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

TengaAgentConversationSchema.index(
  {
    organizationId: 1,
    agentId: 1,
    sessionKey: 1,
  },
  {
    unique: true,
  }
);

TengaAgentConversationSchema.index({
  organizationId: 1,
  status: 1,
  lastMessageAt: -1,
});

module.exports = mongoose.model(
  "TengaAgentConversation",
  TengaAgentConversationSchema
);
