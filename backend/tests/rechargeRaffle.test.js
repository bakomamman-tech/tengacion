const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-raffle-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "recharge_raffle_test_secret_123456789012345";

const app = require("../app");
const RechargeRaffleCard = require("../models/RechargeRaffleCard");
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
  phone = "",
  country = "",
  dob = null,
  gender = "",
  onboarding = undefined,
} = {}) =>
  User.create({
    name: "Raffle User",
    username,
    email,
    password: "Password123!",
    role,
    isVerified: true,
    emailVerified: true,
    ...(phone ? { phone } : {}),
    ...(country ? { country } : {}),
    ...(dob ? { dob } : {}),
    ...(gender ? { gender } : {}),
    ...(onboarding ? { onboarding } : {}),
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

  test("new and incomplete users can see and play before uploading a profile picture", async () => {
    const user = await createUser();
    const token = await issueSessionToken(user._id);
    await RechargeRaffleCard.create({
      network: "mtn",
      amount: 100,
      pin: "1234567890123456",
    });

    const statusResponse = await request(app)
      .get("/api/recharge-raffle/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(statusResponse.body.visibility.visible).toBe(true);
    expect(statusResponse.body.eligibility.eligible).toBe(true);
    expect(statusResponse.body.eligibility.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "profile", complete: false }),
        expect.objectContaining({ id: "avatar", complete: false }),
      ])
    );

    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.99);
    let spinResponse;
    try {
      spinResponse = await request(app)
        .post("/api/recharge-raffle/spin")
        .set("Authorization", `Bearer ${token}`)
        .send({ network: "mtn" })
        .expect(200);
    } finally {
      randomSpy.mockRestore();
    }

    expect(spinResponse.body.spin.won).toBe(false);
    expect(spinResponse.body.visibility.visible).toBe(true);
  });

  test("admin can load cards and a user win hides the raffle on future requests", async () => {
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

    expect(winningBody.visibility).toMatchObject({
      visible: false,
      reason: "claimed_win",
      hasClaimedWin: true,
    });

    const hiddenStatusResponse = await request(app)
      .get("/api/recharge-raffle/me")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    expect(hiddenStatusResponse.body.visibility).toMatchObject({
      visible: false,
      reason: "claimed_win",
      hasClaimedWin: true,
    });
    expect(hiddenStatusResponse.body.play).toBeNull();
    expect(hiddenStatusResponse.body.canSpin).toBe(false);

    const blockedSpinResponse = await request(app)
      .post("/api/recharge-raffle/spin")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ network: "mtn" })
      .expect(403);

    expect(blockedSpinResponse.body.code).toBe("raffle_unavailable");
    expect(blockedSpinResponse.body.visibility.reason).toBe("claimed_win");
  });

  test("completed profiles with uploaded photos do not see or play the raffle", async () => {
    const user = await createUser({
      email: "complete-profile@example.com",
      username: "completeprofile",
      avatar: "/uploads/complete-avatar.jpg",
      phone: "+2348012345678",
      country: "Nigeria",
      dob: new Date("1998-05-12T00:00:00.000Z"),
      gender: "female",
    });
    const token = await issueSessionToken(user._id);

    const statusResponse = await request(app)
      .get("/api/recharge-raffle/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(statusResponse.body.visibility).toMatchObject({
      visible: false,
      reason: "profile_complete_with_photo",
      profileDetailsComplete: true,
      profilePhotoComplete: true,
    });
    expect(statusResponse.body.play).toBeNull();
    expect(statusResponse.body.canSpin).toBe(false);

    const spinResponse = await request(app)
      .post("/api/recharge-raffle/spin")
      .set("Authorization", `Bearer ${token}`)
      .send({ network: "mtn" })
      .expect(403);

    expect(spinResponse.body.code).toBe("raffle_unavailable");
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
