const mongoose = require("mongoose");

const TengaAgentKnowledgeChunkSchema =
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

      sourceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TengaAgentKnowledgeSource",
        required: true,
        index: true,
      },

      chunkIndex: {
        type: Number,
        required: true,
        min: 0,
      },

      text: {
        type: String,
        required: true,
        maxlength: 8000,
      },

      contentHash: {
        type: String,
        required: true,
        maxlength: 128,
      },

      tokenEstimate: {
        type: Number,
        default: 0,
        min: 0,
      },

      embedding: {
        type: [Number],
        default: [],
      },

      embeddingModel: {
        type: String,
        default: "text-embedding-3-small",
        maxlength: 120,
      },

      embeddingDimensions: {
        type: Number,
        default: 0,
        min: 0,
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

TengaAgentKnowledgeChunkSchema.index(
  {
    organizationId: 1,
    sourceId: 1,
    chunkIndex: 1,
  },
  {
    unique: true,
  }
);

TengaAgentKnowledgeChunkSchema.index({
  organizationId: 1,
  agentId: 1,
  updatedAt: -1,
});

module.exports = mongoose.model(
  "TengaAgentKnowledgeChunk",
  TengaAgentKnowledgeChunkSchema
);