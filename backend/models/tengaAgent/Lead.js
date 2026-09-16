const mongoose = require("mongoose");

const TengaAgentLeadSchema = new mongoose.Schema(
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

    projectSummary: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    source: {
      type: String,
      enum: ["web", "whatsapp", "voice", "manual"],
      default: "web",
      index: true,
    },

    status: {
      type: String,
      enum: ["new", "qualified", "contacted", "won", "lost"],
      default: "new",
      index: true,
    },

    consentToContact: {
      type: Boolean,
      default: false,
    },

    lastCapturedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

TengaAgentLeadSchema.index(
  {
    organizationId: 1,
    agentId: 1,
    conversationId: 1,
  },
  {
    unique: true,
  }
);

TengaAgentLeadSchema.index({
  organizationId: 1,
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "TengaAgentLead",
  TengaAgentLeadSchema
);
