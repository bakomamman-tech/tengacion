const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-test-secret-test-secret-123";
process.env.EMAIL_USER = "security@test.local";
process.env.EMAIL_PASS = "secret";
require("../../apps/api/config/env");

jest.mock("../utils/sendOtpEmail", () => jest.fn().mockResolvedValue(undefined));
jest.mock("../utils/sendSecurityEmail", () => jest.fn().mockResolvedValue(undefined));

const AuthService = require("../../apps/api/services/authService");
const User = require("../models/User");
const sendSecurityEmail = require("../utils/sendSecurityEmail");

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

describe("registration contact validation", () => {
  test("requires email and mobile number", async () => {
    await expect(
      AuthService.register({
        name: "Missing Phone",
        username: "missing_phone",
        email: "missing@example.com",
        country: "Nigeria",
        stateOfOrigin: "Lagos",
        password: "Password123!",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Username, email, mobile number, and password are required",
    });
  });

  test("accepts international mobile numbers from any country", async () => {
    const result = await AuthService.register({
      name: "Global User",
      username: "global_user",
      email: "global.user@example.com",
      phone: "+234 803 123 4567",
      country: "Nigeria",
      stateOfOrigin: "Lagos",
      password: "Password123!",
    });

    expect(result).toMatchObject({
      token: expect.any(String),
      user: expect.objectContaining({
        email: "global.user@example.com",
        phone: "+234 803 123 4567",
        country: "Nigeria",
        stateOfOrigin: "Lagos",
      }),
    });

    const stored = await User.findOne({ email: "global.user@example.com" }).lean();
    expect(stored).toBeTruthy();
    expect(stored.phone).toBe("+234 803 123 4567");
    expect(stored.country).toBe("Nigeria");
    expect(stored.stateOfOrigin).toBe("Lagos");
    expect(sendSecurityEmail).toHaveBeenCalled();
  });

  test("requires country and state of origin", async () => {
    await expect(
      AuthService.register({
        name: "Missing Location",
        username: "missing_location",
        email: "missing.location@example.com",
        phone: "+234 803 123 4567",
        password: "Password123!",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Country and state of origin are required",
    });
  });
});
