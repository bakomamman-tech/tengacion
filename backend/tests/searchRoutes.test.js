const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
require("../../apps/api/config/env");

const searchRoutes = require("../routes/search");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const User = require("../models/User");

let mongod;
let app;
let authToken;

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
  app.use("/api/search", searchRoutes);
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
  await User.create({
    name: "Jordan Bangoji",
    username: "jordan.bangoji",
    email: "jordan@test.com",
    password: "Password123!",
  });
  await User.create({
    name: "Daniel Stephen Kurah",
    username: "daniel_singz",
    email: "daniel@test.com",
    password: "Password123!",
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

describe("Search routes", () => {
  it("finds accounts by @handle in the global search panel", async () => {
    const response = await request(app)
      .get("/api/search")
      .set("Authorization", `Bearer ${authToken}`)
      .query({ q: "@jordan.bangoji", type: "users" })
      .expect(200);

    expect(response.body.type).toBe("users");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.some((entry) => entry.username === "jordan.bangoji")).toBe(true);
  });

  it("finds accounts by display name regardless of friendship", async () => {
    const response = await request(app)
      .get("/api/search")
      .set("Authorization", `Bearer ${authToken}`)
      .query({ q: "Daniel Stephen", type: "users" })
      .expect(200);

    expect(response.body.data.some((entry) => entry.username === "daniel_singz")).toBe(true);
    expect(response.body.data.some((entry) => entry.username === "viewer_user")).toBe(false);
  });
});
