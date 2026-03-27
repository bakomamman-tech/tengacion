const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_key_for_storage_suite_12345";
require("../../apps/api/config/env");

const adminRoutes = require("../routes/admin");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const { STEP_UP_COOKIE_NAME, signStepUpToken } = require("../services/authTokens");
const { createNotification } = require("../services/notificationService");
const { previewCleanup, runCleanup } = require("../services/storageMaintenanceService");
const Notification = require("../models/Notification");
const Otp = require("../models/Otp");
const AuthChallenge = require("../models/AuthChallenge");
const User = require("../models/User");
const Post = require("../models/Post");
const ModerationCase = require("../models/ModerationCase");
const MediaHash = require("../models/MediaHash");
const Message = require("../models/Message");

let mongod;
let app;
let adminUser;
let adminToken;
let regularUser;
let regularToken;

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

  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });

  app = express();
  app.use(express.json());
  app.set("io", null);
  app.set("onlineUsers", new Map());
  app.use("/api/admin", adminRoutes);
  app.use(errorHandler);
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();

  adminUser = await User.create({
    name: "Storage Admin",
    username: "storage_admin",
    email: "storage-admin@test.com",
    password: "Password123!",
    role: "super_admin",
  });
  regularUser = await User.create({
    name: "Regular User",
    username: "regular_user",
    email: "regular@test.com",
    password: "Password123!",
  });

  adminToken = await issueSessionToken(adminUser._id);
  regularToken = await issueSessionToken(regularUser._id);
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

describe("notification and storage hygiene", () => {
  test("createNotification deduplicates repeated notifications for the same event", async () => {
    const payload = {
      recipient: adminUser._id,
      sender: regularUser._id,
      type: "system",
      text: "sent you a moderation warning",
      entity: {
        id: regularUser._id,
        model: "User",
      },
      metadata: {
        link: "/admin/reports",
        previewText: "warning",
      },
    };

    await createNotification(payload);
    await createNotification(payload);

    const notifications = await Notification.find({
      recipient: adminUser._id,
    }).lean();

    expect(notifications).toHaveLength(1);
  });

  test("storage cleanup removes stale records and keeps active content intact", async () => {
    const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const temporaryCaseId = new mongoose.Types.ObjectId();

    const activePost = await Post.create({
      author: regularUser._id,
      text: "Active post that must stay",
      privacy: "public",
    });

    const staleNotification = await Notification.create({
      recipient: adminUser._id,
      sender: regularUser._id,
      type: "like",
      text: "liked your post",
      entity: {
        id: regularUser._id,
        model: "User",
      },
      read: true,
      readAt: oldDate,
      expiresAt: oldDate,
    });

    const session = [
      {
        sessionId: "revoked-session",
        createdAt: oldDate,
        lastSeenAt: oldDate,
        revokedAt: oldDate,
      },
    ];

    await User.updateOne(
      { _id: adminUser._id },
      {
        $set: { sessions: session },
      }
    );

    const expiredOtp = await Otp.create({
      email: "expired-otp@test.com",
      otpHash: "hash",
      expiresAt: oldDate,
      verified: false,
    });

    const expiredChallenge = await AuthChallenge.create({
      userId: adminUser._id,
      purpose: "step_up",
      method: "totp",
      codeHash: "hash",
      expiresAt: oldDate,
    });

    const tempCase = await ModerationCase.create({
      queue: "explicit_pornography",
      subject: {
        targetType: "post",
        targetId: temporaryCaseId.toString(),
        title: "Temporary upload",
        description: "Pending upload cleanup",
      },
      status: "pending",
      storageStage: "temporary",
      fileUrl: "private://quarantine/temp-case/temp-upload.jpg",
      media: [
        {
          role: "primary",
          sourceUrl: "private://quarantine/temp-case/temp-upload.jpg",
          previewUrl: "private://quarantine/temp-case/temp-upload.jpg",
        },
      ],
      createdAt: oldDate,
      updatedAt: oldDate,
    });
    await ModerationCase.updateOne(
      { _id: tempCase._id },
      { $set: { createdAt: oldDate, updatedAt: oldDate } }
    );

    const preview = await previewCleanup([
      "staleNotifications",
      "expiredAuthArtifacts",
      "temporaryUploads",
    ]);

    expect(preview.results.find((entry) => entry.action === "staleNotifications")?.matchedCount).toBe(1);
    expect(preview.results.find((entry) => entry.action === "expiredAuthArtifacts")?.matchedCount).toBeGreaterThanOrEqual(2);
    expect(preview.results.find((entry) => entry.action === "temporaryUploads")?.matchedCount).toBe(1);

    const result = await runCleanup([
      "staleNotifications",
      "expiredAuthArtifacts",
      "temporaryUploads",
    ]);

    expect(result.totals.deletedCount).toBeGreaterThanOrEqual(3);

    expect(await Notification.countDocuments({ _id: staleNotification._id })).toBe(0);
    expect(await Otp.countDocuments({ _id: expiredOtp._id })).toBe(0);
    expect(await AuthChallenge.countDocuments({ _id: expiredChallenge._id })).toBe(0);
    expect(await ModerationCase.countDocuments({ _id: tempCase._id })).toBe(0);

    const refreshedAdmin = await User.findById(adminUser._id).lean();
    expect(Array.isArray(refreshedAdmin.sessions)).toBe(true);
    expect(refreshedAdmin.sessions).toHaveLength(0);

    expect(await Post.countDocuments({ _id: activePost._id })).toBe(1);
    expect(await User.countDocuments({ _id: regularUser._id })).toBe(1);
  });

  test("duplicate and orphaned media cleanup removes only stale media hashes", async () => {
    const liveCase = await ModerationCase.create({
      queue: "explicit_pornography",
      subject: {
        targetType: "post",
        targetId: new mongoose.Types.ObjectId().toString(),
        title: "Live case",
      },
      status: "pending",
      storageStage: "permanent",
    });
    const orphanCaseId = new mongoose.Types.ObjectId();

    const livePrimary = await MediaHash.create({
      moderationCaseId: liveCase._id,
      targetType: "post",
      targetId: liveCase.subject.targetId,
      mediaRole: "primary",
      algorithm: "sha256",
      hashKind: "fingerprint",
      hashValue: "abc123",
      sourceUrl: "/uploads/media/live.jpg",
      mimeType: "image/jpeg",
      originalFilename: "live.jpg",
    });
    const liveDuplicate = await MediaHash.create({
      moderationCaseId: liveCase._id,
      targetType: "post",
      targetId: liveCase.subject.targetId,
      mediaRole: "primary",
      algorithm: "sha256",
      hashKind: "fingerprint",
      hashValue: "abc123",
      sourceUrl: "/uploads/media/live.jpg",
      mimeType: "image/jpeg",
      originalFilename: "live-copy.jpg",
    });
    const orphaned = await MediaHash.create({
      moderationCaseId: orphanCaseId,
      targetType: "post",
      targetId: orphanCaseId.toString(),
      mediaRole: "primary",
      algorithm: "sha256",
      hashKind: "fingerprint",
      hashValue: "orphaned",
      sourceUrl: "/uploads/media/orphan.jpg",
      mimeType: "image/jpeg",
      originalFilename: "orphan.jpg",
    });

    const preview = await previewCleanup(["duplicateMedia", "orphanedMedia"]);
    expect(preview.results.find((entry) => entry.action === "duplicateMedia")?.matchedCount).toBe(1);
    expect(preview.results.find((entry) => entry.action === "orphanedMedia")?.matchedCount).toBe(1);

    await runCleanup(["duplicateMedia", "orphanedMedia"]);

    expect(
      await MediaHash.countDocuments({
        moderationCaseId: liveCase._id,
        targetType: "post",
        targetId: liveCase.subject.targetId,
        mediaRole: "primary",
        algorithm: "sha256",
        hashKind: "fingerprint",
        hashValue: "abc123",
      })
    ).toBe(1);
    expect(
      await MediaHash.countDocuments({
        _id: { $in: [livePrimary._id, liveDuplicate._id] },
      })
    ).toBe(1);
    expect(await MediaHash.countDocuments({ _id: orphaned._id })).toBe(0);
  });
});

describe("admin storage endpoints", () => {
  test("storage cleanup run requires step-up approval for admin users", async () => {
    const response = await request(app)
      .post("/api/admin/storage/cleanup/run")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ actions: ["staleNotifications"] })
      .expect(409);

    expect(response.body.details?.code).toBe("STEP_UP_REQUIRED");
  });

  test("storage overview and cleanup run are available to admins with step-up", async () => {
    const adminSession = jwt.verify(adminToken, process.env.JWT_SECRET);
    const stepUpToken = signStepUpToken({
      userId: adminUser._id,
      sessionId: adminSession.sid,
    });
    const stepUpCookie = `${STEP_UP_COOKIE_NAME}=${stepUpToken}`;

    const overview = await request(app)
      .get("/api/admin/storage/overview")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(overview.body.actions)).toBe(true);
    expect(Array.isArray(overview.body.collections)).toBe(true);

    const runResponse = await request(app)
      .post("/api/admin/storage/cleanup/run")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Cookie", stepUpCookie)
      .send({ actions: ["staleNotifications"], dryRun: true })
      .expect(200);

    expect(runResponse.body.dryRun).toBe(true);
    expect(runResponse.body.actions).toContain("staleNotifications");
  });

  test("storage overview is forbidden for non-admin users", async () => {
    await request(app)
      .get("/api/admin/storage/overview")
      .set("Authorization", `Bearer ${regularToken}`)
      .expect(403);
  });
});
