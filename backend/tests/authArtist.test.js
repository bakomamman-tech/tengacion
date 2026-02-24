const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";

const authRoutes = require("../../apps/api/routes/auth");
const artistRoutes = require("../../apps/api/routes/artist");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const User = require("../models/User");

let mongod;
let app;
let authToken;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();

  const uri = mongod.getUri();

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });

  app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/artist", artistRoutes);
  app.use(errorHandler);
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  const creator = await User.create({
    name: "Artist Test",
    username: "artist_test",
    email: "artist@test.com",
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
  });

  authToken = jwt.sign({ id: creator._id }, process.env.JWT_SECRET, {
    expiresIn: "2h",
  });
});

afterAll(async () => {
  try {
    // Only drop DB if we actually connected
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
  } catch (e) {
    // ignore cleanup errors
  } finally {
    try {
      await mongoose.disconnect();
    } catch (e) {}

    if (mongod) {
      await mongod.stop();
    }
  }
});

describe("Auth / Protected Artist routes", () => {
  test("GET /api/auth/me returns profile", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty("email", "artist@test.com");
    expect(response.body).toHaveProperty("username", "artist_test");
  });

  test("PUT /api/artist/me saves links", async () => {
    const payload = {
      displayName: "Updated Artist",
      links: {
        spotify: "https://open.spotify.com/artist/sample",
        instagram: "https://instagram.com/tengacion",
      },
      customLinks: [
        { label: "Website", url: "https://tengacion.dev" },
      ],
    };

    const response = await request(app)
      .put("/api/artist/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send(payload)
      .expect(200);

    expect(response.body).toMatchObject({
      displayName: "Updated Artist",
      username: "artist_test",
    });
    expect(response.body.links).toMatchObject({
      spotify: payload.links.spotify,
      instagram: payload.links.instagram,
    });

    const normalize = (u) => {
      if (typeof u !== "string") return "";
      return u.endsWith("/") ? u.slice(0, -1) : u;
    };

    expect({
      ...response.body.customLinks[0],
      url: normalize(response.body.customLinks[0].url),
    }).toMatchObject({
      ...payload.customLinks[0],
      url: normalize(payload.customLinks[0].url),
    });
  });
});
