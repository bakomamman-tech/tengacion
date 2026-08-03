const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-groups-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "groups_test_secret_12345678901234567890";

const app = require("../app");
const Group = require("../models/Group");
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

const createGroup = (token, overrides = {}) =>
  request(app)
    .post("/api/groups")
    .set("Authorization", `Bearer ${token}`)
    .field("name", overrides.name || "Writers Room")
    .field("description", overrides.description || "A server-backed group.")
    .field("privacy", overrides.privacy || "public");

describe("groups API authority", () => {
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

  test("requires an authenticated server session", async () => {
    await request(app).get("/api/groups?scope=mine").expect(401);
    await request(app).post("/api/groups").field("name", "Local impostor").expect(401);
  });

  test("creates, persists, and lists the authenticated user's group", async () => {
    const { user, token } = await createUser({
      name: "Group Owner",
      username: "group_owner",
      email: "group-owner@example.com",
    });

    const created = await createGroup(token, {
      name: "Film Makers Network",
      description: "Plan productions together.",
      privacy: "private",
    }).expect(201);

    expect(created.body).toMatchObject({
      name: "Film Makers Network",
      description: "Plan productions together.",
      privacy: "private",
      owner: { id: user._id.toString(), username: "group_owner" },
      members: [{ id: user._id.toString(), role: "Admin" }],
      posts: [],
    });

    const stored = await Group.findById(created.body.id).lean();
    expect(stored).toMatchObject({ name: "Film Makers Network", privacy: "private" });

    const listed = await request(app)
      .get("/api/groups?scope=mine")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(listed.body).toEqual([expect.objectContaining({ id: created.body.id })]);
  });

  test("persists posts only for group members and returns the confirmed group", async () => {
    const owner = await createUser({
      name: "Discussion Owner",
      username: "discussion_owner",
      email: "discussion-owner@example.com",
    });
    const outsider = await createUser({
      name: "Group Outsider",
      username: "group_outsider",
      email: "group-outsider@example.com",
    });
    const created = await createGroup(owner.token).expect(201);

    await request(app)
      .post(`/api/groups/${created.body.id}/posts`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ text: "This must not be stored." })
      .expect(403);

    const posted = await request(app)
      .post(`/api/groups/${created.body.id}/posts`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ text: "A server-confirmed discussion." })
      .expect(201);

    expect(posted.body.posts).toMatchObject([
      {
        text: "A server-confirmed discussion.",
        author: { id: owner.user._id.toString(), username: "discussion_owner" },
      },
    ]);
    const stored = await Group.findById(created.body.id).lean();
    expect(stored.posts).toHaveLength(1);
    expect(stored.posts[0].text).toBe("A server-confirmed discussion.");
  });

  test("discovery exposes other public groups but not private groups", async () => {
    const owner = await createUser({
      name: "Discovery Owner",
      username: "discovery_owner",
      email: "discovery-owner@example.com",
    });
    const viewer = await createUser({
      name: "Discovery Viewer",
      username: "discovery_viewer",
      email: "discovery-viewer@example.com",
    });
    await createGroup(owner.token, { name: "Public Creators", privacy: "public" }).expect(201);
    await createGroup(owner.token, { name: "Private Creators", privacy: "private" }).expect(201);

    const response = await request(app)
      .get("/api/groups?scope=discover")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    expect(response.body.map((group) => group.name)).toEqual(["Public Creators"]);
  });
});
