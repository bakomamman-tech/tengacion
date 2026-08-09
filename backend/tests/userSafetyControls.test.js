const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI
  || "mongodb://127.0.0.1:27017/tengacion-user-safety-test";
process.env.JWT_SECRET = process.env.JWT_SECRET
  || "user_safety_test_secret_12345678901234567";

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
          deviceName: "Safety test browser",
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

describe("user safety controls", () => {
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
      if (mongod) await mongod.stop();
    }
  });

  test("requires authentication and rejects invalid or self-targeted blocks", async () => {
    const viewer = await createUser({
      name: "Safety Viewer",
      username: "safety_viewer",
      email: "safety-viewer@example.com",
    });

    await request(app).get("/api/users/me/safety-lists").expect(401);
    await request(app)
      .put("/api/users/me/block/not-an-id")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(400);
    await request(app)
      .put(`/api/users/me/block/${viewer.user._id}`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(400);
  });

  test("blocks across relationships, discovery, profiles, contacts, and every message write path", async () => {
    const viewer = await createUser({
      name: "Safety Viewer",
      username: "safety_viewer",
      email: "safety-viewer@example.com",
    });
    const target = await createUser({
      name: "Safety Target",
      username: "safety_target",
      email: "safety-target@example.com",
    });

    await User.updateOne(
      { _id: viewer.user._id },
      {
        $addToSet: {
          friends: target.user._id,
          following: target.user._id,
          followers: target.user._id,
          closeFriends: target.user._id,
          friendRequests: target.user._id,
        },
      }
    );
    await User.updateOne(
      { _id: target.user._id },
      {
        $addToSet: {
          friends: viewer.user._id,
          following: viewer.user._id,
          followers: viewer.user._id,
          closeFriends: viewer.user._id,
          friendRequests: viewer.user._id,
        },
      }
    );

    const blocked = await request(app)
      .put(`/api/users/me/block/${target.user._id}`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(201);
    expect(blocked.body).toMatchObject({
      success: true,
      blocked: true,
      created: true,
      relationshipsRemoved: true,
      user: { username: "safety_target" },
    });

    const [storedViewer, storedTarget] = await Promise.all([
      User.findById(viewer.user._id).lean(),
      User.findById(target.user._id).lean(),
    ]);
    expect(storedViewer.blocks.map(String)).toContain(target.user._id.toString());
    for (const field of ["friends", "following", "followers", "closeFriends", "friendRequests"]) {
      expect((storedViewer[field] || []).map(String)).not.toContain(target.user._id.toString());
      expect((storedTarget[field] || []).map(String)).not.toContain(viewer.user._id.toString());
    }

    const safetyLists = await request(app)
      .get("/api/users/me/safety-lists")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(safetyLists.headers["cache-control"]).toBe("no-store");
    expect(safetyLists.body.blocked).toEqual([
      expect.objectContaining({
        _id: target.user._id.toString(),
        username: "safety_target",
      }),
    ]);
    expect(safetyLists.body.blocked[0]).not.toHaveProperty("email");

    await request(app)
      .get("/api/users/profile/safety_target")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(404);
    await request(app)
      .get("/api/users/profile/safety_viewer")
      .set("Authorization", `Bearer ${target.token}`)
      .expect(404);

    const viewerSearch = await request(app)
      .get("/api/users?search=safety_target")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(viewerSearch.body).toEqual([]);
    const targetSearch = await request(app)
      .get("/api/search?q=safety_viewer&type=users")
      .set("Authorization", `Bearer ${target.token}`)
      .expect(200);
    expect(targetSearch.body.data).toEqual([]);

    const contacts = await request(app)
      .get("/api/messages/contacts")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(contacts.body.some((entry) => entry._id === target.user._id.toString())).toBe(false);

    await request(app)
      .post("/api/chat/messages")
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ receiverId: target.user._id.toString(), text: "Blocked chat path" })
      .expect(403);
    await request(app)
      .post(`/api/messages/${viewer.user._id}`)
      .set("Authorization", `Bearer ${target.token}`)
      .send({ text: "Blocked message path" })
      .expect(403);
    await User.updateOne(
      { _id: target.user._id },
      { $set: { role: "super_admin" } }
    );
    await request(app)
      .post("/api/chat/messages")
      .set("Authorization", `Bearer ${target.token}`)
      .send({ receiverId: viewer.user._id.toString(), text: "Blocked admin path" })
      .expect(403);
    await request(app)
      .post(`/api/users/${viewer.user._id}/request`)
      .set("Authorization", `Bearer ${target.token}`)
      .expect(404);

    const unblocked = await request(app)
      .put(`/api/users/me/unblock/${target.user._id}`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(unblocked.body).toMatchObject({
      blocked: false,
      existed: true,
      relationshipsRestored: false,
    });
    const afterUnblock = await User.findById(viewer.user._id).lean();
    expect(afterUnblock.blocks).toHaveLength(0);
    expect(afterUnblock.friends).toHaveLength(0);
  });

  test("moves legacy blockedUsers records into the canonical blocks list on review", async () => {
    const viewer = await createUser({
      name: "Legacy Viewer",
      username: "legacy_viewer",
      email: "legacy-viewer@example.com",
    });
    const target = await createUser({
      name: "Legacy Target",
      username: "legacy_target",
      email: "legacy-target@example.com",
    });
    await User.updateOne(
      { _id: viewer.user._id },
      { $addToSet: { blockedUsers: target.user._id } }
    );

    const response = await request(app)
      .get("/api/users/me/safety-lists")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(response.body.blocked).toEqual([
      expect.objectContaining({ username: "legacy_target" }),
    ]);

    const stored = await User.findById(viewer.user._id).lean();
    expect(stored.blockedUsers).toHaveLength(0);
    expect(stored.blocks.map(String)).toContain(target.user._id.toString());
  });
});
