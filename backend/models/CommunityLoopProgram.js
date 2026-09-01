const mongoose = require("mongoose");

const COMMUNITY_LOOP_TYPES = [
  "invite_friend_to_creator",
  "supporter_milestone",
  "live_event_follow_up",
  "saved_content_completion",
  "subscription_renewal_recovery",
  "creator_club_update",
  "fan_campaign_share",
  "similar_creator_after_purchase",
];

const COMMUNITY_LOOP_STATUSES = ["draft", "review", "approved", "running", "paused", "completed", "cancelled"];

const CommunityLoopProgramSchema = new mongoose.Schema(
  {
    loopKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
    loopType: { type: String, enum: COMMUNITY_LOOP_TYPES, required: true, index: true },
    status: { type: String, enum: COMMUNITY_LOOP_STATUSES, default: "draft", index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    scopeType: { type: String, enum: ["creator", "cohort", "market", "platform"], required: true },
    scopeId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    creatorProfile: { type: mongoose.Schema.Types.ObjectId, ref: "CreatorProfile", default: null },
    eligibility: { type: String, required: true, trim: true, maxlength: 800 },
    primaryMetric: { type: String, required: true, trim: true, maxlength: 160 },
    guardrailMetrics: [{ type: String, trim: true, lowercase: true, maxlength: 100 }],
    maxMessagesPerSevenDays: { type: Number, default: 1, min: 0, max: 7 },
    ignoredPromptLimit: { type: Number, default: 2, min: 1, max: 10 },
    complaintPauseThreshold: { type: Number, default: 0.02, min: 0, max: 1 },
    referralAbuseChecksRequired: { type: Boolean, default: true },
    privateFanRowsExposed: { type: Boolean, default: false, immutable: true },
    stopCondition: { type: String, required: true, trim: true, maxlength: 600 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    reviewAt: { type: Date, required: true, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      status: { type: String, enum: COMMUNITY_LOOP_STATUSES, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, default: "", trim: true, maxlength: 600 },
    }],
  },
  { timestamps: true }
);

CommunityLoopProgramSchema.index({ status: 1, reviewAt: 1 });
CommunityLoopProgramSchema.index({ scopeType: 1, scopeId: 1, loopType: 1 });

CommunityLoopProgramSchema.pre("validate", function () {
  if (this.startAt && this.endAt && this.endAt <= this.startAt) {
    this.invalidate("endAt", "Community loop end must be after its start");
  }
  if (this.reviewAt && this.endAt && this.reviewAt > this.endAt) {
    this.invalidate("reviewAt", "Community loop review must occur before the loop ends");
  }
  if (["approved", "running"].includes(this.status) && (!this.approvedBy || !this.approvedAt)) {
    this.invalidate("approvedBy", "Approved community loops require a recorded human approval");
  }
  if (this.privateFanRowsExposed) {
    this.invalidate("privateFanRowsExposed", "Community loop reporting cannot expose private fan-level rows");
  }
});

module.exports = mongoose.model("CommunityLoopProgram", CommunityLoopProgramSchema);
module.exports.COMMUNITY_LOOP_TYPES = COMMUNITY_LOOP_TYPES;
module.exports.COMMUNITY_LOOP_STATUSES = COMMUNITY_LOOP_STATUSES;
