const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-top-up-promo-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "top_up_promo_test_secret_123456789012345";

const app = require("../app");
const TopUpPromoPlay = require("../models/TopUpPromoPlay");
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
    { id: userId.toString(), tv: 0, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
};

const createUser = ({
  name = "Promo Explorer",
  username = "promo_explorer",
  email = "promo-explorer@example.com",
  phone = "+2348164649980",
  role = "user",
} = {}) =>
  User.create({
    name,
    username,
    email,
    phone,
    password: "Password123!",
    role,
    isVerified: true,
    emailVerified: true,
  });

describe("Top-Up Bank Account Promo routes", () => {
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
    await TopUpPromoPlay.syncIndexes();
    app.set("io", undefined);
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
      }
    } finally {
      await mongoose.disconnect().catch(() => null);
      if (mongod) await mongod.stop();
    }
  });

  test("a winning chest issues one unique passcode and repeat clicks return the same play", async () => {
    const user = await createUser();
    const token = await issueSessionToken(user._id);

    const statusResponse = await request(app)
      .get("/api/top-up-promo/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(statusResponse.body.visibility).toMatchObject({ visible: true, reason: "available" });
    expect(statusResponse.body.hasPlayed).toBe(false);
    expect(statusResponse.body.campaign).toMatchObject({
      title: "Top-Up Bank Account Promo",
      totalChests: 50,
      prizeChests: 2,
      prizeAmount: 5000,
    });
    expect(statusResponse.body).toMatchObject({
      discoveredChestNumbers: [],
      remainingChests: 50,
    });

    const winResponse = await request(app)
      .post("/api/top-up-promo/discover")
      .set("Authorization", `Bearer ${token}`)
      .send({ chestNumber: 4 })
      .expect(200);

    expect(winResponse.body.play).toMatchObject({
      chestNumber: 4,
      outcome: "win",
      won: true,
      prizeAmount: 5000,
    });
    expect(winResponse.body.play.passcode).toMatch(/^[A-Z0-9]{8}$/);
    expect(winResponse.body).toMatchObject({
      discoveredChestNumbers: [4],
      remainingChests: 49,
    });

    const repeatResponse = await request(app)
      .post("/api/top-up-promo/discover")
      .set("Authorization", `Bearer ${token}`)
      .send({ chestNumber: 1 })
      .expect(200);

    expect(repeatResponse.body.alreadyPlayed).toBe(true);
    expect(repeatResponse.body.play.id).toBe(winResponse.body.play.id);
    expect(repeatResponse.body.play.passcode).toBe(winResponse.body.play.passcode);
    expect(await TopUpPromoPlay.countDocuments({ userId: user._id })).toBe(1);
  });

  test("each revealed chest disappears globally and concurrent users cannot consume it twice", async () => {
    const emit = jest.fn();
    app.set("io", { emit });
    const firstUser = await createUser({
      username: "first_global_explorer",
      email: "first-global@example.com",
      phone: "+2348000000011",
    });
    const secondUser = await createUser({
      username: "second_global_explorer",
      email: "second-global@example.com",
      phone: "+2348000000012",
    });
    const [firstToken, secondToken] = await Promise.all([
      issueSessionToken(firstUser._id),
      issueSessionToken(secondUser._id),
    ]);

    const responses = await Promise.all([
      request(app)
        .post("/api/top-up-promo/discover")
        .set("Authorization", `Bearer ${firstToken}`)
        .send({ chestNumber: 8 }),
      request(app)
        .post("/api/top-up-promo/discover")
        .set("Authorization", `Bearer ${secondToken}`)
        .send({ chestNumber: 8 }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await TopUpPromoPlay.countDocuments({ chestNumber: 8 })).toBe(1);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("top-up-promo:discovered", {
      chestNumber: 8,
      discoveredChestNumbers: [8],
      remainingChests: 49,
    });

    const rejectedResponse = responses.find((response) => response.status === 409);
    expect(rejectedResponse.body).toMatchObject({
      code: "chest_already_discovered",
      discoveredChestNumbers: [8],
      remainingChests: 49,
    });

    const secondStatus = await request(app)
      .get("/api/top-up-promo/me")
      .set("Authorization", `Bearer ${secondToken}`)
      .expect(200);
    expect(secondStatus.body.discoveredChestNumbers).toEqual([8]);
    expect(secondStatus.body.remainingChests).toBe(49);
  });

  test("water outcomes and winner contact snapshots are available to admins", async () => {
    const waterUser = await createUser({
      name: "Water Explorer",
      username: "water_explorer",
      email: "water@example.com",
      phone: "+2348000000001",
    });
    const winner = await createUser({
      name: "Gold Explorer",
      username: "gold_explorer",
      email: "gold@example.com",
      phone: "+2348000000002",
    });
    const admin = await createUser({
      name: "Promo Admin",
      username: "promo_admin",
      email: "promo-admin@example.com",
      phone: "+2348000000003",
      role: "admin",
    });
    const [waterToken, winnerToken, adminToken] = await Promise.all([
      issueSessionToken(waterUser._id),
      issueSessionToken(winner._id),
      issueSessionToken(admin._id),
    ]);

    const waterResponse = await request(app)
      .post("/api/top-up-promo/discover")
      .set("Authorization", `Bearer ${waterToken}`)
      .send({ chestNumber: 1 })
      .expect(200);
    expect(waterResponse.body.play).toMatchObject({ outcome: "water", won: false, passcode: "" });

    await request(app)
      .post("/api/top-up-promo/discover")
      .set("Authorization", `Bearer ${winnerToken}`)
      .send({ chestNumber: 11 })
      .expect(200);

    const adminList = await request(app)
      .get("/api/admin/top-up-promo/plays")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(adminList.body.summary).toMatchObject({
      totalDiscoveries: 2,
      winners: 1,
      waterDiscoveries: 1,
      prizeLiability: 5000,
    });
    expect(adminList.body.plays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Water Explorer",
          email: "water@example.com",
          phone: "+2348000000001",
          outcome: "water",
        }),
        expect.objectContaining({
          name: "Gold Explorer",
          email: "gold@example.com",
          phone: "+2348000000002",
          outcome: "win",
        }),
      ])
    );
  });

  test("administrator accounts never receive homepage promo discoveries", async () => {
    const admin = await createUser({
      username: "excluded_admin",
      email: "excluded-admin@example.com",
      role: "admin",
    });
    const token = await issueSessionToken(admin._id);

    const statusResponse = await request(app)
      .get("/api/top-up-promo/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(statusResponse.body.visibility).toMatchObject({
      visible: false,
      reason: "admin_account",
    });

    await request(app)
      .post("/api/top-up-promo/discover")
      .set("Authorization", `Bearer ${token}`)
      .send({ chestNumber: 4 })
      .expect(403);

    expect(await TopUpPromoPlay.countDocuments({ userId: admin._id })).toBe(0);
  });

  test("accepts chest 50 and rejects numbers outside the expanded campaign", async () => {
    const user = await createUser({
      username: "fiftieth_explorer",
      email: "fiftieth@example.com",
    });
    const token = await issueSessionToken(user._id);

    await request(app)
      .post("/api/top-up-promo/discover")
      .set("Authorization", `Bearer ${token}`)
      .send({ chestNumber: 51 })
      .expect(400);

    const response = await request(app)
      .post("/api/top-up-promo/discover")
      .set("Authorization", `Bearer ${token}`)
      .send({ chestNumber: 50 })
      .expect(200);

    expect(response.body.play).toMatchObject({
      chestNumber: 50,
      outcome: "water",
      won: false,
      passcode: "",
    });
  });
});
