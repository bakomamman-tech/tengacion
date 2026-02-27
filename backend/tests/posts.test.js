const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
require("../../apps/api/config/env");

const postsRoutes = require("../../apps/api/routes/posts");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const User = require("../models/User");
const Post = require("../models/Post");

let mongod;
let app;
let authToken;
let artist;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });

  app = express();
  app.use(express.json());
  app.use("/api/posts", postsRoutes);
  app.use(errorHandler);
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  artist = await User.create({
    name: "Feed Artist",
    username: "feed_artist",
    email: "feed_artist@test.com",
    password: "Password123!",
  });
  authToken = jwt.sign({ id: artist._id }, process.env.JWT_SECRET, {
    expiresIn: "2h",
  });
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
  } catch (e) {
    // ignore cleanup errors
  } finally {
    try {
      await mongoose.disconnect();
    } catch (err) {
      // ignore disconnect errors
    }

    if (mongod) {
      await mongod.stop();
    }
  }
});

describe("Posts feed", () => {
  test("GET /api/posts returns public feed without auth", async () => {
    await Post.create([
      { author: artist._id, text: "First public post", privacy: "public" },
      { author: artist._id, text: "Second public post", privacy: "public" },
    ]);

    const response = await request(app).get("/api/posts").expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(2);
    const texts = response.body.map((post) => post.text);
    expect(texts).toEqual(
      expect.arrayContaining(["First public post", "Second public post"])
    );
  });

  test("POST /api/posts requires auth and succeeds with token", async () => {
    await request(app)
      .post("/api/posts")
      .send({ text: "blocked" })
      .expect(401);

    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ text: "Authorized feed post" })
      .expect(201);

    expect(response.body).toMatchObject({
      text: "Authorized feed post",
      username: "feed_artist",
    });

    const stored = await Post.findOne({ text: "Authorized feed post" }).lean();
    expect(stored).toBeTruthy();
    expect(stored.author.toString()).toBe(artist._id.toString());
  });

  test("POST /api/posts accepts video payload", async () => {
    const videoPayload = {
      type: "video",
      video: {
        url: "https://cdn.test/video.mp4",
        playbackUrl: "https://cdn.test/video.mp4",
        duration: 12.8,
        width: 1920,
        height: 1080,
        sizeBytes: 1024,
        mimeType: "video/mp4",
      },
    };

    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authToken}`)
      .send(videoPayload)
      .expect(201);

    expect(response.body).toMatchObject({
      type: "video",
      video: expect.objectContaining({ url: videoPayload.video.url }),
    });

    const stored = await Post.findOne({ _id: response.body._id });
    expect(stored).toBeTruthy();
    expect(stored.video.url).toBe(videoPayload.video.url);
  });
});
