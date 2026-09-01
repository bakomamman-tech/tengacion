const mongoose = require("mongoose");

const CREATOR_PROMPT_STATUSES = ["available", "shown", "acted", "completed", "dismissed", "hidden", "help_requested", "expired"];

const CreatorIntelligencePromptSchema = new mongoose.Schema(
  {
    promptKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    creatorProfile: { type: mongoose.Schema.Types.ObjectId, ref: "CreatorProfile", required: true, index: true },
    creatorUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    intelligenceProduct: { type: mongoose.Schema.Types.ObjectId, ref: "IntelligenceProduct", required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    explanation: { type: String, required: true, trim: true, maxlength: 1200 },
    sourceLabel: { type: String, required: true, trim: true, maxlength: 240 },
    sourceMetricKeys: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
    timeframeLabel: { type: String, required: true, trim: true, maxlength: 160 },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    limitations: { type: String, required: true, trim: true, maxlength: 800 },
    suggestedAction: { type: String, required: true, trim: true, maxlength: 600 },
    status: { type: String, enum: CREATOR_PROMPT_STATUSES, default: "available", index: true },
    creatorFeedback: { type: String, enum: ["", "helpful", "not_relevant", "incorrect", "needs_explanation"], default: "" },
    feedbackNote: { type: String, default: "", trim: true, maxlength: 800 },
    shownAt: { type: Date, default: null },
    actedAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    history: [{
      status: { type: String, enum: CREATOR_PROMPT_STATUSES, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, required: true, trim: true, maxlength: 600 },
    }],
  },
  { timestamps: true }
);

CreatorIntelligencePromptSchema.index({ creatorProfile: 1, promptKey: 1 }, { unique: true });
CreatorIntelligencePromptSchema.index({ creatorProfile: 1, status: 1, expiresAt: 1 });

CreatorIntelligencePromptSchema.pre("validate", function () {
  if (this.status === "shown" && !this.shownAt) this.shownAt = new Date();
  if (["acted", "completed"].includes(this.status) && !this.actedAt) this.actedAt = new Date();
  if (["dismissed", "hidden"].includes(this.status) && !this.dismissedAt) this.dismissedAt = new Date();
});

module.exports = mongoose.model("CreatorIntelligencePrompt", CreatorIntelligencePromptSchema);
module.exports.CREATOR_PROMPT_STATUSES = CREATOR_PROMPT_STATUSES;
