const mongoose = require("mongoose");

const TengaAgentKnowledgeSourceSchema =
  new mongoose.Schema(
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
        default: null,
        index: true,
      },

      type: {
        type: String,
        enum: [
          "manual",
          "faq",
          "website",
          "document",
          "service",
        ],
        default: "manual",
        index: true,
      },

      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 240,
      },

      sourceUrl: {
        type: String,
        default: "",
        trim: true,
        maxlength: 1000,
      },

      contentHash: {
        type: String,
        default: "",
        trim: true,
        maxlength: 128,
        index: true,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "processing",
          "ready",
          "failed",
          "archived",
        ],
        default: "pending",
        index: true,
      },

      chunkCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      errorMessage: {
        type: String,
        default: "",
        maxlength: 1000,
      },

      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
    }
  );

TengaAgentKnowledgeSourceSchema.index({
  organizationId: 1,
  agentId: 1,
  status: 1,
  updatedAt: -1,
});

TengaAgentKnowledgeSourceSchema.index({
  organizationId: 1,
  type: 1,
  contentHash: 1,
});

module.exports = mongoose.model(
  "TengaAgentKnowledgeSource",
  TengaAgentKnowledgeSourceSchema
);