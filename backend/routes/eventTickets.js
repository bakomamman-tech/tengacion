// No Bad Vibes with MCJagz — inventory-safe Paystack checkout and per-guest admission.
// Each inventory slot is an atomic claim; no process-local stock counters.
// Confirm approved stock before enabling the production feature flag.
const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { Readable } = require('stream');
const auth = require('../middleware/auth');
const EventTicket = require('../models/EventTicket');
const EventInventorySlot = require('../models/EventInventorySlot');
const User = require('../models/User');
const { EVENT_SLUG: SLUG, HOLD_MINUTES: RESERVATION_MINUTES, CATEGORIES: tiers, hasConfirmedInventory } =
  require('../services/noBadVibesPolicy');
const router = express.Router();

const isEnabled = () => process.env.EVENT_NBV_ENABLED === 'true';
const paystackKey = () => String(process.env.PAYSTACK_SECRET_KEY || '').trim();
const isTest = () => paystackKey().startsWith('sk_test_');
const baseUrl = () => String(process.env.PUBLIC_BASE_URL || 'https://www.tengacion.com').replace(/\/$/, '');
const normalize = (value) => String(value || '').trim();
const isAdmin = (req) => ['admin', 'super_admin'].includes(req.user?.role);
const reservationDeadline = () => new Date(Date.now() + RESERVATION_MINUTES * 60_000);
const admissionCode = () => crypto.randomBytes(24).toString('hex');
const photoPreviewUrl = (publicId) => {
  try {
    const cloudinary = require('cloudinary').v2;
    return cloudinary.utils.private_download_url(publicId, 'jpg', { resource_type: 'image',
      type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 900 });
  } catch { return ''; }
};
const safeTicket = (ticket) => ({
  id: String(ticket._id), eventSlug: ticket.eventSlug, buyerEmail: ticket.buyerEmail,
  attendeeName: ticket.attendeeName, tier: ticket.tier, label: tiers[ticket.tier]?.label,
  amountNGN: ticket.amountKobo / 100, status: ticket.status,
  seats: tiers[ticket.tier]?.seats, testMode: ticket.testMode,
  ticketCode: ticket.status === 'paid' ? ticket.ticketCode || '' : '',
  admissions: ticket.status === 'paid' ? (ticket.admissions || []).map(a => ({
    number: a.number, code: a.code, redeemedAt: a.redeemedAt || null,
  })) : [],
  attendeePhoto: ticket.attendeePhoto ? photoPreviewUrl(ticket.attendeePhoto) : '',
  paidAt: ticket.paidAt || null, createdAt: ticket.createdAt,
});

// Upsert all approved slots without resetting prior holds or sold slots.
// A unique compound database index prevents duplicate slot numbers across workers.
const seedInFlight = new Map();
async function ensureSlots(tier, testMode) {
  if (!hasConfirmedInventory(tier)) return; // Fail closed: unknown capacity creates no slots.
  const capacity = tiers[tier].capacity;
  const key = `${tier}:${testMode}`;
  if (seedInFlight.has(key)) return seedInFlight.get(key);
  const work = (async () => {
    // Ensure compound uniqueness, including after test databases are dropped.
    await Promise.all([EventInventorySlot.createIndexes(), EventTicket.createIndexes()]);
    const scope = { eventSlug: SLUG, tier, testMode };
    const count = await EventInventorySlot.countDocuments(scope);
    if (count >= capacity) return;
    const operations = Array.from({ length: capacity }, (_, n) => ({
      updateOne: { filter: { ...scope, slotNumber: n + 1 },
        update: { $setOnInsert: { ...scope, slotNumber: n + 1, status: 'available' } }, upsert: true },
    }));
    try { await EventInventorySlot.bulkWrite(operations, { ordered: false }); }
    catch (err) {
      // An overlapping worker may win individual upserts. Never bypass real failures.
      if (!err?.writeErrors?.length || err.writeErrors.some(e => e.code !== 11000)) throw err;
    }
    if (await EventInventorySlot.countDocuments(scope) !== capacity) {
      throw new Error('Inventory initialization incomplete');
    }
  })().finally(() => seedInFlight.delete(key));
  seedInFlight.set(key, work);
  return work;
}

async function availability(tier, testMode) {
  if (!hasConfirmedInventory(tier)) return 0;
  const used = await EventInventorySlot.countDocuments({
    eventSlug: SLUG, tier, testMode,
    $or: [{ status: 'sold' }, { status: 'held', expiresAt: { $gt: new Date() } }],
  });
  return Math.max(0, tiers[tier].capacity - used);
}

async function reserveSlot(tier, reference, testMode) {
  if (!hasConfirmedInventory(tier)) return null;
  await ensureSlots(tier, testMode);
  const now = new Date();
  return EventInventorySlot.findOneAndUpdate({ eventSlug: SLUG, tier, testMode,
    $or: [{ status: 'available' }, { status: 'held', expiresAt: { $lte: now } }],
  }, { $set: { status: 'held', reference, reservedAt: now, expiresAt: reservationDeadline() },
       $unset: { soldAt: 1 } }, { returnDocument: 'after', sort: { slotNumber: 1 } });
}

async function releaseSlot(ticket) {
  if (!ticket) return;
  await EventInventorySlot.updateOne({ eventSlug: SLUG, tier: ticket.tier, testMode: ticket.testMode,
    reference: ticket.reference, status: 'held' },
    { $set: { status: 'available' }, $unset: { reference: 1, reservedAt: 1, expiresAt: 1 } });
}

async function checkPaystack(reference) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackKey()}` }, signal: AbortSignal.timeout(12000),
  });
  const body = await response.json();
  if (!response.ok || body.status !== true || !body.data) throw new Error('Payment verification unavailable');
  return body.data;
}

// This records a payment that must be reconciled/refunded, never minting admission codes.
async function flagUnfulfilled(ticket) {
  await EventTicket.updateOne({ _id: ticket._id, status: 'pending' },
    { $set: { status: 'paid_unfulfilled', refundReviewRequired: true } });
  return null;
}

async function completePayment(reference) {
  const ticket = await EventTicket.findOne({ reference }).select('+ticketCode');
  if (!ticket) return null;
  if (ticket.status === 'paid') return ticket;
  if (ticket.status === 'paid_unfulfilled' || ticket.status === 'refunded') return null;

  const payment = await checkPaystack(reference);
  if (payment.status !== 'success' || payment.reference !== reference ||
      Number(payment.amount) !== ticket.amountKobo ||
      String(payment.currency || '').toUpperCase() !== 'NGN' ||
      String(payment.customer?.email || '').toLowerCase() !== ticket.buyerEmail) return null;

  // Confirm the held slot BEFORE ticket issuance. A timed-out or reallocated hold
  // must never receive admissions, even if a late Paystack charge succeeded.
  const scope = { eventSlug: SLUG, tier: ticket.tier, testMode: ticket.testMode, reference };
  let slot = await EventInventorySlot.findOneAndUpdate({ ...scope, status: 'held',
    expiresAt: { $gt: new Date() } },
    { $set: { status: 'sold', soldAt: new Date() } }, { returnDocument: 'after' });
  if (!slot) slot = await EventInventorySlot.findOne({ ...scope, status: 'sold' });
  if (!slot) return flagUnfulfilled(ticket);

  const count = tiers[ticket.tier].seats;
  const admissions = Array.from({ length: count }, (_, n) => ({ number: n + 1, code: admissionCode() }));
  const result = await EventTicket.findOneAndUpdate({ _id: ticket._id, status: 'pending' },
    { $set: { status: 'paid', paidAt: new Date(), slotNumber: slot.slotNumber,
      ticketCode: admissions[0].code, admissions } }, { returnDocument: 'after' }).select('+ticketCode');
  if (result) return result;
  // Duplicate webhook and callback may race: only one inserts the admissions.
  const settled = await EventTicket.findById(ticket._id).select('+ticketCode');
  return settled?.status === 'paid' ? settled : null;
}

router.get('/config', async (_req, res) => {
  try {
    const mode = isTest();
    const available = await Promise.all(Object.keys(tiers).map(t => availability(t, mode)));
    return res.json({
      event: { slug: SLUG, name: 'No Bad Vibes with MCJagz', date: '2026-12-18',
        venue: '7eleven, Sabo, Unguwan Boro, Kaduna, Nigeria' },
      enabled: isEnabled(),
      tiers: Object.entries(tiers).map(([id, t], i) => ({ id, ...t,
        amountNGN: t.amountKobo / 100, inventoryConfirmed: hasConfirmedInventory(id),
        purchasable: isEnabled() && hasConfirmedInventory(id) && available[i] > 0,
        available: available[i] })),
    });
  } catch {
    return res.status(503).json({ enabled: false, error: 'Ticket availability temporarily unavailable.' });
  }
});

router.post('/checkout', auth, async (req, res) => {
  let ticket;
  let slot;
  try {
    if (!isEnabled()) return res.status(503).json({ error: 'Ticket sales are not open yet.' });
    if (!paystackKey().startsWith('sk_') ||
        (process.env.NODE_ENV === 'production' && isTest())) {
      return res.status(503).json({ error: 'Payment gateway not configured for this environment.' });
    }
    const tier = normalize(req.body?.tier);
    if (!Object.hasOwn(tiers, tier)) return res.status(400).json({ error: 'Invalid ticket category.' });
    if (!hasConfirmedInventory(tier)) return res.status(409).json({ error: 'Stock for this category is not confirmed; checkout is unavailable.' });
    const buyer = await User.findById(req.user.id);
    if (!buyer?.email || !buyer?.name) return res.status(400).json({ error: 'Account must have a name and email.' });
    const reference = `NVB26-${crypto.randomBytes(12).toString('hex')}`;
    slot = await reserveSlot(tier, reference, isTest());
    if (!slot) return res.status(409).json({ error: 'This ticket category is sold out.' });
    ticket = await EventTicket.create({ buyer: buyer._id, buyerEmail: buyer.email,
      attendeeName: buyer.name, tier, amountKobo: tiers[tier].amountKobo,
      reference, testMode: isTest(), slotNumber: slot.slotNumber,
      reservationExpiresAt: slot.expiresAt });
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Bearer ${paystackKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: buyer.email, amount: ticket.amountKobo, currency: 'NGN', reference,
        callback_url: `${baseUrl()}/events/no-bad-vibes?reference=${encodeURIComponent(reference)}`,
        metadata: { eventSlug: SLUG, ticketId: String(ticket._id), tier },
      }),
    });
    const body = await response.json();
    const url = String(body?.data?.authorization_url || '');
    if (!response.ok || body.status !== true || !url.startsWith('https://checkout.paystack.com/')) {
      await EventTicket.updateOne({ _id: ticket._id, status: 'pending' }, { $set: { status: 'failed' } });
      await releaseSlot(ticket);
      return res.status(502).json({ error: 'Unable to start Paystack checkout.' });
    }
    return res.status(201).json({ authorizationUrl: url, reference,
      reservationExpiresAt: slot.expiresAt, testMode: ticket.testMode });
  } catch (err) {
    console.error('[eventTickets.checkout]', err.message);
    if (ticket) await EventTicket.updateOne({ _id: ticket._id, status: 'pending' },
      { $set: { status: 'failed' } }).catch(() => null);
    if (slot) await releaseSlot({ tier: slot.tier, testMode: slot.testMode, reference: slot.reference }).catch(() => null);
    return res.status(503).json({ error: 'Checkout unavailable. Please try again.' });
  }
});

router.get('/mine', auth, async (req, res) => {
  const tickets = await EventTicket.find({ buyer: req.user.id, status: 'paid' })
    .sort({ createdAt: -1 }).select('+ticketCode').lean();
  return res.json({ tickets: tickets.map(safeTicket) });
});

router.get('/verify/:reference', auth, async (req, res) => {
  const reference = normalize(req.params.reference);
  const ticket = await EventTicket.findOne({ reference });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
  if (String(ticket.buyer) !== String(req.user.id)) return res.status(403).json({ error: 'Not your purchase.' });
  try {
    const result = await completePayment(reference);
    if (!result) {
      const refreshed = await EventTicket.findById(ticket._id);
      const unfulfilled = refreshed?.status === 'paid_unfulfilled';
      return res.json({ verified: false, status: refreshed?.status || 'pending',
        message: unfulfilled
          ? 'Payment received after reservation expired. No ticket was issued; please contact support for refund review.'
          : 'Payment not confirmed yet.' });
    }
    return res.json({ verified: true, ticket: safeTicket(result) });
  } catch { return res.status(503).json({ error: 'Payment verification is temporarily unavailable.' }); }
});

// Modern Paystack-Signature format preferred; legacy x-paystack-signature fallback.
const validWebhookSignature = (rawBody, headers) => {
  const modern = String(headers['paystack-signature'] || '');
  const whsec = String(process.env.PAYSTACK_WEBHOOK_SECRET || '');
  if (modern && whsec) {
    const fields = modern.split(',').map(s => s.trim());
    const stamp = fields.find(s => s.startsWith('t='))?.slice(2);
    if (!/^\d+$/.test(stamp || '') || Math.abs(Date.now() / 1000 - Number(stamp)) > 300) return false;
    const expected = crypto.createHmac('sha512', whsec).update(`${stamp}.`).update(rawBody).digest('hex');
    return fields.filter(s => s.startsWith('v1=')).some(s => {
      const signature = s.slice(3).split(':').slice(1).join(':');
      return /^[a-f0-9]{128}$/.test(signature) && crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    });
  }
  const signature = String(headers['x-paystack-signature'] || '');
  if (!/^[a-f0-9]{128}$/.test(signature) || !paystackKey()) return false;
  const expected = crypto.createHmac('sha512', paystackKey()).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
};

router.post('/webhook', async (req, res) => {
  const rawBody = Buffer.from(req.rawBody || '', 'utf8');
  if (!rawBody.length || !validWebhookSignature(rawBody, req.headers)) return res.status(401).json({ error: 'Invalid webhook.' });
  if (req.body?.event !== 'charge.success') return res.sendStatus(200);
  const reference = normalize(req.body?.data?.reference);
  if (!/^NVB26-[a-f0-9]{24}$/.test(reference)) return res.sendStatus(200);
  try { await completePayment(reference); return res.sendStatus(200); }
  catch { return res.sendStatus(503); }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['image/png', 'image/jpeg'].includes(file.mimetype)) });
router.post('/:id/photo', auth, upload.single('photo'), async (req, res) => {
  const ticket = await EventTicket.findOne({ _id: req.params.id, buyer: req.user.id, status: 'paid' });
  if (!ticket) return res.status(404).json({ error: 'Purchased ticket not found.' });
  if (!req.file) return res.status(400).json({ error: 'JPG or PNG photo (max 3 MB) required.' });
  if (req.body?.photoConsent !== 'true') return res.status(400).json({ error: 'Photo consent is required.' });
  try {
    const cloudinary = require('cloudinary').v2;
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'tengacion/event-tickets/no-bad-vibes',
        resource_type: 'image', type: 'authenticated', format: 'jpg', transformation: [{ width: 600, height: 600, crop: 'limit' }] },
      (err, data) => err ? reject(err) : resolve(data));
      Readable.from(req.file.buffer).pipe(stream);
    });
    ticket.attendeePhoto = result.public_id;
    await ticket.save();
    return res.json({ ticket: safeTicket(ticket) });
  } catch { return res.status(503).json({ error: 'Photo storage is unavailable.' }); }
});

// A group buyer receives one unique bearer QR for each guest, NOT one reusable table QR.
router.get('/status/:code', async (req, res) => {
  const code = normalize(req.params.code);
  if (!/^[a-f0-9]{48}$/.test(code)) return res.status(404).json({ valid: false });
  const ticket = await EventTicket.findOne({ 'admissions.code': code, status: 'paid', testMode: false });
  const admission = ticket?.admissions?.find(a => a.code === code);
  return res.json({ valid: Boolean(admission && !admission.redeemedAt),
    used: Boolean(admission?.redeemedAt), tier: ticket ? tiers[ticket.tier]?.label : undefined });
});

router.post('/redeem/:code', auth, async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Organizer access only.' });
  const code = normalize(req.params.code);
  if (!/^[a-f0-9]{48}$/.test(code)) return res.status(400).json({ error: 'Invalid code.' });
  const claimed = await EventTicket.findOneAndUpdate({ status: 'paid', testMode: false,
    admissions: { $elemMatch: { code, redeemedAt: { $exists: false } } } },
  { $set: { 'admissions.$.redeemedAt': new Date(), 'admissions.$.redeemedBy': req.user.id } },
  { returnDocument: 'after' });
  if (claimed) return res.json({ admitted: true, tier: tiers[claimed.tier]?.label,
    admittedCount: claimed.admissions.filter(a => a.redeemedAt).length,
    capacity: tiers[claimed.tier].seats });
  const previous = await EventTicket.findOne({ 'admissions.code': code, status: 'paid', testMode: false });
  return res.status(409).json({ admitted: false, reason: previous ? 'Already used.' : 'Invalid ticket.' });
});

module.exports = router;
