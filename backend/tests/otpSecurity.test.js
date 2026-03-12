const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.EMAIL_USER = "security@test.local";
process.env.EMAIL_PASS = "secret";
require("../../apps/api/config/env");

jest.mock("../utils/sendOtpEmail", () => jest.fn().mockResolvedValue(undefined));
jest.mock("../utils/sendSecurityEmail", () => jest.fn().mockResolvedValue(undefined));

const AuthService = require("../../apps/api/services/authService");
const Otp = require("../models/Otp");
const sendOtpEmail = require("../utils/sendOtpEmail");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });

  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });
});

beforeEach(async () => {
  jest.clearAllMocks();
  await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
  } finally {
    await mongoose.disconnect().catch(() => null);
    if (mongod) {
      await mongod.stop();
    }
  }
});

describe("OTP hardening", () => {
  test("stores hashed OTP state and enforces resend cooldown", async () => {
    await AuthService.requestOtp("otp@test.com");

    const record = await Otp.findOne({ email: "otp@test.com" }).lean();
    expect(record).toBeTruthy();
    expect(record.otpHash).toBeTruthy();
    expect(record.otp).toBe("");
    expect(record.resendCount).toBe(1);
    expect(sendOtpEmail).toHaveBeenCalledTimes(1);

    await expect(AuthService.requestOtp("otp@test.com")).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  test("locks OTP verification after repeated invalid attempts", async () => {
    await AuthService.requestOtp("lock@test.com");

    for (let i = 0; i < 4; i += 1) {
      await expect(
        AuthService.verifyOtp({ email: "lock@test.com", otp: "000000" })
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    }

    await expect(
      AuthService.verifyOtp({ email: "lock@test.com", otp: "111111" })
    ).rejects.toMatchObject({
      statusCode: 429,
    });

    const record = await Otp.findOne({ email: "lock@test.com" }).lean();
    expect(record.attemptCount).toBe(5);
    expect(record.lockedUntil).toBeTruthy();

    await expect(
      AuthService.verifyOtp({ email: "lock@test.com", otp: "222222" })
    ).rejects.toMatchObject({
      statusCode: 429,
    });
  });
});
