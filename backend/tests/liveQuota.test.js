const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
require("../../apps/api/config/env");

jest.mock("../services/livekitService", () => ({
  createLiveToken: jest.fn().mockResolvedValue("mock-live-token"),
  deleteLiveRoom: jest.fn().mockResolvedValue(undefined),
}));

const LiveService = require("../../apps/api/services/liveService");
const User = require("../models/User");
const LiveSession = require("../models/LiveSession");
const {
  deleteLiveRoom,
} = require("../services/livekitService");

let mongod;

const makeUser = async () =>
  User.create({
    name: "Live Host",
    username: "live_host",
    email: `live-${Date.now()}-${Math.random()}@test.com`,
    password: "Password123!",
  });

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
  jest.clearAllMocks();
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

describe("live quota enforcement", () => {
  test("tracks a fresh account with the full 30-second daily allowance", async () => {
    const user = await makeUser();

    const quota = await LiveService.getUserQuota(user._id);
    expect(quota).toMatchObject({
      maxSecondsPerDay: 30,
      canGoLive: true,
      remainingMillisecondsToday: 30000,
    });

    const session = await LiveService.createSession({
      userId: user._id,
      title: "Fresh live",
    });

    expect(session).toMatchObject({
      hostUserId: user._id,
      status: "active",
      quotaLimitMs: 30000,
    });
    expect(session.quotaExpiresAt).toBeInstanceOf(Date);

    const publicSession = LiveService.toPublic(session);
    expect(publicSession.quota).toMatchObject({
      maxSecondsPerDay: 30,
      remainingMilliseconds: expect.any(Number),
      expiresAt: expect.any(String),
    });
  });

  test("blocks a new live session after the account has used 30 seconds that day", async () => {
    const user = await makeUser();
    const now = new Date();

    await LiveSession.create({
      hostUserId: user._id,
      hostName: user.name,
      hostUsername: user.username,
      hostAvatar: "",
      roomName: "room-used-up",
      title: "Earlier stream",
      status: "ended",
      startedAt: new Date(now.getTime() - 30 * 1000),
      endedAt: now,
      quotaLimitMs: 30000,
      quotaExpiresAt: new Date(now.getTime() - 1000),
    });

    const quota = await LiveService.getUserQuota(user._id, now);
    expect(quota).toMatchObject({
      remainingMillisecondsToday: 0,
      canGoLive: false,
    });

    await expect(
      LiveService.createSession({
        userId: user._id,
        title: "Blocked live",
      })
    ).rejects.toMatchObject({
      statusCode: 429,
      message: "You have used your 30 seconds of live time for today",
    });
  });

  test("expires an active session once its quota window has passed", async () => {
    const user = await makeUser();
    const roomName = "expired-room";
    const now = new Date();

    await LiveSession.create({
      hostUserId: user._id,
      hostName: user.name,
      hostUsername: user.username,
      hostAvatar: "",
      roomName,
      title: "Expired live",
      status: "active",
      startedAt: new Date(now.getTime() - 31 * 1000),
      quotaLimitMs: 30000,
      quotaExpiresAt: new Date(now.getTime() - 1000),
    });

    await expect(LiveService.getActiveSessionByRoom(roomName)).rejects.toMatchObject({
      statusCode: 429,
      message: "This live session has reached the 30-second daily limit",
    });

    const updated = await LiveSession.findOne({ roomName });
    expect(updated.status).toBe("ended");
    expect(updated.endedAt).toBeInstanceOf(Date);
    expect(deleteLiveRoom).toHaveBeenCalledWith(roomName);
  });
});
