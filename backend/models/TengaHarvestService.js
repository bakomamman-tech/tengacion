const mongoose = require("mongoose");

const TengaHarvestServiceSchema = new mongoose.Schema(
  {
    providerName: { type: String, required: true, trim: true, maxlength: 180 },
    participant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaHarvestParticipant",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["solar_irrigation", "cold_storage"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, default: "", trim: true, maxlength: 1200 },
    state: { type: String, default: "Kaduna", trim: true, maxlength: 100, index: true },
    lga: { type: String, default: "", trim: true, maxlength: 120, index: true },
    community: { type: String, default: "", trim: true, maxlength: 160 },
    capacity: { type: Number, default: 0, min: 0 },
    capacityUnit: {
      type: String,
      enum: ["hectares_per_day", "crates", "kg", "tonnes"],
      default: "hectares_per_day",
    },
    pricePerUnitNgn: { type: Number, default: 0, min: 0 },
    priceUnitLabel: { type: String, default: "", trim: true, maxlength: 80 },
    renewableEnergy: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["pending_review", "active", "paused", "retired"],
      default: "pending_review",
      index: true,
    },
    verificationNote: { type: String, default: "", trim: true, maxlength: 1000 },
    verifiedAt: { type: Date, default: null },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

TengaHarvestServiceSchema.index({ status: 1, type: 1, state: 1, lga: 1 });
TengaHarvestServiceSchema.index({ participant: 1, createdAt: -1 });

module.exports = mongoose.model("TengaHarvestService", TengaHarvestServiceSchema);
