const mongoose = require("mongoose");

const PARTNER_PILOT_TYPES = [
  "label_artist",
  "publisher_author",
  "live_partner",
  "campus_community",
  "brand_collection",
];
const PARTNER_PILOT_STATUSES = ["draft", "ready", "active", "paused", "completed", "exited"];

const PartnerPilotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    pilotKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 100 },
    type: { type: String, enum: PARTNER_PILOT_TYPES, required: true, index: true },
    status: { type: String, enum: PARTNER_PILOT_STATUSES, default: "draft", index: true },
    sponsored: { type: Boolean, default: false },
    disclosureLabel: { type: String, default: "", trim: true, maxlength: 120 },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, default: "Partnerships", trim: true, maxlength: 120 },
    creatorScope: { type: String, required: true, trim: true, maxlength: 300 },
    fanScope: { type: String, required: true, trim: true, maxlength: 300 },
    geography: { type: String, required: true, trim: true, maxlength: 160 },
    offer: { type: String, required: true, trim: true, maxlength: 500 },
    reportingPackage: { type: String, required: true, trim: true, maxlength: 500 },
    rightsAndModerationPlan: { type: String, required: true, trim: true, maxlength: 500 },
    financePlan: { type: String, required: true, trim: true, maxlength: 500 },
    exitCriteria: { type: String, required: true, trim: true, maxlength: 500 },
    startAt: { type: Date, default: null },
    reviewAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    statusHistory: [
      {
        status: { type: String, enum: PARTNER_PILOT_STATUSES, required: true },
        at: { type: Date, default: Date.now },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reason: { type: String, default: "", trim: true, maxlength: 500 },
      },
    ],
  },
  { timestamps: true }
);

PartnerPilotSchema.index({ status: 1, reviewAt: 1 });
PartnerPilotSchema.pre("validate", function () {
  if (this.sponsored && !this.disclosureLabel) {
    this.invalidate("disclosureLabel", "Sponsored pilots require a visible disclosure label");
  }
});

module.exports = mongoose.model("PartnerPilot", PartnerPilotSchema);
module.exports.PARTNER_PILOT_TYPES = PARTNER_PILOT_TYPES;
module.exports.PARTNER_PILOT_STATUSES = PARTNER_PILOT_STATUSES;
