const mongoose = require("mongoose");
const { sanitizePlainObject } = require("../config/storage");

const AUTOMATION_SUGGESTION_TYPES = [
  "support_macro_selection",
  "payout_queue_priority",
  "campaign_health_warning",
  "creator_playbook_reminder",
  "moderation_queue_routing",
  "entitlement_delay_escalation",
  "recommendation_complaint_triage",
];

const AutomationSuggestionSchema = new mongoose.Schema(
  {
    suggestionType: { type: String, enum: AUTOMATION_SUGGESTION_TYPES, required: true, index: true },
    targetType: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    targetId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    suggestedAction: { type: String, required: true, trim: true, maxlength: 800 },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    sourceSignals: { type: mongoose.Schema.Types.Mixed, required: true, default: {} },
    status: { type: String, enum: ["pending", "accepted", "rejected", "expired"], default: "pending", index: true },
    humanDecision: { type: String, default: "", trim: true, maxlength: 800 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: true },
    authorizesSensitiveAction: { type: Boolean, default: false, immutable: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

AutomationSuggestionSchema.index({ status: 1, expiresAt: 1 });
AutomationSuggestionSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

AutomationSuggestionSchema.pre("validate", function () {
  if (this.authorizesSensitiveAction) {
    this.invalidate("authorizesSensitiveAction", "Automation suggestions cannot authorize sensitive actions");
  }
  if (this.sourceSignals && typeof this.sourceSignals === "object") {
    this.sourceSignals = sanitizePlainObject(this.sourceSignals, {
      maxDepth: 2,
      maxKeys: 16,
      maxStringLength: 300,
      maxArrayLength: 10,
    });
  }
});

module.exports = mongoose.model("AutomationSuggestion", AutomationSuggestionSchema);
module.exports.AUTOMATION_SUGGESTION_TYPES = AUTOMATION_SUGGESTION_TYPES;
