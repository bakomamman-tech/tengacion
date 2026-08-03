const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-birthdays-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "birthdays_test_secret_123456789012345";

const app = require("../app");
const User = require("../models/User");
const { getDatePartsInTimeZone } = require("../utils/birthday");

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

const birthdayAtOffset = (offset, visibility) => {
  const today = getDatePartsInTimeZone(new Date());
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: 1995,
    visibility,
  };
};

const createUser = async ({ name, username, email, birthday, ...overrides }) =>
  User.create({
    name,
    username,
    email,
    password: "Password123!",
    birthday,
    isVerified: true,
    emailVerified: true,
    ...overrides,
  });

describe("community birthday API privacy and journey contract", () => {
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

  test("requires authentication", async () => {
    await request(app).get("/api/users/birthdays/community").expect(401);
  });

  test("returns public birthdays and friend-visible birthdays only to eligible viewers", async () => {
    const viewer = await createUser({
      name: "Birthday Viewer",
      username: "birthday_viewer",
      email: "birthday-viewer@example.com",
      birthday: birthdayAtOffset(20, "private"),
    });
    const friend = await createUser({
      name: "Birthday Friend",
      username: "birthday_friend",
      email: "birthday-friend@example.com",
      birthday: birthdayAtOffset(0, "friends"),
    });
    const publicUser = await createUser({
      name: "Public Birthday",
      username: "public_birthday",
      email: "public-birthday@example.com",
      birthday: birthdayAtOffset(1, "public"),
    });
    await createUser({
      name: "Unrelated Friend Only",
      username: "unrelated_friend_only",
      email: "unrelated-friend-only@example.com",
      birthday: birthdayAtOffset(0, "friends"),
    });
    await createUser({
      name: "Private Birthday",
      username: "private_birthday",
      email: "private-birthday@example.com",
      birthday: birthdayAtOffset(0, "private"),
    });
    await createUser({
      name: "Suspended Birthday",
      username: "suspended_birthday",
      email: "suspended-birthday@example.com",
      birthday: birthdayAtOffset(0, "public"),
      isSuspended: true,
    });

    viewer.friends = [friend._id];
    await viewer.save();
    const token = await issueSessionToken(viewer._id);

    const response = await request(app)
      .get("/api/users/birthdays/community?limit=10")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.totalWithSharedBirthdays).toBe(2);
    expect(response.body.today).toEqual([
      expect.objectContaining({
        _id: friend._id.toString(),
        birthdayIsToday: true,
        canWish: true,
      }),
    ]);
    expect(response.body.upcoming).toEqual([
      expect.objectContaining({
        _id: publicUser._id.toString(),
        birthdayDaysUntil: 1,
        canWish: false,
      }),
    ]);
    expect(JSON.stringify(response.body)).not.toContain("unrelated_friend_only");
    expect(JSON.stringify(response.body)).not.toContain("private_birthday");
    expect(JSON.stringify(response.body)).not.toContain("suspended_birthday");
  });
});

