const mongoose = require("mongoose");

const TengaHarvestParticipantSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["farmer", "provider", "cooperative", "buyer"],
      required: true,
      index: true,
    },
    fullName: { type: String, required: true, trim: true, maxlength: 140 },
    phone: { type: String, required: true, trim: true, maxlength: 40, index: true },
    email: { type: String, default: "", trim: true, lowercase: true, maxlength: 180 },
    organizationName: { type: String, default: "", trim: true, maxlength: 180 },
    state: { type: String, default: "Kaduna", trim: true, maxlength: 100, index: true },
    lga: { type: String, default: "", trim: true, maxlength: 120, index: true },
    community: { type: String, default: "", trim: true, maxlength: 160 },
    farmSizeHectares: { type: Number, default: 0, min: 0, max: 100000 },
    crops: [{ type: String, trim: true, maxlength: 80 }],
    serviceInterests: [{
      type: String,
      enum: ["solar_irrigation", "cold_storage", "produce_market", "equipment_finance"],
    }],
    notes: { type: String, default: "", trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["pilot_lead", "contacted", "verified", "active", "paused"],
      default: "pilot_lead",
      index: true,
    },
  },
  { timestamps: true }
);

TengaHarvestParticipantSchema.index({ role: 1, state: 1, lga: 1, createdAt: -1 });

module.exports = mongoose.model("TengaHarvestParticipant", TengaHarvestParticipantSchema);
