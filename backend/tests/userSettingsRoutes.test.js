const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-settings-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "settings_test_secret_12345678901234567";

const app = require("../app");
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

const createUser = async ({ name, username, email }) => {
  const user = await User.create({
    name,
    username,
    email,
    password: "Password123!",
    isVerified: true,
    emailVerified: true,
  });
  return { user, token: await issueSessionToken(user._id) };
};

describe("user settings API authority", () => {
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

  test("requires authentication for private settings", async () => {
    await request(app).put("/api/users/me/privacy").send({ profileVisibility: "private" }).expect(401);
    await request(app).get("/api/users/me/audio").expect(401);
    await request(app).put("/api/users/me/audio").send({ welcomeVoiceEnabled: false }).expect(401);
  });

  test("persists only supported privacy values for the authenticated user", async () => {
    const viewer = await createUser({
      name: "Settings Viewer",
      username: "settings_viewer",
      email: "settings-viewer@example.com",
    });
    const other = await createUser({
      name: "Settings Other",
      username: "settings_other",
      email: "settings-other@example.com",
    });

    const response = await request(app)
      .put("/api/users/me/privacy")
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({
        profileVisibility: "private",
        defaultPostAudience: "close_friends",
        allowMessagesFrom: "friends",
        role: "super_admin",
      })
      .expect(200);

    expect(response.body.privacy).toMatchObject({
      profileVisibility: "private",
      defaultPostAudience: "close_friends",
      allowMessagesFrom: "friends",
    });
    const storedViewer = await User.findById(viewer.user._id).lean();
    const storedOther = await User.findById(other.user._id).lean();
    expect(storedViewer.privacy).toMatchObject(response.body.privacy);
    expect(storedViewer.role).toBe("user");
    expect(storedOther.privacy.profileVisibility).toBe("public");
  });

  test("normalizes and persists audio settings without accepting unrelated fields", async () => {
    const viewer = await createUser({
      name: "Audio Viewer",
      username: "audio_viewer",
      email: "audio-viewer@example.com",
    });

    const response = await request(app)
      .put("/api/users/me/audio")
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({
        welcomeVoiceEnabled: false,
        welcomeVoiceVolume: 4,
        autoplayEverything: true,
      })
      .expect(200);

    expect(response.body.audioPrefs).toEqual({
      welcomeVoiceEnabled: false,
      welcomeVoiceVolume: 0.45,
    });
    const fetched = await request(app)
      .get("/api/users/me/audio")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(fetched.body.audioPrefs).toEqual(response.body.audioPrefs);
    expect(fetched.body.audioPrefs.autoplayEverything).toBeUndefined();
  });

  test("validates and saves phone and date of birth for protected directory access", async () => {
    const viewer = await createUser({
      name: "Directory Viewer",
      username: "directory_viewer",
      email: "directory-viewer@example.com",
    });

    await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ phone: "not-a-phone", dob: "1992-08-14" })
      .expect(400);

    await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ phone: "+234 803 123 4567", dob: new Date().toISOString().slice(0, 10) })
      .expect(400);

    const response = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ phone: "+234 803 123 4567", dob: "1992-08-14" })
      .expect(200);

    expect(response.body.phone).toBe("+234 803 123 4567");
    expect(response.body.dob).toBe("1992-08-14T00:00:00.000Z");
    expect(response.body.birthday).toMatchObject({
      day: 14,
      month: 8,
      year: 1992,
      visibility: "private",
    });
  });
});
