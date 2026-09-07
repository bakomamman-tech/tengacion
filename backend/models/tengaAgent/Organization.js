const mongoose = require("mongoose");

const TengaAgentOrganizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },

    website: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    industry: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    countryCode: {
      type: String,
      default: "NG",
      trim: true,
      uppercase: true,
      maxlength: 2,
    },

    timezone: {
      type: String,
      default: "Africa/Lagos",
      trim: true,
      maxlength: 100,
    },

    ownerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    plan: {
      type: String,
      enum: [
        "internal",
        "solo",
        "starter",
        "growth",
        "business",
        "enterprise",
      ],
      default: "starter",
      index: true,
    },

    status: {
      type: String,
      enum: ["pilot", "active", "suspended", "closed"],
      default: "pilot",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

TengaAgentOrganizationSchema.index(
  { slug: 1 },
  { unique: true }
);

TengaAgentOrganizationSchema.index({
  status: 1,
  plan: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "TengaAgentOrganization",
  TengaAgentOrganizationSchema
);
