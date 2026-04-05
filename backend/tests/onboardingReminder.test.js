const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";
require("../../apps/api/config/env");

const app = require("../app");
const User = require("../models/User");
const Notification = require("../models/Notification");
const Message = require("../models/Message");

let mongod;

jest.setTimeout(30000);

const buildAdminUser = () =>
  User.create({
    name: "Reminder Admin",
    username: "reminder_admin",
    email: "reminder-admin@test.com",
    password: "Password123!",
    role: "admin",
    emailVerified: true,
    isVerified: true,
    onboarding: {
      completed: true,
      steps: {
        avatar: true,
        bio: true,
        interests: true,
        followSuggestions: true,
      },
    },
  });

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

describe("onboarding reminder login flow", () => {
  test("creates a direct-message reminder when an incomplete account logs in", async () => {
    const admin = await buildAdminUser();
    const user = await User.create({
      name: "Incomplete User",
      username: "incomplete_user",
      email: "incomplete@test.com",
      password: "Password123!",
    });

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: "incomplete@test.com",
        password: "Password123!",
      })
      .expect(200);

    expect(loginResponse.body).toHaveProperty("token");

    const messagesResponse = await request(app)
      .get(`/api/messages/${admin._id}`)
      .set("Authorization", `Bearer ${loginResponse.body.token}`)
      .expect(200);

    const apiReminder = messagesResponse.body.find(
      (message) => message?.metadata?.type === "onboardingReminder"
    );

    expect(apiReminder).toBeTruthy();
    expect(apiReminder.metadata?.payload).toMatchObject({
      stateKey: "profile_email",
      needsProfile: true,
      needsEmailVerification: true,
      actionLink: "/profile/incomplete_user",
    });

    const reminder = await Message.findOne({
      receiverId: user._id,
      "metadata.type": "onboardingReminder",
    }).lean();

    expect(reminder).toBeTruthy();
    expect(String(reminder.senderId)).toBe(admin._id.toString());
    expect(reminder.isSystem).toBe(true);
    expect(reminder.metadata?.payload).toMatchObject({
      stateKey: "profile_email",
      needsProfile: true,
      needsEmailVerification: true,
      actionLink: "/profile/incomplete_user",
    });
    expect(String(reminder.text || "")).toContain("complete your profile bio-data");
    expect(String(reminder.text || "")).toContain("Open your profile page");
    expect(String(reminder.text || "")).toContain("verify your email");

    const notification = await Notification.findOne({
      recipient: user._id,
      type: "message",
      "entity.model": "Message",
    }).lean();

    expect(notification).toBeTruthy();
    expect(notification.metadata?.link).toBe("/profile/incomplete_user");
    expect(String(notification.metadata?.previewText || "")).toContain("complete your profile bio-data");
  });

  test("keeps the reminder to one messenger thread across repeat logins", async () => {
    await buildAdminUser();
    const user = await User.create({
      name: "Repeat Login User",
      username: "repeat_login_user",
      email: "repeat-login@test.com",
      password: "Password123!",
    });

    await request(app)
      .post("/api/auth/login")
      .send({
        email: "repeat-login@test.com",
        password: "Password123!",
      })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({
        email: "repeat-login@test.com",
        password: "Password123!",
      })
      .expect(200);

    const reminders = await Message.find({
      receiverId: user._id,
      "metadata.type": "onboardingReminder",
    }).lean();

    expect(reminders).toHaveLength(1);
  });
});
