const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-notifications-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "notifications_test_secret_123456789012345";

const app = require("../app");
const Notification = require("../models/Notification");
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

const createNotification = ({ recipient, sender, text, read = false, expiresAt } = {}) =>
  Notification.create({
    recipient,
    sender,
    type: "system",
    text,
    read,
    ...(expiresAt ? { expiresAt } : {}),
  });

describe("notifications API authority", () => {
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
    await request(app).get("/api/notifications").expect(401);
    await request(app).patch("/api/notifications/mark-all-read").expect(401);
    await request(app).put("/api/notifications/preferences/me").send({ likes: false }).expect(401);
  });

  test("lists only active notifications belonging to the authenticated recipient", async () => {
    const viewer = await createUser({
      name: "Notification Viewer",
      username: "notification_viewer",
      email: "notification-viewer@example.com",
    });
    const other = await createUser({
      name: "Other Recipient",
      username: "other_recipient",
      email: "other-recipient@example.com",
    });

    await createNotification({
      recipient: viewer.user._id,
      sender: other.user._id,
      text: "Visible alert",
    });
    await createNotification({
      recipient: viewer.user._id,
      sender: other.user._id,
      text: "Expired alert",
      expiresAt: new Date(Date.now() - 60_000),
    });
    await createNotification({
      recipient: other.user._id,
      sender: viewer.user._id,
      text: "Another user's alert",
    });

    const response = await request(app)
      .get("/api/notifications?page=1&limit=10")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      unreadCount: 1,
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
    });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].text).toBe("Visible alert");
  });

  test("single and bulk read operations cannot mutate another recipient's notifications", async () => {
    const viewer = await createUser({
      name: "Read Viewer",
      username: "read_viewer",
      email: "read-viewer@example.com",
    });
    const other = await createUser({
      name: "Read Other",
      username: "read_other",
      email: "read-other@example.com",
    });
    const viewerNotification = await createNotification({
      recipient: viewer.user._id,
      sender: other.user._id,
      text: "Viewer alert",
    });
    const otherNotification = await createNotification({
      recipient: other.user._id,
      sender: viewer.user._id,
      text: "Other alert",
    });

    await request(app)
      .patch("/api/notifications/not-an-id/read")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(400);

    await request(app)
      .patch(`/api/notifications/${otherNotification._id}/read`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(404);

    const single = await request(app)
      .patch(`/api/notifications/${viewerNotification._id}/read`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(single.body).toMatchObject({ success: true, unreadCount: 0 });

    await request(app)
      .patch("/api/notifications/mark-all-read")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    expect((await Notification.findById(viewerNotification._id).lean()).read).toBe(true);
    expect((await Notification.findById(otherNotification._id).lean()).read).toBe(false);
  });

  test("persists only supported notification preference keys", async () => {
    const viewer = await createUser({
      name: "Preference Viewer",
      username: "preference_viewer",
      email: "preference-viewer@example.com",
    });

    const updated = await request(app)
      .put("/api/notifications/preferences/me")
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({
        likes: false,
        comments: "false",
        messages: false,
        system: true,
        adminOverride: true,
      })
      .expect(200);

    expect(updated.body.notificationPrefs).toMatchObject({
      likes: false,
      comments: true,
      messages: false,
      system: true,
    });
    expect(updated.body.notificationPrefs.adminOverride).toBeUndefined();

    const fetched = await request(app)
      .get("/api/notifications/preferences/me")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(fetched.body.notificationPrefs).toMatchObject({ likes: false, messages: false });
  });
});
