const request = require("supertest");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";
require("../../apps/api/config/env");

const app = require("../app");
const User = require("../models/User");
const AdminComplaint = require("../models/AdminComplaint");
const Notification = require("../models/Notification");
const { signAccessToken } = require("../services/authTokens");

describe("admin complaint inbox flow", () => {
  let mongod;
  let user;
  let admin;
  let userToken;
  let adminToken;

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

    user = await User.create({
      name: "Complaint User",
      username: "complaint_user",
      email: "complaint-user@test.com",
      password: "Password123!",
      emailVerified: true,
    });
    admin = await User.create({
      name: "Admin User",
      username: "admin_user",
      email: "admin-user@test.com",
      password: "Password123!",
      role: "super_admin",
      emailVerified: true,
    });

    const userLogin = await request(app).post("/api/auth/login").send({
      email: "complaint-user@test.com",
      password: "Password123!",
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

    adminToken = signAccessToken({
      userId: admin._id.toString(),
      tokenVersion: admin.tokenVersion || 0,
      sessionId: adminSessionId,
    });

    userToken = userLogin.body?.token;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  test("submits a complaint, exposes it to admin, and allows resolution", async () => {
    const submitResponse = await request(app)
      .post("/api/support/complaints")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        subject: "Urgent safety complaint",
        details: "This post contains harmful content and needs review immediately.",
        category: "safety",
        sourcePath: "/home",
        sourceLabel: "Home",
      })
      .expect(201);

    expect(submitResponse.body.success).toBe(true);
    expect(submitResponse.body.complaint).toMatchObject({
      subject: "Urgent safety complaint",
      category: "safety",
      status: "open",
      sourcePath: "/home",
      sourceLabel: "Home",
    });

    const storedComplaint = await AdminComplaint.findById(submitResponse.body.complaint._id).lean();
    expect(storedComplaint).toBeTruthy();
    expect(storedComplaint.priority).toBe("critical");

    const adminInbox = await request(app)
      .get("/api/admin/messages/complaints")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(adminInbox.body.summary.open).toBe(1);
    expect(adminInbox.body.complaints).toHaveLength(1);
    expect(adminInbox.body.complaints[0]).toMatchObject({
      subject: "Urgent safety complaint",
      category: "safety",
      status: "open",
      sourcePath: "/home",
      sourceLabel: "Home",
    });

    const adminNotification = await Notification.findOne({
      recipient: admin._id,
      type: "system",
    }).lean();
    expect(adminNotification).toBeTruthy();
    expect(String(adminNotification.text || "")).toContain("New admin complaint");

    const resolveResponse = await request(app)
      .patch(`/api/admin/messages/complaints/${submitResponse.body.complaint._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "resolved" })
      .expect(200);

    expect(resolveResponse.body.complaint).toMatchObject({
      status: "resolved",
      subject: "Urgent safety complaint",
    });

    const updatedComplaint = await AdminComplaint.findById(submitResponse.body.complaint._id).lean();
    expect(updatedComplaint.status).toBe("resolved");
    expect(updatedComplaint.reviewedAt).toBeTruthy();
    expect(updatedComplaint.resolvedAt).toBeTruthy();

    const reporterNotification = await Notification.findOne({
      recipient: user._id,
      type: "system",
    }).lean();
    expect(reporterNotification).toBeTruthy();
    expect(String(reporterNotification.text || "")).toContain("marked resolved");
  });
});
