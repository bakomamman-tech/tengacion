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

const makeUser = async (overrides = {}) =>
  User.create({
    name: "Live Host",
    username: "live_host",
    email: `live-${Date.now()}-${Math.random()}@test.com`,
    password: "Password123!",
    role: "admin",
    ...overrides,
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
  test("gives an admin unlimited live access", async () => {
    const user = await makeUser();

    const access = LiveService.getLiveAccess(user);
    const quota = await LiveService.getUserQuota(user._id, new Date(), {
      quotaExempt: access.quotaExempt,
    });
    expect(quota).toMatchObject({
      unlimited: true,
      maxSecondsPerDay: null,
      canGoLive: true,
      remainingMillisecondsToday: null,
    });

    const session = await LiveService.createSession({
      userId: user._id,
      title: "Fresh live",
    });

    expect(session).toMatchObject({
      hostUserId: user._id,
      status: "active",
      quotaExempt: true,
      quotaLimitMs: 0,
    });
    expect(session.quotaExpiresAt).toBeUndefined();

    const publicSession = LiveService.toPublic(session);
    expect(publicSession.quota).toMatchObject({
      unlimited: true,
      maxSecondsPerDay: null,
      remainingMilliseconds: null,
      expiresAt: null,
    });
  });

  test("allows an admin to start again after using 30 seconds that day", async () => {
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

    const quota = await LiveService.getUserQuota(user._id, now, {
      quotaExempt: true,
    });
    expect(quota).toMatchObject({
      unlimited: true,
      remainingMillisecondsToday: null,
      canGoLive: true,
    });

    const session = await LiveService.createSession({
      userId: user._id,
      title: "Admin live",
    });

    expect(session).toMatchObject({
      status: "active",
      quotaExempt: true,
      quotaLimitMs: 0,
    });
  });

  test("upgrades an existing admin session to unlimited access", async () => {
    const user = await makeUser();
    const session = await LiveSession.create({
      hostUserId: user._id,
      hostName: user.name,
      hostUsername: user.username,
      hostAvatar: "",
      roomName: "legacy-admin-room",
      title: "Existing admin live",
      status: "active",
      startedAt: new Date(),
      quotaLimitMs: 30000,
      quotaExpiresAt: new Date(Date.now() + 30000),
    });

    expect(session.quotaExempt).toBe(false);

    const upgraded = await LiveService.getHostActiveSession(user._id, {
      quotaExempt: true,
    });

    expect(upgraded.quotaExempt).toBe(true);
    expect(upgraded.quotaLimitMs).toBe(0);
    expect(upgraded.quotaExpiresAt).toBeUndefined();
    expect(LiveService.toPublic(upgraded).quota.unlimited).toBe(true);
  });

  test("blocks non-admin users before creating a live session", async () => {
    const user = await makeUser({ role: "user" });

    await expect(
      LiveService.createSession({
        userId: user._id,
        title: "Blocked live",
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "You Need Permission from the Admin",
    });

    await expect(LiveSession.countDocuments({ hostUserId: user._id })).resolves.toBe(0);
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
