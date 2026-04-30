const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-raffle-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "recharge_raffle_test_secret_123456789012345";

const app = require("../app");
const RechargeRaffleCard = require("../models/RechargeRaffleCard");
const RechargeRafflePlay = require("../models/RechargeRafflePlay");
const Post = require("../models/Post");
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

const createUser = async ({
  role = "user",
  email = "raffle-user@example.com",
  username = "raffleuser",
  avatar = "",
} = {}) =>
  User.create({
    name: "Raffle User",
    username,
    email,
    password: "Password123!",
    role,
    isVerified: true,
    emailVerified: true,
    ...(avatar ? { avatar: { url: avatar, secureUrl: avatar } } : {}),
  });

describe("recharge raffle routes", () => {
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

  test("users must upload a profile picture before spinning", async () => {
    const user = await createUser();
    const token = await issueSessionToken(user._id);

    const statusResponse = await request(app)
      .get("/api/recharge-raffle/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(statusResponse.body.eligibility.eligible).toBe(false);
    expect(statusResponse.body.eligibility.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "avatar", complete: false }),
      ])
    );

    const spinResponse = await request(app)
      .post("/api/recharge-raffle/spin")
      .set("Authorization", `Bearer ${token}`)
      .send({ network: "mtn" })
      .expect(403);

    expect(spinResponse.body.code).toBe("not_eligible");
  });

  test("admin can load cards and an eligible user wins within five spins", async () => {
    const admin = await createUser({
      role: "admin",
      email: "raffle-admin@example.com",
      username: "raffleadmin",
      avatar: "/uploads/admin-avatar.jpg",
    });
    const user = await createUser({
      email: "winner@example.com",
      username: "winner",
      avatar: "/uploads/winner-avatar.jpg",
    });
    const adminToken = await issueSessionToken(admin._id);
    const userToken = await issueSessionToken(user._id);
    const pins = ["1234567890123456", "12345678901234567"];

    const loadResponse = await request(app)
      .post("/api/admin/raffle/cards/bulk")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        network: "mtn",
        pins: pins.join("\n"),
        batchLabel: "April test batch",
      })
      .expect(201);

    expect(loadResponse.body.createdCount).toBe(2);
    expect(await RechargeRaffleCard.countDocuments({ status: "available" })).toBe(2);

    let winningBody = null;
    for (let index = 0; index < 5; index += 1) {
      const response = await request(app)
        .post("/api/recharge-raffle/spin")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ network: "mtn" })
        .expect(200);

      if (response.body.play?.prize) {
        winningBody = response.body;
        break;
      }
    }

    expect(winningBody).toBeTruthy();
    expect(winningBody.play.spinsUsed).toBeLessThanOrEqual(5);
    expect(winningBody.play.prize).toMatchObject({
      network: "mtn",
      amount: 100,
    });
    expect(pins).toContain(winningBody.play.prize.pin);
    expect(winningBody.play.prize.dialCodes).toContain(`*555*${winningBody.play.prize.pin}#`);

    const rateLimitResponse = await request(app)
      .post("/api/recharge-raffle/spin")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ network: "mtn" })
      .expect(200);

    expect(rateLimitResponse.body.rateLimited).toBe(true);
    expect(rateLimitResponse.body.play.prize.pin).toBe(winningBody.play.prize.pin);
    expect(rateLimitResponse.body.cooldown.active).toBe(true);

    await RechargeRafflePlay.updateOne(
      { _id: winningBody.play._id },
      { $set: { nextAvailableAt: new Date(Date.now() - 1000) } }
    );

    const repeatBlockedResponse = await request(app)
      .post("/api/recharge-raffle/spin")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ network: "mtn" })
      .expect(403);

    expect(repeatBlockedResponse.body.eligibility.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "feed_post", complete: false }),
      ])
    );

    await Post.create({
      author: user._id,
      text: "Back on my feed before the next Spin & Win round.",
      type: "text",
      privacy: "public",
      visibility: "public",
    });

    const repeatAllowedResponse = await request(app)
      .post("/api/recharge-raffle/spin")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ network: "mtn" })
      .expect(200);

    expect(repeatAllowedResponse.body.eligibility.eligible).toBe(true);
    expect(repeatAllowedResponse.body.play.spinsUsed).toBeGreaterThanOrEqual(1);
  });

  test("admin bulk loading rejects invalid network PIN lengths", async () => {
    const admin = await createUser({
      role: "admin",
      email: "raffle-admin-invalid@example.com",
      username: "raffleadmininvalid",
      avatar: "/uploads/admin-avatar.jpg",
    });
    const adminToken = await issueSessionToken(admin._id);

    const response = await request(app)
      .post("/api/admin/raffle/cards/bulk")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        network: "airtel",
        pins: "12345678901234567",
      })
      .expect(400);

    expect(response.body.code).toBe("no_valid_pins");
    expect(response.body.invalidEntries[0].error).toMatch(/Airtel N100 PINs must be 16 digits/);
  });
});
