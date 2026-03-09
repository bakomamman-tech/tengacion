const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
require("../../apps/api/config/env");

const discoveryRoutes = require("../routes/discovery");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const User = require("../models/User");
const CreatorProfile = require("../models/CreatorProfile");
const Post = require("../models/Post");
const Message = require("../models/Message");
const LiveSession = require("../models/LiveSession");
const Track = require("../models/Track");
const Book = require("../models/Book");
const RecommendationLog = require("../models/RecommendationLog");
const AnalyticsEvent = require("../models/AnalyticsEvent");

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
  app.use("/api/discovery", discoveryRoutes);
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
  } catch (err) {
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

const seedScenario = async () => {
  const viewer = await User.create({
    name: "Viewer",
    username: "viewer_user",
    email: "viewer@test.com",
    password: "Password123!",
    interests: ["afrobeats", "live"],
  });
  const creatorOneUser = await User.create({
    name: "Creator One",
    username: "creator_one",
    email: "creator1@test.com",
    password: "Password123!",
  });
  const creatorTwoUser = await User.create({
    name: "Creator Two",
    username: "creator_two",
    email: "creator2@test.com",
    password: "Password123!",
  });

  viewer.following.addToSet(creatorOneUser._id);
  await viewer.save();

  const [creatorOne, creatorTwo] = await Promise.all([
    CreatorProfile.create({
      userId: creatorOneUser._id,
      displayName: "Creator One",
      genres: ["afrobeats"],
      isCreator: true,
      onboardingComplete: true,
    }),
    CreatorProfile.create({
      userId: creatorTwoUser._id,
      displayName: "Creator Two",
      genres: ["comedy"],
      isCreator: true,
      onboardingComplete: true,
    }),
  ]);

  creatorOneUser.followers.addToSet(viewer._id);
  await creatorOneUser.save();

  await Message.create({
    conversationId: `${viewer._id}:${creatorOneUser._id}`,
    senderId: viewer._id,
    receiverId: creatorOneUser._id,
    text: "Keep dropping music",
    senderName: viewer.name,
  });

  await Post.create([
    {
      author: creatorOneUser._id,
      text: "New drop for the people",
      privacy: "public",
      visibility: "public",
      audience: "public",
      likes: [viewer._id],
      commentsCount: 2,
      shareCount: 1,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      author: creatorTwoUser._id,
      text: "Fresh but not followed",
      privacy: "public",
      visibility: "public",
      audience: "public",
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  ]);

  const trackOne = await Track.create({
    creatorId: creatorOne._id,
    title: "Night Bus",
    price: 1000,
    audioUrl: "https://cdn.test/night-bus.mp3",
    previewUrl: "https://cdn.test/night-bus-preview.mp3",
    coverImageUrl: "https://cdn.test/night-bus.jpg",
    playsCount: 120,
    purchaseCount: 5,
  });
  await Book.create({
    creatorId: creatorOne._id,
    title: "Creative Notes",
    price: 2000,
    contentUrl: "https://cdn.test/book.pdf",
    previewUrl: "https://cdn.test/book-preview.pdf",
    coverImageUrl: "https://cdn.test/book.jpg",
    downloadCount: 40,
    purchaseCount: 3,
  });

  await Track.create({
    creatorId: creatorTwo._id,
    title: "Open Mic",
    price: 1000,
    audioUrl: "https://cdn.test/open-mic.mp3",
    previewUrl: "https://cdn.test/open-mic-preview.mp3",
    coverImageUrl: "https://cdn.test/open-mic.jpg",
    playsCount: 30,
    purchaseCount: 1,
    kind: "comedy",
  });

  await LiveSession.create([
    {
      hostUserId: creatorOneUser._id,
      hostName: creatorOneUser.name,
      hostUsername: creatorOneUser.username,
      hostAvatar: "",
      roomName: "creator-one-live",
      title: "Studio session",
      status: "active",
      viewerCount: 4,
      startedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      hostUserId: creatorTwoUser._id,
      hostName: creatorTwoUser.name,
      hostUsername: creatorTwoUser.username,
      hostAvatar: "",
      roomName: "creator-two-live",
      title: "Comedy room",
      status: "active",
      viewerCount: 10,
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
    },
  ]);

  await AnalyticsEvent.create({
    type: "creator_followed",
    userId: viewer._id,
    targetId: creatorOne._id,
    targetType: "creator",
    contentType: "creator",
    metadata: {
      creatorId: creatorOne._id.toString(),
    },
  });

  return {
    viewer,
    creatorOne,
    creatorTwo,
    creatorOneUser,
    trackOne,
    token: await issueSessionToken(viewer._id),
  };
};

describe("Discovery endpoints", () => {
  test("GET /api/discovery/home ranks follow-graph content first and logs the request", async () => {
    const { token } = await seedScenario();

    const response = await request(app)
      .get("/api/discovery/home")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.surface).toBe("home");
    expect(typeof response.body.requestId).toBe("string");
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items[0]).toMatchObject({
      entityType: "post",
      reason: expect.any(String),
    });
    expect(response.body.items[0].payload.username).toBe("creator_one");

    const log = await RecommendationLog.findOne({ requestId: response.body.requestId }).lean();
    expect(log).toBeTruthy();
    expect(log.surface).toBe("home");
    expect(log.rankedIds.length).toBeGreaterThan(0);
  });

  test("GET discovery creators, live, and creator-hub return ranked payloads", async () => {
    const { token } = await seedScenario();

    const [creatorsResponse, liveResponse, hubResponse] = await Promise.all([
      request(app)
        .get("/api/discovery/creators")
        .set("Authorization", `Bearer ${token}`),
      request(app)
        .get("/api/discovery/live")
        .set("Authorization", `Bearer ${token}`),
      request(app)
        .get("/api/discovery/creator-hub")
        .set("Authorization", `Bearer ${token}`),
    ]);

    expect(creatorsResponse.status).toBe(200);
    expect(creatorsResponse.body.items[0].entityType).toBe("creator");
    expect(creatorsResponse.body.items[0].payload.username).toBe("creator_one");

    expect(liveResponse.status).toBe(200);
    expect(liveResponse.body.surface).toBe("live");
    expect(liveResponse.body.items[0].entityType).toBe("live");

    expect(hubResponse.status).toBe(200);
    expect(hubResponse.body.surface).toBe("creator_hub");
    expect(hubResponse.body.items.length).toBeGreaterThan(0);
    expect(["track", "book", "album", "video"]).toContain(hubResponse.body.items[0].entityType);
  });

  test("POST /api/discovery/events accepts feedback and appends it to the recommendation log", async () => {
    const { token, trackOne } = await seedScenario();

    const discoveryResponse = await request(app)
      .get("/api/discovery/creator-hub")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const requestId = discoveryResponse.body.requestId;
    const feedbackResponse = await request(app)
      .post("/api/discovery/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        requestId,
        surface: "creator_hub",
        events: [
          {
            type: "recommendation_clicked",
            entityType: "track",
            entityId: trackOne._id.toString(),
            position: 0,
          },
        ],
      })
      .expect(202);

    expect(feedbackResponse.body).toMatchObject({
      success: true,
      requestId,
      accepted: 1,
    });

    const log = await RecommendationLog.findOne({ requestId }).lean();
    expect(log.feedback).toHaveLength(1);
    expect(log.feedback[0]).toMatchObject({
      type: "recommendation_clicked",
      entityType: "track",
      entityId: trackOne._id.toString(),
    });

    const trackedEvent = await AnalyticsEvent.findOne({
      type: "recommendation_clicked",
      targetId: trackOne._id.toString(),
    }).lean();
    expect(trackedEvent).toBeTruthy();
  });
});
