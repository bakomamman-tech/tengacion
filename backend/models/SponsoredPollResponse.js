const mongoose = require("mongoose");

const SPONSORED_POLL_VOTE_VALUES = ["yes", "no"];

const SponsoredPollResponseSchema = new mongoose.Schema(
  {
    pollSlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      index: true,
    },
    pollTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    parentUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    normalizedPhone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
      index: true,
    },
    vote: {
      type: String,
      required: true,
      enum: SPONSORED_POLL_VOTE_VALUES,
      index: true,
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

SponsoredPollResponseSchema.index({ pollSlug: 1, normalizedPhone: 1 }, { unique: true });
SponsoredPollResponseSchema.index({ pollSlug: 1, vote: 1, createdAt: -1 });

SponsoredPollResponseSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  delete obj.normalizedPhone;
  return obj;
};

module.exports = mongoose.model("SponsoredPollResponse", SponsoredPollResponseSchema);
module.exports.SPONSORED_POLL_VOTE_VALUES = SPONSORED_POLL_VOTE_VALUES;
