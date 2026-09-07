const mongoose = require("mongoose");

const TengaAgentAgentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaAgentOrganization",
      required: true,
      index: true,
    },

    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    role: {
      type: String,
      default: "AI Receptionist",
      trim: true,
      maxlength: 160,
    },

    systemInstructions: {
      type: String,
      default: "",
      maxlength: 12000,
    },

    greeting: {
      type: String,
      default: "Hi! How can I help you today?",
      trim: true,
      maxlength: 600,
    },

    tone: {
      type: String,
      default: "friendly-professional",
      trim: true,
      maxlength: 80,
    },

    languages: {
      type: [String],
      default: ["English"],
    },

    enabledTools: {
      type: [String],
      default: [],
    },

    isPublicDemo: {
      type: Boolean,
      default: false,
      index: true,
    },

    status: {
      type: String,
      enum: ["draft", "active", "paused", "retired"],
      default: "draft",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

TengaAgentAgentSchema.index(
  {
    organizationId: 1,
    key: 1,
  },
  {
    unique: true,
  }
);

TengaAgentAgentSchema.index({
  organizationId: 1,
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "TengaAgentAgent",
  TengaAgentAgentSchema
);
