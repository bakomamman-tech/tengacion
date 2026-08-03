const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
require("../../apps/api/config/env");

const analyticsRoutes = require("../routes/analytics");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const User = require("../models/User");
const { findRouteTruthMatch } = require("../services/routeTruthService");

let mongod;
let app;

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
  app.use("/api/analytics", analyticsRoutes);
  app.use(errorHandler);
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
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }
});

describe("route analytics contract", () => {
  it("records an anonymous route view with server-derived truth only", async () => {
    const response = await request(app)
      .post("/api/analytics/route-views")
      .send({
        contractVersion: 1,
        featureId: "public_creator_profiles",
        routePattern: "/creator/:username/books",
      })
      .expect(202);

    expect(response.body).toEqual({
      accepted: true,
      eventType: "route_viewed",
      contractVersion: 1,
    });

    const event = await AnalyticsEvent.findOne({ type: "route_viewed" }).lean();
    expect(event).toEqual(
      expect.objectContaining({
        userId: null,
        actorRole: "anonymous",
        targetId: "public_creator_profiles",
        targetType: "route_feature",
        contentType: "creator_public",
      })
    );
    expect(event.metadata).toEqual({
      eventType: "route_viewed",
      contractVersion: 1,
      featureId: "public_creator_profiles",
      routePattern: "/creator/:username/books",
      canonicalPath: "/creator/:username",
      lifecycle: "production",
      surface: "creator_public",
      access: "mixed",
    });
    expect(JSON.stringify(event.metadata)).not.toMatch(
      /creator\.example|secret|query|search|hash|referrer|title/i
    );
  });

  it("associates a valid session without accepting browser-supplied access labels", async () => {
    const user = await User.create({
      name: "Analytics Viewer",
      username: "analytics_viewer",
      email: "analytics-viewer@test.com",
      password: "Password123!",
    });
    const token = await issueSessionToken(user._id);

    await request(app)
      .post("/api/analytics/route-views")
      .set("Authorization", `Bearer ${token}`)
      .send({
        contractVersion: 1,
        featureId: "creator_workspace",
        routePattern: "/creator/dashboard",
      })
      .expect(202);

    const event = await AnalyticsEvent.findOne({ type: "route_viewed" }).lean();
    expect(event.userId.toString()).toBe(user._id.toString());
    expect(event.actorRole).toBe("authenticated");
    expect(event.metadata).toEqual(
      expect.objectContaining({
        featureId: "creator_workspace",
        routePattern: "/creator/dashboard",
        lifecycle: "production",
        access: "creator",
      })
    );
  });

  it.each([
    [
      "extra URL data",
      {
        contractVersion: 1,
        featureId: "home",
        routePattern: "/home",
        query: "token=secret",
      },
    ],
    [
      "an unsupported version",
      { contractVersion: 2, featureId: "home", routePattern: "/home" },
    ],
    [
      "a mismatched feature and pattern",
      {
        contractVersion: 1,
        featureId: "home",
        routePattern: "/creator/:username",
      },
    ],
    [
      "a query embedded in the route pattern",
      {
        contractVersion: 1,
        featureId: "home",
        routePattern: "/home?token=secret",
      },
    ],
  ])("rejects %s", async (_label, payload) => {
    await request(app).post("/api/analytics/route-views").send(payload).expect(400);
    expect(await AnalyticsEvent.countDocuments({ type: "route_viewed" })).toBe(0);
  });

  it("resolves nested workspace routes before public dynamic creator routes", () => {
    expect(findRouteTruthMatch("/creator/dashboard?tab=overview#top")).toEqual(
      expect.objectContaining({
        routePattern: "/creator/dashboard",
        feature: expect.objectContaining({ id: "creator_workspace" }),
      })
    );
    expect(findRouteTruthMatch("/creator/creator.example/books")).toEqual(
      expect.objectContaining({
        routePattern: "/creator/:username/books",
        feature: expect.objectContaining({ id: "public_creator_profiles" }),
      })
    );
  });
});
