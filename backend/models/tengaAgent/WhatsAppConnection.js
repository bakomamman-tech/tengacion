const mongoose = require("mongoose");

const TengaAgentWhatsAppConnectionSchema = new mongoose.Schema(
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
      enum: ["meta_cloud"],
      default: "meta_cloud",
      required: true,
      index: true,
    },

    wabaId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },

    phoneNumberId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    displayPhoneNumber: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },

    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

TengaAgentWhatsAppConnectionSchema.index(
  {
    provider: 1,
    phoneNumberId: 1,
  },
  {
    unique: true,
  }
);

TengaAgentWhatsAppConnectionSchema.index({
  organizationId: 1,
  agentId: 1,
  status: 1,
});

module.exports = mongoose.model(
  "TengaAgentWhatsAppConnection",
  TengaAgentWhatsAppConnectionSchema
);
