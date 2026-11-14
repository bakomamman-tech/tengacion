const mongoose = require('mongoose');
const admissionSchema = new mongoose.Schema({
  number: { type: Number, required: true, min: 1, max: 10 },
  code: { type: String, required: true, match: /^[a-f0-9]{48}$/ },
  redeemedAt: { type: Date },
  redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });
const eventTicketSchema = new mongoose.Schema({
  eventSlug: { type: String, required: true, immutable: true, default: 'no-bad-vibes-2026', index: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true },
  buyerEmail: { type: String, required: true, lowercase: true, trim: true },
  attendeeName: { type: String, required: true, trim: true, maxlength: 120 },
  tier: { type: String, required: true, enum: ['regular', 'vip', 'table6', 'table8', 'exclusive'], immutable: true },
  amountKobo: { type: Number, required: true, immutable: true },
  currency: { type: String, default: 'NGN', immutable: true },
  reference: { type: String, required: true, unique: true, immutable: true },
  status: { type: String, enum: ['pending', 'paid', 'paid_unfulfilled', 'failed', 'refunded'], default: 'pending', index: true },
  testMode: { type: Boolean, required: true, default: true, immutable: true },
  slotNumber: { type: Number, min: 1, max: 1000 },
  reservationExpiresAt: { type: Date },
  refundReviewRequired: { type: Boolean, default: false },
  ticketCode: { type: String, unique: true, sparse: true, select: false },
  admissions: { type: [admissionSchema], default: [] },
  attendeePhoto: { type: String, default: '' },
  paidAt: { type: Date },
  confirmationEmailSentAt: { type: Date, default: null },
  confirmationEmailClaimedAt: { type: Date, default: null },
  confirmationEmailAttempts: { type: Number, default: 0 },
}, { timestamps: true });
// Admission codes are assigned once in a single conditional document update.
// A single atomic positional update redeems exactly one guest code.
eventTicketSchema.index({ 'admissions.code': 1 }, { sparse: true, unique: true });
module.exports = mongoose.models.EventTicket || mongoose.model('EventTicket', eventTicketSchema);
