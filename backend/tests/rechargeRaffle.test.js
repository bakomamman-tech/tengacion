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
  name = "Raffle User",
  role = "user",
  email = "raffle-user@example.com",
  username = "raffleuser",
  avatar = "",
  cover = "",
  phone = "",
  country = "",
  dob = null,
  gender = "",
  onboarding = undefined,
} = {}) =>
  User.create({
    name,
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
    ...(cover ? { cover: { url: cover, secureUrl: cover } } : {}),
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

  test("new users can see the raffle but cannot play without profile and cover photos", async () => {
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
    expect(statusResponse.body.eligibility.eligible).toBe(false);
    expect(statusResponse.body.eligibility.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "avatar", complete: false }),
        expect.objectContaining({ id: "cover", complete: false }),
      ])
    );

    const spinResponse = await request(app)
      .post("/api/recharge-raffle/spin")
      .set("Authorization", `Bearer ${token}`)
      .send({ network: "mtn" })
      .expect(403);

    expect(spinResponse.body).toMatchObject({
      code: "profile_media_required",
      error: "Upload a profile picture and cover photo to be able to play",
    });
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
      cover: "/uploads/winner-cover.jpg",
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

    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);
    let winningBody;
    try {
      const response = await request(app)
        .post("/api/recharge-raffle/spin")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ network: "mtn" })
        .expect(200);
      winningBody = response.body;
    } finally {
      randomSpy.mockRestore();
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

  test("Stephen Daniel Kurah's designated email always sees and wins the raffle", async () => {
    const user = await createUser({
      name: "Stephen Daniel Kurah",
      email: "tmintldo4_life@yahoo.com",
      username: "pyrexx_singz",
      phone: "+2348012345678",
      country: "Nigeria",
      dob: new Date("1990-01-01T00:00:00.000Z"),
      gender: "male",
      onboarding: { completed: true },
    });
    const token = await issueSessionToken(user._id);
    const pins = ["1234567890123456", "12345678901234567"];

    await RechargeRaffleCard.insertMany(
      pins.map((pin) => ({ network: "mtn", amount: 100, pin }))
    );

    const firstSpin = await request(app)
      .post("/api/recharge-raffle/spin")
      .set("Authorization", `Bearer ${token}`)
      .send({ network: "mtn" })
      .expect(200);

    expect(firstSpin.body).toMatchObject({
      demoAccess: true,
      spin: { won: true },
      visibility: {
        visible: true,
        reason: "demo_access",
        hasClaimedWin: true,
      },
      cooldown: { active: false },
      canSpin: true,
    });

    const secondSpin = await request(app)
      .post("/api/recharge-raffle/spin")
      .set("Authorization", `Bearer ${token}`)
      .send({ network: "mtn" })
      .expect(200);

    expect(secondSpin.body).toMatchObject({
      demoAccess: true,
      spin: { won: true },
      visibility: { visible: true, reason: "demo_access" },
      cooldown: { active: false },
      canSpin: true,
    });
    expect(secondSpin.body.play._id).not.toBe(firstSpin.body.play._id);
    expect(pins).toContain(firstSpin.body.spin.prize.pin);
    expect(pins).toContain(secondSpin.body.spin.prize.pin);
    expect(secondSpin.body.spin.prize.pin).not.toBe(firstSpin.body.spin.prize.pin);
    expect(await RechargeRaffleCard.countDocuments({ status: "claimed" })).toBe(2);

    const emptyStockSpin = await request(app)
      .post("/api/recharge-raffle/spin")
      .set("Authorization", `Bearer ${token}`)
      .send({ network: "mtn" })
      .expect(409);

    expect(emptyStockSpin.body.code).toBe("no_cards_available");
  });

  test("users with profile and cover photos remain visible and can play until they win", async () => {
    const user = await createUser({
      email: "complete-profile@example.com",
      username: "completeprofile",
      avatar: "/uploads/complete-avatar.jpg",
      cover: "/uploads/complete-cover.jpg",
      phone: "+2348012345678",
      country: "Nigeria",
      dob: new Date("1998-05-12T00:00:00.000Z"),
      gender: "female",
    });
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

    expect(statusResponse.body.visibility).toMatchObject({
      visible: true,
      reason: "available",
      profileDetailsComplete: true,
      profilePhotoComplete: true,
      coverPhotoComplete: true,
    });
    expect(statusResponse.body.eligibility.eligible).toBe(true);
    expect(statusResponse.body.canSpin).toBe(true);

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

  test("a failed five-spin round needs one hour and a new post before replay", async () => {
    const user = await createUser({
      email: "repeat-player@example.com",
      username: "repeatplayer",
      avatar: "/uploads/repeat-avatar.jpg",
      cover: "/uploads/repeat-cover.jpg",
    });
    const token = await issueSessionToken(user._id);
    await RechargeRaffleCard.create({
      network: "mtn",
      amount: 100,
      pin: "1234567890123456",
    });

    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.99);
    let finalAttempt;
    try {
      for (let index = 0; index < 5; index += 1) {
        finalAttempt = await request(app)
          .post("/api/recharge-raffle/spin")
          .set("Authorization", `Bearer ${token}`)
          .send({ network: "mtn" })
          .expect(200);
      }
    } finally {
      randomSpy.mockRestore();
    }

    expect(finalAttempt.body).toMatchObject({
      rateLimited: true,
      spin: {
        won: false,
        roundExhausted: true,
        message: "Try after one hour but you must make a post to activate the game again.",
      },
      play: {
        status: "exhausted",
        spinsUsed: 5,
        spinsRemaining: 0,
      },
      cooldown: { active: true },
      rules: { cooldownHours: 1 },
    });
    expect(finalAttempt.body.eligibility.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "feed_post", complete: false }),
      ])
    );

    const earlyRetry = await request(app)
      .post("/api/recharge-raffle/spin")
      .set("Authorization", `Bearer ${token}`)
      .send({ network: "mtn" })
      .expect(200);

    expect(earlyRetry.body).toMatchObject({
      rateLimited: true,
      spin: {
        message: "Try after one hour but you must make a post to activate the game again.",
      },
    });

    await RechargeRafflePlay.updateOne(
      { _id: finalAttempt.body.play._id },
      {
        $set: {
          nextAvailableAt: new Date(Date.now() + (24 * 60 * 60 * 1000)),
          "spinHistory.4.createdAt": new Date(Date.now() - (2 * 60 * 60 * 1000)),
        },
      }
    );

    const missingPost = await request(app)
      .post("/api/recharge-raffle/spin")
      .set("Authorization", `Bearer ${token}`)
      .send({ network: "mtn" })
      .expect(403);

    expect(missingPost.body).toMatchObject({
      code: "post_required",
      error: "Make a post on Tengacion, then revisit the game after one hour.",
    });

    await Post.create({
      author: user._id,
      text: "My Tengacion post reactivates the recharge raffle.",
      type: "text",
      privacy: "public",
      visibility: "public",
    });

    const reactivatedStatus = await request(app)
      .get("/api/recharge-raffle/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(reactivatedStatus.body).toMatchObject({
      canSpin: true,
      cooldown: { active: false },
      eligibility: {
        eligible: true,
        repeatPostRequirement: { required: true, complete: true },
      },
    });
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
