const mongoose = require("mongoose");

const {
  categoryKeys,
  decisions,
} = require("../config/capitalBlockers");

const capitalBlockerSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: categoryKeys,
      trim: true,
    },

    resolution: {
      type: String,
      enum: decisions,
      trim: true,
    },

    rationale: {
      type: String,
      trim: true,
      maxlength: 4000,
    },

    evidenceIndexes: {
      type: [Number],
      default: undefined,
    },

    originalClaim: {
      type: String,
      trim: true,
      maxlength: 4000,
    },

    revisedClaim: {
      type: String,
      trim: true,
      maxlength: 4000,
    },

    outreachConstraint: {
      type: String,
      trim: true,
      maxlength: 4000,
    },

    financingPath: {
      type: String,
      trim: true,
      maxlength: 4000,
    },

    advisorReviewEvidenceIndexes: {
      type: [Number],
      default: undefined,
    },

    economicsRiskKeys: {
      type: [String],
      default: undefined,
    },
  },
  {
    _id: false,
    strict: "throw",
  }
);

module.exports = capitalBlockerSchema;