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
  authToken = await issueSessionToken(artist._id);
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

  test("GET /api/posts treats image posts with empty video subdocs as images", async () => {
    await Post.create({
      author: artist._id,
      text: "Updated profile picture",
      media: [{ url: "https://cdn.test/media/photo.jpg", type: "image" }],
      privacy: "public",
    });

    const response = await request(app).get("/api/posts").expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      text: "Updated profile picture",
      type: "image",
      image: "https://cdn.test/media/photo.jpg",
    });
    expect(response.body[0].video).toBeNull();
  });

  test("comments support threaded replies and author edits", async () => {
    const commenter = await User.create({
      name: "Commenter User",
      username: "commenter_user",
      email: "commenter_user@test.com",
      password: "Password123!",
    });
    const commenterToken = await issueSessionToken(commenter._id);

    const post = await Post.create({
      author: artist._id,
      text: "A post that needs replies",
      privacy: "public",
    });

    const topLevelComment = await request(app)
      .post(`/api/posts/${post._id}/comment`)
      .set("Authorization", `Bearer ${commenterToken}`)
      .send({ text: "Looks great!" })
      .expect(201);

    expect(topLevelComment.body.comment).toMatchObject({
      text: "Looks great!",
      authorName: "Commenter User",
      authorUsername: "commenter_user",
      parentCommentId: "",
      edited: false,
    });

    const replyComment = await request(app)
      .post(`/api/posts/${post._id}/comment`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        text: "Thanks for the kind words.",
        parentCommentId: topLevelComment.body.comment._id,
      })
      .expect(201);

    expect(replyComment.body.comment).toMatchObject({
      text: "Thanks for the kind words.",
      parentCommentId: topLevelComment.body.comment._id,
    });
    expect(replyComment.body.commentsCount).toBe(2);

    const threaded = await request(app)
      .get(`/api/posts/${post._id}/comments?threaded=true`)
      .expect(200);

    expect(threaded.body).toHaveLength(1);
    expect(threaded.body[0]).toMatchObject({
      _id: topLevelComment.body.comment._id,
      replies: expect.any(Array),
    });
    expect(threaded.body[0].replies).toHaveLength(1);
    expect(threaded.body[0].replies[0]).toMatchObject({
      text: "Thanks for the kind words.",
    });

    const updatedComment = await request(app)
      .put(`/api/posts/${post._id}/comments/${topLevelComment.body.comment._id}`)
      .set("Authorization", `Bearer ${commenterToken}`)
      .send({ text: "Looks amazing!" })
      .expect(200);

    expect(updatedComment.body.comment).toMatchObject({
      text: "Looks amazing!",
      edited: true,
    });

    await request(app)
      .put(`/api/posts/${post._id}/comments/${topLevelComment.body.comment._id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ text: "Should not work" })
      .expect(403);
  });
});
