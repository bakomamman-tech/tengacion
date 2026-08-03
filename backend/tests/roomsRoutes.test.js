const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-rooms-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "rooms_test_secret_12345678901234567890";

const app = require("../app");
const Room = require("../models/Room");
const RoomMessage = require("../models/RoomMessage");
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

const createRoom = (token, payload = {}) =>
  request(app)
    .post("/api/rooms")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: payload.name || "Community Room",
      description: payload.description || "A server-backed room",
      privacy: payload.privacy || "public",
    });

describe("rooms API authority", () => {
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
    await request(app).get("/api/rooms").expect(401);
    await request(app).post("/api/rooms").send({ name: "Local-only room" }).expect(401);
  });

  test("persists creation and lists public rooms without leaking unrelated private rooms", async () => {
    const owner = await createUser({
      name: "Room Owner",
      username: "room_owner",
      email: "room-owner@example.com",
    });
    const viewer = await createUser({
      name: "Room Viewer",
      username: "room_viewer",
      email: "room-viewer@example.com",
    });
    const publicRoom = await createRoom(owner.token, { name: "Public Room" }).expect(201);
    const privateRoom = await createRoom(owner.token, {
      name: "Private Room",
      privacy: "private",
    }).expect(201);

    const ownerList = await request(app)
      .get("/api/rooms")
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(ownerList.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: publicRoom.body._id, isOwner: true, isMember: true }),
        expect.objectContaining({ _id: privateRoom.body._id, isOwner: true, isMember: true }),
      ])
    );

    const viewerList = await request(app)
      .get("/api/rooms")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(viewerList.body.map((room) => room.name)).toEqual(["Public Room"]);
    expect(await Room.countDocuments()).toBe(2);
  });

  test("public membership is server-confirmed and owners cannot orphan their room", async () => {
    const owner = await createUser({
      name: "Membership Owner",
      username: "membership_owner",
      email: "membership-owner@example.com",
    });
    const member = await createUser({
      name: "Membership User",
      username: "membership_user",
      email: "membership-user@example.com",
    });
    const created = await createRoom(owner.token).expect(201);

    await request(app)
      .post(`/api/rooms/${created.body._id}/join`)
      .set("Authorization", `Bearer ${member.token}`)
      .expect(200);
    expect((await Room.findById(created.body._id).lean()).members.map(String)).toContain(
      member.user._id.toString()
    );

    await request(app)
      .post(`/api/rooms/${created.body._id}/leave`)
      .set("Authorization", `Bearer ${member.token}`)
      .expect(200);
    expect((await Room.findById(created.body._id).lean()).members.map(String)).not.toContain(
      member.user._id.toString()
    );

    await request(app)
      .post(`/api/rooms/${created.body._id}/leave`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(409);
  });

  test("only members can send messages while private feeds and messages remain private", async () => {
    const owner = await createUser({
      name: "Message Owner",
      username: "message_owner",
      email: "message-owner@example.com",
    });
    const outsider = await createUser({
      name: "Message Outsider",
      username: "message_outsider",
      email: "message-outsider@example.com",
    });
    const publicRoom = await createRoom(owner.token, { name: "Public Discussion" }).expect(201);
    const privateRoom = await createRoom(owner.token, {
      name: "Private Discussion",
      privacy: "private",
    }).expect(201);

    await request(app)
      .post(`/api/rooms/${publicRoom.body._id}/messages`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ content: "Must not persist" })
      .expect(403);
    await request(app)
      .get(`/api/rooms/${privateRoom.body._id}/messages`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .expect(403);
    await request(app)
      .get(`/api/rooms/${privateRoom.body._id}/feed`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .expect(403);

    await request(app)
      .post(`/api/rooms/${publicRoom.body._id}/join`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .expect(200);
    const sent = await request(app)
      .post(`/api/rooms/${publicRoom.body._id}/messages`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ content: "Server-confirmed room message" })
      .expect(201);
    expect(sent.body.content).toBe("Server-confirmed room message");

    const messages = await request(app)
      .get(`/api/rooms/${publicRoom.body._id}/messages`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(messages.body).toEqual([
      expect.objectContaining({ content: "Server-confirmed room message" }),
    ]);
    expect(await RoomMessage.countDocuments({ roomId: publicRoom.body._id })).toBe(1);
  });
});

