const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { PDFDocument } = require("pdf-lib");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-school-tuition-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";
process.env.PAYSTACK_SECRET_KEY = "sk_test_school_tuition_1234567890";
process.env.PAYSTACK_REQUIRE_LIVE_KEY = "false";
process.env.PAYSTACK_CURRENCY = "NGN";
process.env.APP_URL = "https://tengacion.test";

const app = require("../app");
const PaymentWebhookEvent = require("../models/PaymentWebhookEvent");
const SchoolTuitionPayment = require("../models/SchoolTuitionPayment");
const User = require("../models/User");

let mongod;
let adminToken;
const originalFetch = global.fetch;

const parseBinary = (res, callback) => {
  res.setEncoding("binary");
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => callback(null, Buffer.from(data, "binary")));
};

const issueSessionToken = async (userId) => {
  const sessionId = new mongoose.Types.ObjectId().toString();
  await User.updateOne(
    { _id: userId },
    {
      $push: {
        sessions: {
          sessionId,
          createdAt: new Date(),
          lastSeenAt: new Date(),
        },
      },
    }
  );

  return jwt.sign(
    { id: userId.toString(), tv: 0, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
};

const validPayload = {
  parentName: "Grace Parent",
  childName: "Ada Learner",
  childClass: "Primary 2",
  bankName: "Opay",
  email: "grace@example.com",
  homeAddress: "12 Narayi Road, Kaduna",
  phoneNumber: "08030000000",
  amount: 25000,
  sourcePath: "/kurahtechandartsacademy",
};

const mockPaystack = (data) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: true, data }),
  });
};

const initializePayment = async () => {
  mockPaystack({
    authorization_url: "https://paystack.test/tuition-checkout",
    access_code: "TUITION_ACCESS",
    status: "pending",
  });
  return request(app)
    .post("/api/schools/public/kurahtechandartsacademy/tuition-payments/initialize")
    .send(validPayload)
    .expect(201);
};

describe("School tuition Paystack payments", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
    await mongoose.connect(mongod.getUri(), {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    });
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    global.fetch = originalFetch;
    const admin = await User.create({
      name: "Tuition Admin",
      username: "tuition_admin",
      email: "tuition-admin@example.com",
      password: "Password123!",
      role: "admin",
      isVerified: true,
      emailVerified: true,
    });
    adminToken = await issueSessionToken(admin._id);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => null);
    if (mongod) await mongod.stop();
  });

  test("validates the public parent form before calling Paystack", async () => {
    const response = await request(app)
      .post("/api/schools/public/kurahtechandartsacademy/tuition-payments/initialize")
      .send({ parentName: "Only one field" })
      .expect(400);

    expect(response.body.message || response.body.error).toMatch(/validation failed/i);
    expect(await SchoolTuitionPayment.countDocuments()).toBe(0);
  });

  test("stores parent and learner details and exposes them only to admin", async () => {
    const response = await initializePayment();
    expect(response.body.authorization_url).toBe("https://paystack.test/tuition-checkout");
    expect(response.body.reference).toMatch(/^TGN_SCHOOL_TUITION_/);

    const paystackPayload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(paystackPayload.amount).toBe(2500000);
    expect(paystackPayload.currency).toBe("NGN");
    expect(paystackPayload.callback_url).toContain("/kurahtechandartsacademy?tuition=verify");
    expect(paystackPayload.channels).toEqual(["card", "bank", "ussd", "bank_transfer"]);

    const stored = await SchoolTuitionPayment.findOne({ reference: response.body.reference }).lean();
    expect(stored).toMatchObject({
      schoolSlug: "kurahtechandartsacademy",
      parentName: validPayload.parentName,
      childName: validPayload.childName,
      childClass: validPayload.childClass,
      bankName: validPayload.bankName,
      email: validPayload.email,
      homeAddress: validPayload.homeAddress,
      phoneNumber: validPayload.phoneNumber,
      amount: validPayload.amount,
      status: "pending",
    });

    await request(app).get("/api/admin/tuition-payments").expect(401);
    const adminResponse = await request(app)
      .get("/api/admin/tuition-payments?schoolSlug=kurahtechandartsacademy")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(adminResponse.body.payments).toHaveLength(1);
    expect(adminResponse.body.payments[0]).toMatchObject({
      parentName: validPayload.parentName,
      childName: validPayload.childName,
      homeAddress: validPayload.homeAddress,
      reference: response.body.reference,
    });
  });

  test("marks tuition paid only after exact server-side Paystack verification", async () => {
    const initResponse = await initializePayment();
    const reference = initResponse.body.reference;

    mockPaystack({
      id: 9081,
      status: "success",
      reference,
      amount: 2500000,
      currency: "NGN",
      channel: "bank_transfer",
      paid_at: "2026-06-29T12:00:00.000Z",
      authorization: { bank: "OPAY" },
    });

    const verifyResponse = await request(app)
      .get(`/api/schools/public/kurahtechandartsacademy/tuition-payments/verify/${reference}`)
      .expect(200);

    expect(verifyResponse.body).toMatchObject({
      success: true,
      verified: true,
      status: "paid",
    });
    expect(verifyResponse.body.payment).toMatchObject({
      childName: validPayload.childName,
      childClass: validPayload.childClass,
      amount: validPayload.amount,
      status: "paid",
    });

    const stored = await SchoolTuitionPayment.findOne({ reference }).lean();
    expect(stored.status).toBe("paid");
    expect(stored.paymentChannel).toBe("bank_transfer");
    expect(stored.verifiedBankName).toBe("OPAY");

    const receiptResponse = await request(app)
      .get(`/api/schools/public/kurahtechandartsacademy/tuition-payments/receipt/${reference}`)
      .buffer(true)
      .parse(parseBinary)
      .expect(200);
    expect(receiptResponse.headers["content-type"]).toContain("application/pdf");
    expect(receiptResponse.headers["content-disposition"]).toContain("tuition-receipt-");
    expect(receiptResponse.headers["cache-control"]).toContain("no-store");
    const receiptPdf = await PDFDocument.load(receiptResponse.body);
    expect(receiptPdf.getPageCount()).toBe(1);
  });

  test("rejects a successful Paystack response when the amount does not match", async () => {
    const initResponse = await initializePayment();
    const reference = initResponse.body.reference;

    mockPaystack({
      id: 9082,
      status: "success",
      reference,
      amount: 2400000,
      currency: "NGN",
    });

    const verifyResponse = await request(app)
      .get(`/api/schools/public/kurahtechandartsacademy/tuition-payments/verify/${reference}`)
      .expect(200);

    expect(verifyResponse.body).toMatchObject({
      success: false,
      verified: false,
      status: "failed",
    });
    const stored = await SchoolTuitionPayment.findOne({ reference }).lean();
    expect(stored.status).toBe("failed");
    expect(stored.failureReason).toMatch(/amount did not match/i);
    expect(stored.paidAt).toBeNull();
    await request(app)
      .get(`/api/schools/public/kurahtechandartsacademy/tuition-payments/receipt/${reference}`)
      .expect(409);
  });

  test("routes signed Paystack webhooks to tuition records idempotently", async () => {
    const initResponse = await initializePayment();
    const reference = initResponse.body.reference;
    const payload = {
      event: "charge.success",
      data: { id: 701, reference, amount: 2500000, currency: "NGN" },
    };
    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    mockPaystack({
      id: 701,
      status: "success",
      reference,
      amount: 2500000,
      currency: "NGN",
      channel: "card",
    });

    await request(app)
      .post("/api/payments/paystack/webhook")
      .set("x-paystack-signature", signature)
      .send(payload)
      .expect(200);
    await request(app)
      .post("/api/payments/paystack/webhook")
      .set("x-paystack-signature", signature)
      .send(payload)
      .expect(200);

    const stored = await SchoolTuitionPayment.findOne({ reference }).lean();
    expect(stored.status).toBe("paid");
    expect(await PaymentWebhookEvent.countDocuments({ providerRef: reference })).toBe(1);
  });
});
