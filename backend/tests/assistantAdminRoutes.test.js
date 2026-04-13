const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
require("../../apps/api/config/env");

const assistantRoutes = require("../routes/assistant");
const adminRoutes = require("../routes/admin");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const User = require("../models/User");

let mongod;
let app;
let viewerToken;
let adminToken;

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

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });

  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });

  app = express();
  app.use(express.json());
  app.use("/api/assistant", assistantRoutes);
  app.use("/api/admin", adminRoutes);
  app.use(errorHandler);
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();

  const viewer = await User.create({
    name: "Viewer User",
    username: "review_viewer",
    email: "review-viewer@test.com",
    password: "Password123!",
  });

  const admin = await User.create({
    name: "Admin User",
    username: "review_admin",
    email: "review-admin@test.com",
    password: "Password123!",
    role: "admin",
    permissions: ["view_audit_logs"],
  });

  viewerToken = await issueSessionToken(viewer._id);
  adminToken = await issueSessionToken(admin._id);
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
  } catch {
    // ignore cleanup errors
  } finally {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore disconnect errors
    }

    if (mongod) {
      await mongod.stop();
    }
  }
});

describe("Assistant admin review routes", () => {
  it("queues negative assistant feedback for admin review", async () => {
    await request(app)
      .post("/api/assistant/feedback")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        conversationId: "conversation-1",
        messageId: "message-1",
        responseId: "response-1",
        rating: "not_helpful",
        reason: "This felt incomplete for my workflow.",
        mode: "copilot",
        surface: "creator_dashboard",
        responseMode: "copilot",
        responseSummary: "Open creator dashboard.",
        metadata: {
          safetyLevel: "safe",
          requestSummary: "How do I manage creator tools?",
          trust: {
            provider: "local-fallback",
            mode: "app-aware",
            grounded: true,
            usedModel: false,
            confidenceLabel: "medium",
            note: "Grounded in Tengacion app data.",
          },
        },
      })
      .expect(201);

    const listResponse = await request(app)
      .get("/api/admin/assistant/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(listResponse.body.items)).toBe(true);
    expect(listResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          responseId: "response-1",
          status: "open",
          category: "feedback",
        }),
      ])
    );
  });

  it("allows an admin to resolve a queued assistant review", async () => {
    await request(app)
      .post("/api/assistant/feedback")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        conversationId: "conversation-2",
        messageId: "message-2",
        responseId: "response-2",
        rating: "not_helpful",
        reason: "The answer should have been clearer.",
        mode: "knowledge",
        surface: "general",
        responseMode: "knowledge",
        responseSummary: "Nigeria basics.",
      })
      .expect(201);

    const listResponse = await request(app)
      .get("/api/admin/assistant/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const reviewId = listResponse.body.items?.[0]?._id;
    expect(typeof reviewId).toBe("string");

    const patchResponse = await request(app)
      .patch(`/api/admin/assistant/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "resolved",
        resolutionNote: "Triaged and added to the assistant quality backlog.",
      })
      .expect(200);

    expect(patchResponse.body).toEqual(
      expect.objectContaining({
        ok: true,
        item: expect.objectContaining({
          _id: reviewId,
          status: "resolved",
        }),
      })
    );
  });
});
