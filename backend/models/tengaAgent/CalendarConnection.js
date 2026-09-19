const mongoose = require("mongoose");

const TengaAgentCalendarConnectionSchema =
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
        required: true,
        index: true,
      },
      provider: {
        type: String,
        enum: ["google", "microsoft"],
        required: true,
        index: true,
      },
      status: {
        type: String,
        enum: ["active", "error", "revoked"],
        default: "active",
        index: true,
      },
      calendarId: {
        type: String,
        default: "primary",
        trim: true,
        maxlength: 500,
      },
      displayName: {
        type: String,
        default: "",
        trim: true,
        maxlength: 160,
      },
      scopes: {
        type: [String],
        default: [],
      },
      encryptedCredentials: {
        type: String,
        default: "",
        select: false,
      },
      tokenExpiresAt: {
        type: Date,
        default: null,
      },
      lastSyncedAt: {
        type: Date,
        default: null,
      },
      lastError: {
        type: String,
        default: "",
        maxlength: 500,
      },
    },
    {
      timestamps: true,
    }
  );

TengaAgentCalendarConnectionSchema.index(
  {
    organizationId: 1,
    agentId: 1,
    provider: 1,
  },
  {
    unique: true,
  }
);

TengaAgentCalendarConnectionSchema.index({
  organizationId: 1,
  status: 1,
  provider: 1,
});

module.exports = mongoose.model(
  "TengaAgentCalendarConnection",
  TengaAgentCalendarConnectionSchema
);
