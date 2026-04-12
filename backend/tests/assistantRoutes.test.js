const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
require("../../apps/api/config/env");

const assistantRoutes = require("../routes/assistant");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const User = require("../models/User");
const CreatorProfile = require("../models/CreatorProfile");

let mongod;
let app;
let authToken;
let viewerCreatorProfile;

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
  const uri = mongod.getUri();

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });

  app = express();
  app.use(express.json());
  app.use("/api/assistant", assistantRoutes);
  app.use(errorHandler);
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();

  const viewer = await User.create({
    name: "Viewer User",
    username: "viewer_user",
    email: "viewer@test.com",
    password: "Password123!",
  });
  const gospelCreatorUser = await User.create({
    name: "Grace Melody",
    username: "gospel_melody",
    email: "grace@test.com",
    password: "Password123!",
  });

  viewerCreatorProfile = await CreatorProfile.create({
    userId: viewer._id,
    displayName: "Viewer Creator",
    fullName: "Viewer Creator",
    bio: "Viewer profile for assistant tests.",
    tagline: "Open the dashboard and upload studio.",
    creatorTypes: ["music", "bookPublishing", "podcast"],
    onboardingComplete: true,
    onboardingCompleted: true,
    isCreator: true,
  });

  await CreatorProfile.create({
    userId: gospelCreatorUser._id,
    displayName: "Gospel Melody",
    fullName: "Grace Melody",
    bio: "Gospel singer, worship leader, and live performer.",
    tagline: "Uplifting gospel music and praise sessions.",
    genres: ["gospel", "worship"],
    creatorTypes: ["music"],
    onboardingComplete: true,
    onboardingCompleted: true,
    isCreator: true,
  });

  authToken = await issueSessionToken(viewer._id);
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

describe("Assistant routes", () => {
  it("returns a navigate action for messages", async () => {
    const response = await request(app)
      .post("/api/assistant/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Take me to messages" })
      .expect(200);

    expect(response.body.requiresConfirmation).toBe(false);
    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "navigate",
          target: "/messages",
        }),
      ])
    );
  });

  it("greets the user instead of falling back to the disabled notice", async () => {
    const response = await request(app)
      .post("/api/assistant/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Good morning Akuso" })
      .expect(200);

    expect(String(response.body.message || "")).toMatch(/good morning|akuso/i);
    expect(response.body.actions).toHaveLength(0);
    expect(String(response.body.message || "")).not.toMatch(/isn't enabled|disabled in this environment/i);
  });

  it("opens the creator dashboard for a creator", async () => {
    const response = await request(app)
      .post("/api/assistant/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Open creator dashboard" })
      .expect(200);

    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "navigate",
          target: "/creator/dashboard",
        }),
      ])
    );
  });

  it("opens the correct upload page for a song", async () => {
    const response = await request(app)
      .post("/api/assistant/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Help me upload a song" })
      .expect(200);

    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "navigate",
          target: "/creator/music/upload",
        }),
      ])
    );
  });

  it("opens the user's public creator page", async () => {
    const response = await request(app)
      .post("/api/assistant/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Take me to my creator's page" })
      .expect(200);

    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "navigate",
          target: `/creator/${viewerCreatorProfile._id.toString()}`,
        }),
      ])
    );
  });

  it("finds gospel creators", async () => {
    const response = await request(app)
      .post("/api/assistant/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Find gospel creators" })
      .expect(200);

    expect(response.body.cards.length).toBeGreaterThan(0);
    expect(response.body.cards[0]).toEqual(
      expect.objectContaining({
        type: "creator",
      })
    );
  });

  it("rejects invalid input with a safe validation failure", async () => {
    const response = await request(app)
      .post("/api/assistant/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({})
      .expect(400);

    expect(String(response.body.error || "")).toMatch(/invalid assistant request/i);
  });

  it("blocks unauthenticated requests", async () => {
    const response = await request(app)
      .post("/api/assistant/chat")
      .send({ message: "Take me home" })
      .expect(401);

    expect(String(response.body.error || "")).toMatch(/token|unauthorized/i);
  });

  it("returns a safe fallback for unknown requests", async () => {
    const response = await request(app)
      .post("/api/assistant/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Tell me about moon lanterns" })
      .expect(200);

    expect(Array.isArray(response.body.actions)).toBe(true);
    expect(response.body.actions).toHaveLength(0);
    expect(String(response.body.message || "")).toMatch(/safe navigation|help with/i);
  });

  it("refuses risky actions and returns a pending safe alternative", async () => {
    const response = await request(app)
      .post("/api/assistant/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Send a message automatically to Grace" })
      .expect(200);

    expect(response.body.requiresConfirmation).toBe(true);
    expect(response.body.pendingAction).toEqual(
      expect.objectContaining({
        type: "navigate",
        route: "/messages",
      })
    );
  });
});
