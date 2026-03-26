const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.MODERATION_ENABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_key_for_moderation_suite_12345";
require("../../apps/api/config/env");

const moderationRoutes = require("../routes/moderation");
const postsRoutes = require("../../apps/api/routes/posts");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const User = require("../models/User");
const ModerationAuditLog = require("../models/ModerationAuditLog");
const ModerationCase = require("../models/ModerationCase");
const UserStrike = require("../models/UserStrike");
const {
  createOrUpdateModerationCase,
} = require("../services/moderationService");

let mongod;
let app;
let regularUser;
let primaryAdmin;
let ordinaryAdmin;
let adminToken;
let ordinaryAdminToken;
let userToken;

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
  app.set("realtimeSecurity", {
    disconnectUser: () => 0,
    disconnectSession: () => 0,
    disconnectUserSessionsExcept: () => 0,
  });
  app.use("/api/moderation", moderationRoutes);
  app.use("/api/posts", postsRoutes);
  app.use(errorHandler);
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();

  regularUser = await User.create({
    name: "Regular User",
    username: "regular_user",
    email: "regular@test.com",
    password: "Password123!",
  });
  primaryAdmin = await User.create({
    name: "Admin@tengacion",
    username: "admin_tengacion",
    email: "admin@tengacion.com",
    password: "Password123!",
    role: "super_admin",
    moderationProfile: {
      isPrimaryAuthority: true,
      escalationEmail: "admin@tengacion.com",
    },
  });
  ordinaryAdmin = await User.create({
    name: "Ordinary Admin",
    username: "ordinary_admin",
    email: "ordinary-admin@test.com",
    password: "Password123!",
    role: "admin",
  });

  adminToken = await issueSessionToken(primaryAdmin._id);
  ordinaryAdminToken = await issueSessionToken(ordinaryAdmin._id);
  userToken = await issueSessionToken(regularUser._id);
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
  } catch {
    // ignore cleanup errors
  } finally {
    await mongoose.disconnect().catch(() => null);
    if (mongod) {
      await mongod.stop();
    }
  }
});

describe("moderation decision engine", () => {
  test("explicit adult pornography is blocked outright", async () => {
    const result = await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "upload-explicit-1",
      title: "Hardcore porn upload",
      description: "explicit pornography",
      media: [{ mediaType: "image", originalFilename: "porn.jpg" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    expect(result.moderationDecision.status).toBe("BLOCK_EXPLICIT_ADULT");
    expect(result.moderationCase).toBeTruthy();
    expect(result.moderationCase.quarantine.isQuarantined).toBe(true);
    expect(result.moderationCase.quarantine.neverGeneratePreview).toBe(true);
    expect(result.moderationCase.media[0].restrictedPreviewUrl).toBe("");
  });

  test("suspected CSAM is blocked, quarantined, and escalated", async () => {
    const result = await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "upload-csam-1",
      title: "child pornography",
      description: "underage explicit scene",
      media: [{ mediaType: "image", originalFilename: "csam.png" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    expect(result.moderationDecision.status).toBe("BLOCK_SUSPECTED_CHILD_EXPLOITATION");
    expect(result.moderationCase.quarantine.isQuarantined).toBe(true);
    expect(result.moderationCase.quarantine.neverGeneratePreview).toBe(true);
    expect(result.moderationCase.escalation.required).toBe(true);
    expect(result.moderationCase.workflowState).toBe("ESCALATED");
    expect(result.moderationCase.media[0].restrictedPreviewUrl).toBe("");
  });

  test("explicit pornography is never blurred as a fallback", async () => {
    const result = await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "upload-explicit-2",
      title: "xxx porno",
      media: [{ mediaType: "video", originalFilename: "xxx.mp4" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    expect(result.moderationCase.status).toBe("BLOCK_EXPLICIT_ADULT");
    expect(result.moderationCase.media.every((entry) => !entry.restrictedPreviewUrl)).toBe(true);
  });

  test("extreme gore image can be restricted with blurred derivative", async () => {
    const result = await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "upload-gore-1",
      title: "documentary on graphic violence",
      description: "news coverage of beheading",
      media: [{ mediaType: "image", originalFilename: "gore-scene.jpg" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    expect(result.moderationDecision.status).toBe("RESTRICTED_BLURRED");
    expect(result.moderationCase.media[0].restrictedPreviewUrl).toContain(
      "/api/media/moderation-placeholder.svg"
    );
  });

  test("extreme gore video poster frame is blurred for restricted mode", async () => {
    const result = await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "upload-gore-video-1",
      title: "news documentary",
      description: "graphic violence and beheading investigation",
      media: [{ mediaType: "video", originalFilename: "gore-documentary.mp4" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    expect(result.moderationDecision.status).toBe("RESTRICTED_BLURRED");
    expect(result.moderationCase.media[0].restrictedPreviewUrl).toContain(
      "/api/media/moderation-placeholder.svg"
    );
  });

  test("glorified animal cruelty is blocked", async () => {
    const result = await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "upload-animal-1",
      title: "animal torture for fun",
      description: "sadistic dog fight celebration",
      media: [{ mediaType: "video", originalFilename: "animal-cruelty.mp4" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    expect(result.moderationDecision.status).toBe("BLOCK_ANIMAL_CRUELTY");
  });

  test("borderline violent content goes to hold for review", async () => {
    const result = await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "upload-review-1",
      title: "graphic violence scene",
      description: "bloody fight clip",
      media: [{ mediaType: "image", originalFilename: "violence-scene.jpg" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    expect(result.moderationDecision.status).toBe("HOLD_FOR_REVIEW");
  });

  test("safe family photo is allowed", async () => {
    const result = await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "upload-safe-1",
      title: "family picnic at the park",
      description: "birthday celebration outdoors",
      media: [{ mediaType: "image", originalFilename: "family-photo.jpg" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    expect(result.moderationDecision.status).toBe("ALLOW");
    expect(result.moderationCase).toBeNull();
  });

  test("safe animal photo is allowed", async () => {
    const result = await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "upload-safe-2",
      title: "golden retriever portrait",
      description: "happy dog in the garden",
      media: [{ mediaType: "image", originalFilename: "dog-photo.jpg" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    expect(result.moderationDecision.status).toBe("ALLOW");
    expect(result.moderationCase).toBeNull();
  });

  test("banned hash re-upload is blocked", async () => {
    await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "upload-hash-1",
      title: "explicit pornography",
      media: [{ mediaType: "image", originalFilename: "bad.jpg", fileHash: "same-hash" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    const result = await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "upload-hash-2",
      title: "family album cover",
      media: [{ mediaType: "image", originalFilename: "good.jpg", fileHash: "same-hash" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    expect(result.moderationDecision.status).toBe("BLOCK_EXPLICIT_ADULT");
    expect(result.moderationDecision.riskLabels).toContain("duplicate_ban_match");
  });
});

describe("moderation routes and enforcement", () => {
  test("Admin@tengacion can access the moderation queue", async () => {
    await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "queue-case-1",
      title: "explicit porn",
      media: [{ mediaType: "image", originalFilename: "queue-porn.jpg" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    const response = await request(app)
      .get("/api/moderation/queue")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(response.body.cases)).toBe(true);
    expect(response.body.cases.length).toBeGreaterThan(0);
  });

  test("ordinary admin and normal user cannot access the moderation queue", async () => {
    await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "queue-case-2",
      title: "graphic violence",
      media: [{ mediaType: "image", originalFilename: "queue-gore.jpg" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    await request(app)
      .get("/api/moderation/queue")
      .set("Authorization", `Bearer ${ordinaryAdminToken}`)
      .expect(403);

    await request(app)
      .get("/api/moderation/queue")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(403);
  });

  test("moderation action writes an audit log", async () => {
    const created = await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "queue-case-3",
      title: "graphic violence",
      media: [{ mediaType: "image", originalFilename: "queue-review.jpg" }],
      uploader: { userId: regularUser._id },
      detectionSource: "automated_upload_scan",
    });

    await request(app)
      .post(`/api/moderation/cases/${created.moderationCase._id}/actions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "reject", reason: "Rejected by trust and safety" })
      .expect(200);

    const auditRows = await ModerationAuditLog.find({
      moderationCaseId: created.moderationCase._id,
    }).lean();
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].adminEmail).toBe("admin@tengacion.com");
    expect(auditRows[0].actionType).toBe("reject");
  });

  test("suspend and ban actions write strike records", async () => {
    const created = await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "queue-case-4",
      title: "animal torture for fun",
      media: [{ mediaType: "video", originalFilename: "queue-animal.mp4" }],
      uploader: {
        userId: regularUser._id,
        email: regularUser.email,
        username: regularUser.username,
        displayName: regularUser.name,
      },
      detectionSource: "automated_upload_scan",
    });

    await request(app)
      .post(`/api/moderation/cases/${created.moderationCase._id}/actions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "suspend_user", reason: "Temporary restriction" })
      .expect(200);

    await request(app)
      .post(`/api/moderation/cases/${created.moderationCase._id}/actions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "ban_user", reason: "Severe repeat violation" })
      .expect(200);

    const strike = await UserStrike.findOne({ userId: regularUser._id }).lean();
    expect(strike).toBeTruthy();
    expect(strike.lastEnforcementAction).toBe("permanent_ban");
    expect(strike.history.some((entry) => entry.actionTaken === "temporary_suspend")).toBe(true);
    expect(strike.history.some((entry) => entry.actionTaken === "permanent_ban")).toBe(true);
  });

  test("explicit adult post creation is blocked with a safe user-facing message", async () => {
    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ text: "xxx porn upload" })
      .expect(422);

    expect(response.body).toMatchObject({
      moderationStatus: "BLOCK_EXPLICIT_ADULT",
      message: "This upload violates Tengacion's safety rules and cannot be published.",
    });

    const storedPost = await ModerationCase.findOne({
      "subject.targetType": "post",
    }).lean();
    expect(storedPost).toBeTruthy();
    expect(storedPost.status).toBe("BLOCK_EXPLICIT_ADULT");
  });
});
