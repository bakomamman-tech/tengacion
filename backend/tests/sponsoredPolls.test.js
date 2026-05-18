const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-sponsored-polls-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "sponsored_poll_test_secret_123456789012345";

const app = require("../app");
const SponsoredPollResponse = require("../models/SponsoredPollResponse");
const User = require("../models/User");

let mongod;

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
    {
      id: userId.toString(),
      tv: 0,
      sid: sessionId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
};

const createUser = async ({ role = "user", email = "parent@example.com", username = "parent" } = {}) =>
  User.create({
    name: "Parent Example",
    username,
    email,
    password: "Password123!",
    role,
    isVerified: true,
    emailVerified: true,
  });

describe("sponsored poll routes", () => {
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

  test("public parents can vote once per phone and update that vote", async () => {
    const firstResponse = await request(app)
      .post("/api/sponsored-polls/onward-baptist-childrens-day/vote")
      .send({ phone: "+2348012345678", vote: "yes" })
      .expect(201);

    expect(firstResponse.body).toMatchObject({
      success: true,
      created: true,
      stats: { yes: 1, no: 0, total: 1 },
      response: { phone: "+2348012345678", vote: "yes" },
    });
    expect(await SponsoredPollResponse.countDocuments({})).toBe(1);

    const updateResponse = await request(app)
      .post("/api/sponsored-polls/onward-baptist-childrens-day/vote")
      .send({ phone: "+2348012345678", vote: "no" })
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      success: true,
      created: false,
      stats: { yes: 0, no: 1, total: 1 },
      response: { phone: "+2348012345678", vote: "no" },
    });
    expect(await SponsoredPollResponse.countDocuments({})).toBe(1);
  });

  test("rejects invalid poll submissions", async () => {
    const response = await request(app)
      .post("/api/sponsored-polls/onward-baptist-childrens-day/vote")
      .send({ phone: "123", vote: "maybe" })
      .expect(400);

    expect(response.body.error).toMatch(/valid parent phone number/i);
    expect(await SponsoredPollResponse.countDocuments({})).toBe(0);
  });

  test("admin users can list parent poll responses", async () => {
    const admin = await createUser({
      role: "admin",
      email: "admin-polls@example.com",
      username: "admin_polls",
    });
    const adminToken = await issueSessionToken(admin._id);

    await SponsoredPollResponse.create({
      pollSlug: "onward-baptist-childrens-day",
      pollTitle: "Onward Baptist's Children's Day Celebration",
      phone: "+2348099999999",
      normalizedPhone: "2348099999999",
      vote: "yes",
    });

    const response = await request(app)
      .get("/api/sponsored-polls/onward-baptist-childrens-day/responses")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      total: 1,
      stats: { yes: 1, no: 0, total: 1 },
    });
    expect(response.body.responses[0]).toMatchObject({
      phone: "+2348099999999",
      vote: "yes",
    });
  });
});
