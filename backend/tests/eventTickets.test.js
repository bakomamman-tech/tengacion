/**
 * No Bad Vibes event-ticket API smoke/integration tests.
 * Local-only: Paystack network calls are mocked; MongoDB is in-memory.
 * Includes stock ceiling, hold-reclaim, and per-guest admission tests;
 * production launch still requires staging integration, venue and refund-policy review.
 */
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tengacion-test-placeholder';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-testing-only-secret-not-for-production-2026';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_no_bad_vibes_mock_key';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_tengacion';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_tengacion';
process.env.EVENT_NBV_ENABLED = 'true';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const EventTicket = require('../models/EventTicket');
const EventInventorySlot = require('../models/EventInventorySlot');

let mongod;
let buyer;
let buyerToken;
let otherToken;
let adminToken;
const originalFetch = global.fetch;

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function createUser(name, username, role = 'user') {
  const user = await User.create({
    name,
    username,
    email: `${username}@example.test`,
    password: 'TestPassword123!',
    role,
    isVerified: true,
    emailVerified: true,
  });
  const sessionId = new mongoose.Types.ObjectId().toString();
  await User.updateOne({ _id: user._id }, {
    $push: {
      sessions: {
        sessionId,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      },
    },
  });
  const token = jwt.sign({
    id: String(user._id), tv: 0, sid: sessionId,
  }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { user, token };
}

function response(data, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => ({ status: ok, data }) };
}

function mockInitialization() {
  global.fetch = jest.fn(async (url, options = {}) => {
    if (!String(url).includes('/transaction/initialize')) {
      throw new Error(`Unexpected remote call: ${String(url)}`);
    }
    const data = JSON.parse(options.body);
    return response({
      authorization_url: 'https://checkout.paystack.com/no-bad-vibes-mock-checkout',
      reference: data.reference,
    });
  });
}

async function startPurchase(tier = 'vip') {
  mockInitialization();
  return request(app).post('/api/event-tickets/checkout')
    .set(bearer(buyerToken)).send({ tier, amountKobo: 1 }).expect(201);
}

function mockVerification(ticket, overrides = {}) {
  global.fetch = jest.fn(async (url) => {
    if (!String(url).includes('/transaction/verify/')) {
      throw new Error(`Unexpected remote call: ${String(url)}`);
    }
    return response({
      status: 'success',
      reference: ticket.reference,
      amount: ticket.amountKobo,
      currency: 'NGN',
      customer: { email: ticket.buyerEmail },
      ...overrides,
    });
  });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  process.env.EVENT_NBV_ENABLED = 'true';
  global.fetch = originalFetch;
  ({ user: buyer, token: buyerToken } = await createUser('Ticket Buyer', 'ticket_buyer'));
  ({ token: otherToken } = await createUser('Other Buyer', 'other_buyer'));
  ({ token: adminToken } = await createUser('Ticket Admin', 'ticket_admin', 'admin'));
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env.EVENT_NBV_ENABLED = 'true';
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  } finally {
    await mongoose.disconnect().catch(() => null);
    if (mongod) await mongod.stop();
  }
});

describe('No Bad Vibes event ticket API', () => {
  test('exposes event configuration, and keeps sales closed behind its feature flag', async () => {
    process.env.EVENT_NBV_ENABLED = 'false';
    const config = await request(app).get('/api/event-tickets/config').expect(200);
    expect(config.body).toMatchObject({ enabled: false });
    expect(config.body.tiers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'vip', amountKobo: 1000000 }),
      expect.objectContaining({ id: 'table6', amountKobo: 10000000 }),
    ]));

    global.fetch = jest.fn();
    await request(app).post('/api/event-tickets/checkout')
      .set(bearer(buyerToken)).send({ tier: 'vip' }).expect(503);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('requires a real signed-in session to begin checkout', async () => {
    await request(app).post('/api/event-tickets/checkout')
      .send({ tier: 'vip' }).expect(401);
  });

  test('rejects unknown ticket categories without calling Paystack', async () => {
    global.fetch = jest.fn();
    await request(app).post('/api/event-tickets/checkout')
      .set(bearer(buyerToken)).send({ tier: 'fake' }).expect(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('uses authoritative server price despite a tampered client amount', async () => {
    const checkout = await startPurchase('table6');
    expect(checkout.body).toMatchObject({ testMode: true });
    expect(checkout.body.authorizationUrl).toMatch(/^https:\/\/checkout\.paystack\.com\//);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ amount: 10000000, currency: 'NGN', email: buyer.email });
    const ticket = await EventTicket.findOne({ reference: checkout.body.reference }).lean();
    expect(ticket).toMatchObject({ tier: 'table6', status: 'pending', amountKobo: 10000000, testMode: true });
  });

  test('only the purchaser can verify a payment reference', async () => {
    const checkout = await startPurchase();
    global.fetch = jest.fn();
    await request(app).get(`/api/event-tickets/verify/${checkout.body.reference}`)
      .set(bearer(otherToken)).expect(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('rejects a mismatched payment amount without issuing a ticket code', async () => {
    const checkout = await startPurchase();
    const ticket = await EventTicket.findOne({ reference: checkout.body.reference });
    mockVerification(ticket, { amount: ticket.amountKobo - 100 });
    const verification = await request(app)
      .get(`/api/event-tickets/verify/${ticket.reference}`)
      .set(bearer(buyerToken)).expect(200);
    expect(verification.body.verified).toBe(false);
    const stored = await EventTicket.findById(ticket._id).select('+ticketCode');
    expect(stored.status).toBe('pending');
    expect(stored.ticketCode).toBeFalsy();
  });

  test('issues a paid test ticket once and remains idempotent on repeat verification', async () => {
    const checkout = await startPurchase();
    const ticket = await EventTicket.findOne({ reference: checkout.body.reference });
    mockVerification(ticket);
    const url = `/api/event-tickets/verify/${ticket.reference}`;
    const first = await request(app).get(url).set(bearer(buyerToken)).expect(200);
    const second = await request(app).get(url).set(bearer(buyerToken)).expect(200);
    expect(first.body.verified).toBe(true);
    expect(first.body.ticket).toMatchObject({ status: 'paid', testMode: true });
    expect(first.body.ticket.ticketCode).toMatch(/^[a-f0-9]{48}$/);
    expect(second.body.ticket.ticketCode).toBe(first.body.ticket.ticketCode);
    expect(await EventTicket.countDocuments({ reference: ticket.reference })).toBe(1);
    const mine = await request(app).get('/api/event-tickets/mine')
      .set(bearer(buyerToken)).expect(200);
    expect(mine.body.tickets).toHaveLength(1);
    expect(mine.body.tickets[0].ticketCode).toBe(first.body.ticket.ticketCode);
  });

  test('uses the buyer Tengacion profile photo on issued ticket without a second upload', async () => {
    const localAvatar = `/api/media/${new mongoose.Types.ObjectId().toString()}`;
    await User.updateOne({ _id: buyer._id }, {
      $set: { avatar: { url: localAvatar, secureUrl: localAvatar } },
    });
    const checkout = await startPurchase('vip');
    const pending = await EventTicket.findOne({ reference: checkout.body.reference });
    mockVerification(pending);
    const verified = await request(app)
      .get(`/api/event-tickets/verify/${pending.reference}`)
      .set(bearer(buyerToken)).expect(200);
    expect(verified.body.ticket.attendeePhoto).toBe(localAvatar);

    const mine = await request(app).get('/api/event-tickets/mine')
      .set(bearer(buyerToken)).expect(200);
    expect(mine.body.tickets[0].attendeePhoto).toBe(localAvatar);
    expect(mine.body.tickets[0].admissions).toHaveLength(1);
  });

  test('rejects webhook calls without a valid Paystack signature', async () => {
    const payload = { event: 'charge.success', data: { reference: 'NVB26-0123456789abcdef01234567' } };
    await request(app).post('/api/event-tickets/webhook').send(payload).expect(401);
  });

  test('accepts an HMAC-signed webhook but never admits a test-mode ticket', async () => {
    const checkout = await startPurchase();
    const ticket = await EventTicket.findOne({ reference: checkout.body.reference });
    mockVerification(ticket);
    const payload = JSON.stringify({ event: 'charge.success', data: { reference: ticket.reference } });
    const signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(payload).digest('hex');
    await request(app).post('/api/event-tickets/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', signature)
      .send(payload).expect(200);
    const paid = await EventTicket.findById(ticket._id).select('+ticketCode');
    expect(paid.status).toBe('paid');
    expect(paid.testMode).toBe(true);
    await request(app).post(`/api/event-tickets/redeem/${paid.ticketCode}`)
      .set(bearer(adminToken)).expect(409);
  });
  test('Regular is ₦3,000 with 1,000 confirmed one-person admission slots', async () => {
    const config = await request(app).get('/api/event-tickets/config').expect(200);
    expect(config.body.tiers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'regular', amountKobo: 300000, amountNGN: 3000,
        capacity: 1000, seats: 1, inventoryConfirmed: true, available: 1000, purchasable: true }),
      expect.objectContaining({ id: 'vip', amountKobo: 1000000, capacity: 500, seats: 1, inventoryConfirmed: true }),
      expect.objectContaining({ id: 'table6', capacity: 500, seats: 6, inventoryConfirmed: true }),
      expect.objectContaining({ id: 'table8', capacity: 500, seats: 8, inventoryConfirmed: true }),
      expect.objectContaining({ id: 'exclusive', capacity: 500, seats: 10, inventoryConfirmed: true }),
    ]));
    const checkout = await startPurchase('regular');
    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload).toMatchObject({ email: buyer.email, amount: 300000, currency: 'NGN' });
    expect(await EventInventorySlot.countDocuments({ tier: 'regular', testMode: true })).toBe(1000);
    const ticket = await EventTicket.findOne({ reference: checkout.body.reference });
    expect(ticket).toMatchObject({ tier: 'regular', amountKobo: 300000, status: 'pending' });
    mockVerification(ticket);
    const verified = await request(app).get(`/api/event-tickets/verify/${ticket.reference}`)
      .set(bearer(buyerToken)).expect(200);
    expect(verified.body.verified).toBe(true);
    expect(verified.body.ticket.admissions).toHaveLength(1);
  });

  test('Regular cannot sell beyond 1,000 slots with concurrent attempts on the last slot', async () => {
    await startPurchase('regular');
    await EventInventorySlot.updateMany({ tier: 'regular', testMode: true, slotNumber: { $lte: 999 } },
      { $set: { status: 'sold', soldAt: new Date() } });
    mockInitialization();
    const [first, second] = await Promise.all([
      request(app).post('/api/event-tickets/checkout').set(bearer(buyerToken)).send({ tier: 'regular' }),
      request(app).post('/api/event-tickets/checkout').set(bearer(buyerToken)).send({ tier: 'regular' }),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await EventInventorySlot.countDocuments({ tier: 'regular', testMode: true })).toBe(1000);
    expect(await EventInventorySlot.countDocuments({ tier: 'regular', testMode: true,
      $or: [{ status: 'sold' }, { status: 'held', expiresAt: { $gt: new Date() } }] })).toBe(1000);
  });

  test('claims the final of 500 VIP slots atomically under simultaneous checkout requests', async () => {
    await startPurchase('vip'); // Creates exactly 500 numbered inventory slots.
    await EventInventorySlot.updateMany({ tier: 'vip', testMode: true, slotNumber: { $lte: 499 } },
      { $set: { status: 'sold', soldAt: new Date() } });
    mockInitialization();
    const [first, second] = await Promise.all([
      request(app).post('/api/event-tickets/checkout').set(bearer(buyerToken)).send({ tier: 'vip' }),
      request(app).post('/api/event-tickets/checkout').set(bearer(buyerToken)).send({ tier: 'vip' }),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await EventInventorySlot.countDocuments({ tier: 'vip', testMode: true })).toBe(500);
    expect(await EventInventorySlot.countDocuments({ tier: 'vip', testMode: true,
      $or: [{ status: 'sold' }, { status: 'held', expiresAt: { $gt: new Date() } }] })).toBe(500);
  });

  test('reclaims expired holds and flags late successful payments instead of overselling', async () => {
    const original = await startPurchase('vip');
    const originalTicket = await EventTicket.findOne({ reference: original.body.reference });
    const firstSlot = await EventInventorySlot.findOne({ reference: original.body.reference });
    await EventInventorySlot.updateOne({ _id: firstSlot._id },
      { $set: { expiresAt: new Date(Date.now() - 60000) } });
    const next = await startPurchase('vip');
    const secondSlot = await EventInventorySlot.findOne({ reference: next.body.reference });
    expect(secondSlot.slotNumber).toBe(firstSlot.slotNumber);
    mockVerification(originalTicket);
    const result = await request(app).get(`/api/event-tickets/verify/${originalTicket.reference}`)
      .set(bearer(buyerToken)).expect(200);
    expect(result.body).toMatchObject({ verified: false, status: 'paid_unfulfilled' });
    const unfulfilled = await EventTicket.findById(originalTicket._id).select('+ticketCode');
    expect(unfulfilled.refundReviewRequired).toBe(true);
    expect(unfulfilled.ticketCode).toBeFalsy();
    expect(unfulfilled.admissions).toHaveLength(0);
    expect(await EventInventorySlot.countDocuments({ reference: next.body.reference, status: 'held' })).toBe(1);
  });

  test('an unsuccessful Paystack initialization releases the held slot', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ status: false }) });
    await request(app).post('/api/event-tickets/checkout')
      .set(bearer(buyerToken)).send({ tier: 'table6' }).expect(502);
    expect(await EventInventorySlot.countDocuments({ tier: 'table6', status: 'held' })).toBe(0);
    expect(await EventTicket.countDocuments({ tier: 'table6', status: 'failed' })).toBe(1);
  });

  test.each([
    ['regular', 1], ['vip', 1], ['table6', 6], ['table8', 8], ['exclusive', 10],
  ])('%s issues %i separate guest admission credentials', async (tier, expectedSeats) => {
    const checkout = await startPurchase(tier);
    const pending = await EventTicket.findOne({ reference: checkout.body.reference });
    mockVerification(pending);
    const verified = await request(app).get(`/api/event-tickets/verify/${pending.reference}`)
      .set(bearer(buyerToken)).expect(200);
    const guests = verified.body.ticket.admissions;
    expect(guests).toHaveLength(expectedSeats);
    expect(new Set(guests.map(a => a.code)).size).toBe(expectedSeats);
    expect(guests.map(a => a.number)).toEqual(Array.from({ length: expectedSeats }, (_, n) => n + 1));
    guests.forEach(a => expect(a.code).toMatch(/^[a-f0-9]{48}$/));
  });

  test('a table admits each guest once, even if the same QR is scanned simultaneously', async () => {
    // Synthetic paid/live ticket: this tests admission atomics without using live Paystack.
    const admissions = Array.from({ length: 10 }, (_, n) => ({
      number: n + 1, code: crypto.randomBytes(24).toString('hex'),
    }));
    await EventTicket.create({
      buyer: buyer._id, buyerEmail: buyer.email, attendeeName: buyer.name,
      tier: 'exclusive', amountKobo: 50000000, reference: `NVB26-${crypto.randomBytes(12).toString('hex')}`,
      testMode: false, status: 'paid', ticketCode: admissions[0].code, admissions, paidAt: new Date(),
    });
    const firstCode = admissions[0].code;
    const [firstScan, duplicateScan] = await Promise.all([
      request(app).post(`/api/event-tickets/redeem/${firstCode}`).set(bearer(adminToken)),
      request(app).post(`/api/event-tickets/redeem/${firstCode}`).set(bearer(adminToken)),
    ]);
    expect([firstScan.status, duplicateScan.status].sort()).toEqual([200, 409]);
    const second = await request(app).post(`/api/event-tickets/redeem/${admissions[1].code}`)
      .set(bearer(adminToken)).expect(200);
    expect(second.body).toMatchObject({ admitted: true, admittedCount: 2, capacity: 10 });
    for (const guest of admissions.slice(2)) {
      await request(app).post(`/api/event-tickets/redeem/${guest.code}`)
        .set(bearer(adminToken)).expect(200);
    }
    const stored = await EventTicket.findOne({ ticketCode: firstCode });
    expect(stored.admissions.filter(a => a.redeemedAt)).toHaveLength(10);
    await request(app).post(`/api/event-tickets/redeem/${admissions[9].code}`)
      .set(bearer(adminToken)).expect(409);
    await request(app).post(`/api/event-tickets/redeem/${admissions[0].code}`)
      .set(bearer(otherToken)).expect(403);
  });

  test('concurrent successful verification creates only one set of guest codes', async () => {
    const checkout = await startPurchase('table8');
    const pending = await EventTicket.findOne({ reference: checkout.body.reference });
    mockVerification(pending);
    const url = `/api/event-tickets/verify/${pending.reference}`;
    const results = await Promise.all([
      request(app).get(url).set(bearer(buyerToken)),
      request(app).get(url).set(bearer(buyerToken)),
    ]);
    expect(results.map(r => r.status)).toEqual([200, 200]);
    expect(results.every(r => r.body.verified)).toBe(true);
    expect(results[0].body.ticket.admissions).toEqual(results[1].body.ticket.admissions);
    expect(await EventInventorySlot.countDocuments({ reference: pending.reference, status: 'sold' })).toBe(1);
    expect(await EventTicket.countDocuments({ reference: pending.reference, status: 'paid' })).toBe(1);
  });
});
