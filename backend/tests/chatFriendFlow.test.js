const request = require("supertest");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";

const app = require("../app");
const User = require("../models/User");
const Message = require("../models/Message");
const { signAccessToken } = require("../services/authTokens");

describe("chat + friend request flow", () => {
  let mongod;
  let userA;
  let userB;
  let userC;
  let userD;
  let userE;
  let tokenA;
  let tokenB;

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
    userA = await User.create({
      name: "User A",
      username: "user_a",
      email: "usera@test.com",
      password: "Password123!",
    });
    userB = await User.create({
      name: "User B",
      username: "user_b",
      email: "userb@test.com",
      password: "Password123!",
    });
    userC = await User.create({
      name: "User C",
      username: "user_c",
      email: "userc@test.com",
      password: "Password123!",
    });
    userD = await User.create({
      name: "User D",
      username: "user_d",
      email: "userd@test.com",
      password: "Password123!",
    });
    userE = await User.create({
      name: "User E",
      username: "user_e",
      email: "usere@test.com",
      password: "Password123!",
    });

    const [loginA, loginB] = await Promise.all([
      request(app).post("/api/auth/login").send({
        email: "usera@test.com",
        password: "Password123!",
      }),
      request(app).post("/api/auth/login").send({
        email: "userb@test.com",
        password: "Password123!",
      }),
    ]);
    tokenA = loginA.body?.token;
    tokenB = loginB.body?.token;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  test("friend request send -> fetch -> accept is visible after refresh", async () => {
    await request(app)
      .post(`/api/users/${userB._id.toString()}/request`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(201);

    const incoming = await request(app)
      .get("/api/users/requests")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);

    expect(Array.isArray(incoming.body)).toBe(true);
    expect(incoming.body.some((entry) => String(entry._id) === userA._id.toString())).toBe(true);

    await request(app)
      .post(`/api/users/${userA._id.toString()}/accept`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);

    const incomingAfterAccept = await request(app)
      .get("/api/users/requests")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(incomingAfterAccept.body).toEqual([]);

    const [freshA, freshB] = await Promise.all([
      User.findById(userA._id).lean(),
      User.findById(userB._id).lean(),
    ]);
    expect((freshA.friends || []).map((id) => id.toString())).toContain(userB._id.toString());
    expect((freshB.friends || []).map((id) => id.toString())).toContain(userA._id.toString());
  });

  test("login issues a refresh cookie that restores session after reload", async () => {
    const agent = request.agent(app);

    const loginResponse = await agent
      .post("/api/auth/login")
      .send({
        email: "usera@test.com",
        password: "Password123!",
      })
      .expect(200);

    expect(loginResponse.body).toHaveProperty("token");
    expect(loginResponse.body?.user?._id).toBe(userA._id.toString());
    expect(loginResponse.headers["set-cookie"] || []).toEqual(
      expect.arrayContaining([expect.stringContaining("tg_refresh=")])
    );

    const refreshResponse = await agent
      .post("/api/auth/refresh")
      .send({})
      .expect(200);

    expect(refreshResponse.body).toHaveProperty("token");
    expect(refreshResponse.body?.user?._id).toBe(userA._id.toString());
    expect(refreshResponse.headers["set-cookie"] || []).toEqual(
      expect.arrayContaining([expect.stringContaining("tg_refresh=")])
    );
  });

  test("message persists and is returned by conversation endpoint", async () => {
    const sendResponse = await request(app)
      .post("/api/chat/messages")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        receiverId: userB._id.toString(),
        text: "Hello from A",
        clientId: "client-msg-1",
      })
      .expect(201);

    expect(sendResponse.body).toHaveProperty("_id");
    expect(sendResponse.body).toMatchObject({
      senderId: userA._id.toString(),
      receiverId: userB._id.toString(),
      text: "Hello from A",
    });

    const dbMessage = await Message.findById(sendResponse.body._id).lean();
    expect(dbMessage).toBeTruthy();
    expect(dbMessage.text).toBe("Hello from A");

    const loaded = await request(app)
      .get(`/api/messages/${userA._id.toString()}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);

    expect(Array.isArray(loaded.body)).toBe(true);
    expect(loaded.body.some((entry) => String(entry._id) === sendResponse.body._id)).toBe(true);
  });

  test("messages support reply metadata and emoji reactions", async () => {
    const firstMessage = await request(app)
      .post("/api/chat/messages")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        receiverId: userB._id.toString(),
        text: "Original message",
        clientId: "client-msg-reply-1",
      })
      .expect(201);

    const replyMessage = await request(app)
      .post("/api/chat/messages")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        receiverId: userA._id.toString(),
        text: "Replying now",
        clientId: "client-msg-reply-2",
        replyTo: {
          messageId: firstMessage.body._id,
        },
      })
      .expect(201);

    expect(replyMessage.body.replyTo).toMatchObject({
      messageId: firstMessage.body._id,
      senderId: userA._id.toString(),
      senderName: "User A",
      type: "text",
      text: "Original message",
    });

    const reacted = await request(app)
      .post(`/api/messages/${encodeURIComponent(firstMessage.body._id)}/react`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ emoji: "🔥" })
      .expect(200);

    expect(reacted.body.success).toBe(true);
    expect(Array.isArray(reacted.body.reactions)).toBe(true);
    expect(reacted.body.reactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          emoji: "🔥",
        }),
      ])
    );

    const loaded = await request(app)
      .get(`/api/messages/${userA._id.toString()}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);

    const hydratedReply = loaded.body.find(
      (entry) => String(entry._id) === replyMessage.body._id
    );
    const hydratedOriginal = loaded.body.find(
      (entry) => String(entry._id) === firstMessage.body._id
    );

    expect(hydratedReply.replyTo).toMatchObject({
      messageId: firstMessage.body._id,
      senderName: "User A",
      text: "Original message",
    });
    expect(hydratedOriginal.reactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: userB._id.toString(),
          emoji: "🔥",
        }),
      ])
    );
  });

  test("admin replies can reach a user even when normal messaging is restricted", async () => {
    const admin = await User.create({
      name: "Admin Reply",
      username: "admin_reply",
      email: "admin.reply@test.com",
      password: "Password123!",
      role: "super_admin",
      emailVerified: true,
    });

    const adminSessionId = crypto.randomUUID();
    await User.updateOne(
      { _id: admin._id },
      {
        $set: {
          sessions: [
            {
              sessionId: adminSessionId,
              deviceName: "jest-admin-session",
              ip: "127.0.0.1",
              userAgent: "jest",
              createdAt: new Date(),
              lastSeenAt: new Date(),
            },
          ],
        },
      }
    );

    const adminToken = signAccessToken({
      userId: admin._id.toString(),
      tokenVersion: admin.tokenVersion || 0,
      sessionId: adminSessionId,
    });

    userB.privacy.allowMessagesFrom = "no_one";
    await userB.save();

    const sendResponse = await request(app)
      .post("/api/chat/messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        receiverId: userB._id.toString(),
        text: "Admin follow-up message",
      })
      .expect(201);

    expect(sendResponse.body).toMatchObject({
      senderId: admin._id.toString(),
      receiverId: userB._id.toString(),
      text: "Admin follow-up message",
    });

    const loaded = await request(app)
      .get(`/api/messages/${admin._id.toString()}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);

    expect(loaded.body.some((entry) => String(entry._id) === sendResponse.body._id)).toBe(true);
  });

  test("friends hub returns requests, friends, suggestions, birthdays, and close friends", async () => {
    const today = new Date();

    userA.friends = [userB._id];
    userA.friendRequests = [userC._id];
    userA.closeFriends = [userB._id];
    await userA.save();

    userB.friends = [userA._id];
    userB.birthday = {
      day: today.getDate(),
      month: today.getMonth() + 1,
      year: 1998,
      visibility: "friends",
    };
    await userB.save();

    userD.friendRequests = [userA._id];
    await userD.save();

    const response = await request(app)
      .get("/api/users/me/friends-hub")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body).toMatchObject({
      stats: {
        friendsCount: 1,
        incomingRequestsCount: 1,
        outgoingRequestsCount: 1,
        closeFriendsCount: 1,
        birthdaysCount: 1,
      },
    });

    expect(response.body.incomingRequests).toHaveLength(1);
    expect(response.body.incomingRequests[0]).toMatchObject({
      _id: userC._id.toString(),
      relationshipStatus: "request_received",
    });

    expect(response.body.outgoingRequests).toHaveLength(1);
    expect(response.body.outgoingRequests[0]).toMatchObject({
      _id: userD._id.toString(),
      relationshipStatus: "request_sent",
    });

    expect(response.body.friends).toHaveLength(1);
    expect(response.body.friends[0]).toMatchObject({
      _id: userB._id.toString(),
      relationshipStatus: "friends",
      isCloseFriend: true,
    });

    expect(response.body.birthdays).toHaveLength(1);
    expect(response.body.birthdays[0]).toMatchObject({
      _id: userB._id.toString(),
      birthdayLabel: "Today",
      birthdayIsToday: true,
    });

    expect(Array.isArray(response.body.suggestions)).toBe(true);
    expect(response.body.suggestions.some((entry) => entry._id === userE._id.toString())).toBe(true);
    expect(response.body.suggestions.some((entry) => entry._id === userB._id.toString())).toBe(false);
    expect(response.body.suggestions.some((entry) => entry._id === userC._id.toString())).toBe(false);
    expect(response.body.suggestions.some((entry) => entry._id === userD._id.toString())).toBe(false);
  });
});
