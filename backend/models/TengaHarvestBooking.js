const mongoose = require("mongoose");
const crypto = require("crypto");

const buildReference = () => `TH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

const TengaHarvestBookingSchema = new mongoose.Schema(
  {
    reference: { type: String, default: buildReference, unique: true, index: true },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaHarvestService",
      required: true,
      index: true,
    },
    customerName: { type: String, required: true, trim: true, maxlength: 140 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    email: { type: String, default: "", trim: true, lowercase: true, maxlength: 180 },
    units: { type: Number, required: true, min: 0.1, max: 100000 },
    startDate: { type: Date, required: true },
    notes: { type: String, default: "", trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["requested", "confirmed", "completed", "cancelled"],
      default: "requested",
      index: true,
    },
  },
  { timestamps: true }
);

TengaHarvestBookingSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("TengaHarvestBooking", TengaHarvestBookingSchema);
