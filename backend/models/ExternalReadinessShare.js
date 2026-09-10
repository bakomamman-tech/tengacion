const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  record: { type: mongoose.Schema.Types.ObjectId, ref: "ExternalReadinessRecord", required: true, index: true },
  recordVersion: { type: Number, required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  audience: { type: String, enum: ["partner", "investor", "assessor", "advisor", "public"], required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  approvedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
}, { timestamps: true, optimisticConcurrency: true, strict: "throw" });
module.exports = mongoose.model("ExternalReadinessShare", schema);
