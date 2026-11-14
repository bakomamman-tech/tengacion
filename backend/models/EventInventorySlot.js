const mongoose = require('mongoose');
const eventInventorySlotSchema = new mongoose.Schema({
  eventSlug: { type: String, required: true, immutable: true },
  tier: { type: String, required: true, enum: ['regular', 'vip', 'table6', 'table8', 'exclusive'], immutable: true },
  testMode: { type: Boolean, required: true, immutable: true },
  slotNumber: { type: Number, required: true, min: 1, max: 1000, immutable: true },
  status: { type: String, enum: ['available', 'held', 'sold'], required: true, default: 'available' },
  reference: { type: String },
  reservedAt: { type: Date },
  expiresAt: { type: Date },
  soldAt: { type: Date },
}, { timestamps: true });
// Unique numbered slots per tier/mode; capacity is enforced by noBadVibesPolicy (1,000 Regular, 500 others).
eventInventorySlotSchema.index({ eventSlug: 1, tier: 1, testMode: 1, slotNumber: 1 }, { unique: true });
eventInventorySlotSchema.index({ eventSlug: 1, tier: 1, testMode: 1, status: 1, expiresAt: 1 });
eventInventorySlotSchema.index({ reference: 1 }, { sparse: true });
module.exports = mongoose.models.EventInventorySlot || mongoose.model('EventInventorySlot', eventInventorySlotSchema);
