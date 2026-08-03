const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-product-scorecard-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "product_scorecard_test_secret_123456789012";

const app = require("../app");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const User = require("../models/User");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
let mongod;

const collectKeys = (value, keys = []) => {
  if (!value || typeof value !== "object") return keys;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKeys(entry, keys));
    return keys;
  }
  Object.entries(value).forEach(([key, entry]) => {
    keys.push(key);
    collectKeys(entry, keys);
  });
  return keys;
};

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

const createAdmin = async () => {
  const admin = await User.create({
    name: "Product Scorecard Admin",
    username: "product_scorecard_admin",
    email: "product-scorecard-admin@test.com",
    password: "Password123!",
    role: "admin",
    isVerified: true,
    emailVerified: true,
  });

  return {
    admin,
    token: await issueSessionToken(admin._id),
  };
};

const routeView = ({
  userId = null,
  featureId,
  routePattern,
  lifecycle,
  surface,
  access,
  canonicalPath,
  createdAt,
}) => ({
  type: "route_viewed",
  userId,
  actorRole: userId ? "authenticated" : "anonymous",
  targetId: featureId,
  targetType: "route_feature",
  contentType: surface,
  metadata: {
    eventType: "route_viewed",
    contractVersion: 1,
    featureId,
    routePattern,
    canonicalPath,
    lifecycle,
    surface,
    access,
  },
  createdAt,
  updatedAt: createdAt,
});

describe("admin product scorecard", () => {
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

  test("aggregates a privacy-safe 30-day route baseline", async () => {
    const { admin, token } = await createAdmin();
    const now = new Date();
    const firstDay = new Date(now.getTime() - 29 * ONE_DAY_MS);
    const middleDay = new Date(now.getTime() - 14 * ONE_DAY_MS);

    await AnalyticsEvent.create([
      routeView({
        featureId: "public_marketing",
        routePattern: "/",
        lifecycle: "production",
        surface: "public",
        access: "public",
        canonicalPath: "/",
        createdAt: firstDay,
      }),
      routeView({
        userId: admin._id,
        featureId: "public_marketing",
        routePattern: "/about",
        lifecycle: "production",
        surface: "public",
        access: "public",
        canonicalPath: "/",
        createdAt: middleDay,
      }),
      routeView({
        userId: admin._id,
        featureId: "home",
        routePattern: "/home",
        lifecycle: "production",
        surface: "home",
        access: "authenticated",
        canonicalPath: "/home",
        createdAt: now,
      }),
      {
        type: "message_sent",
        userId: admin._id,
        targetType: "message",
        createdAt: now,
      },
    ]);

    const response = await request(app)
      .get("/api/admin/analytics/product-scorecard?range=30d")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.contract).toMatchObject({
      scorecardVersion: 1,
      routeEventType: "route_viewed",
      routeContractVersion: 1,
      requiredBaselineWindowDays: 30,
    });
    expect(response.body.capture).toMatchObject({
      status: "ready",
      ready: true,
      requestedWindowDays: 30,
      observedWindowDays: 30,
      remainingTelemetryDays: 0,
    });
    expect(response.body.summary).toMatchObject({
      totalRouteViews: 3,
      authenticatedViews: 2,
      anonymousViews: 1,
      uniqueAuthenticatedUsers: 1,
      viewedFeatureCount: 2,
      unclassifiedViews: 0,
    });
    expect(response.body.summary.registryFeatureCount).toBeGreaterThan(30);

    const marketing = response.body.features.find(
      (feature) => feature.featureId === "public_marketing"
    );
    expect(marketing).toMatchObject({
      views: 2,
      authenticatedViews: 1,
      anonymousViews: 1,
      uniqueAuthenticatedUsers: 1,
    });
    expect(marketing.routes).toEqual(
      expect.arrayContaining([
        { routePattern: "/", views: 1 },
        { routePattern: "/about", views: 1 },
      ])
    );

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(admin._id.toString());
    expect(collectKeys(response.body)).not.toEqual(
      expect.arrayContaining([
        "url",
        "location",
        "pathname",
        "query",
        "search",
        "hash",
        "referrer",
        "userId",
      ])
    );
  });

  test("reports an honest incomplete state until the production window exists", async () => {
    const { token } = await createAdmin();
    const now = new Date();

    await AnalyticsEvent.create(
      routeView({
        featureId: "public_marketing",
        routePattern: "/",
        lifecycle: "production",
        surface: "public",
        access: "public",
        canonicalPath: "/",
        createdAt: now,
      })
    );

    const immatureWindow = await request(app)
      .get("/api/admin/analytics/product-scorecard?range=30d")
      .set("Authorization", `Bearer ${token}`);

    expect(immatureWindow.status).toBe(200);
    expect(immatureWindow.body.capture).toMatchObject({
      status: "insufficient_telemetry_window",
      ready: false,
      requestedWindowDays: 30,
      observedWindowDays: 1,
      remainingTelemetryDays: 29,
    });

    const shortWindow = await request(app)
      .get("/api/admin/analytics/product-scorecard?range=7d")
      .set("Authorization", `Bearer ${token}`);

    expect(shortWindow.status).toBe(200);
    expect(shortWindow.body.capture).toMatchObject({
      status: "insufficient_selected_window",
      ready: false,
      requestedWindowDays: 7,
      observedWindowDays: 1,
      remainingTelemetryDays: 29,
    });

    await AnalyticsEvent.deleteMany({ type: "route_viewed" });
    const emptyWindow = await request(app)
      .get("/api/admin/analytics/product-scorecard?range=30d")
      .set("Authorization", `Bearer ${token}`);

    expect(emptyWindow.status).toBe(200);
    expect(emptyWindow.body.capture).toMatchObject({
      status: "no_data",
      ready: false,
      observedWindowDays: 0,
      remainingTelemetryDays: 30,
    });
    expect(emptyWindow.body.summary.totalRouteViews).toBe(0);
  });

  test("keeps the scorecard behind admin authentication", async () => {
    const response = await request(app).get(
      "/api/admin/analytics/product-scorecard?range=30d"
    );

    expect(response.status).toBe(401);
  });
});
