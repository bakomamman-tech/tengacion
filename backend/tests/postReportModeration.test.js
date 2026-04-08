const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "12345678901234567890123456789012";
require("../../apps/api/config/env");

const app = require("../app");
const User = require("../models/User");
const Post = require("../models/Post");
const Report = require("../models/Report");
const ModerationCase = require("../models/ModerationCase");

let mongod;

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

describe("post report moderation", () => {
  let author;
  let reporter;
  let reporterToken;

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

    author = await User.create({
      name: "Post Author",
      username: "post_author",
      email: "post-author@test.com",
      password: "Password123!",
      emailVerified: true,
    });
    reporter = await User.create({
      name: "Post Reporter",
      username: "post_reporter",
      email: "post-reporter@test.com",
      password: "Password123!",
      emailVerified: true,
    });

    reporterToken = await issueSessionToken(reporter._id);
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

  test("reporting a post queues moderation without auto-hiding the post", async () => {
    const post = await Post.create({
      author: author._id,
      text: "Visible while report is pending review",
      privacy: "public",
      visibility: "public",
      audience: "public",
      moderationStatus: "ALLOW",
      sensitiveContent: false,
      sensitiveType: "",
    });

    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${reporterToken}`)
      .send({
        targetType: "post",
        targetId: post._id.toString(),
        reason: "harassment",
        details: "Please review this post",
      })
      .expect(201);

    const report = await Report.findById(response.body.report?._id).lean();
    const moderationCase = await ModerationCase.findOne({
      "subject.targetType": "post",
      "subject.targetId": post._id.toString(),
    }).lean();
    const refreshedPost = await Post.findById(post._id).lean();
    const feedResponse = await request(app).get("/api/posts").expect(200);
    const postResponse = await request(app)
      .get(`/api/posts/${post._id.toString()}`)
      .expect(200);

    expect(report).toBeTruthy();
    expect(report.status).toBe("open");
    expect(moderationCase).toBeTruthy();
    expect(String(report.moderationCaseId || "")).toBe(String(moderationCase._id));
    expect(moderationCase).toMatchObject({
      queue: "user_reported_sensitive_content",
      status: "HOLD_FOR_REVIEW",
      detectionSource: "user_report",
    });
    expect(refreshedPost).toMatchObject({
      _id: post._id,
      visibility: "public",
      privacy: "public",
      moderationStatus: "ALLOW",
      sensitiveContent: false,
      reviewRequired: false,
    });
    expect(refreshedPost.moderationCaseId).toBeNull();
    expect(feedResponse.body.some((entry) => entry._id === post._id.toString())).toBe(true);
    expect(postResponse.body).toMatchObject({
      _id: post._id.toString(),
      text: "Visible while report is pending review",
      moderationStatus: "ALLOW",
      sensitiveContent: false,
      reviewRequired: false,
    });
  });
});
