const express = require("express");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.MODERATION_ENABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_key_for_moderation_suite_12345";
require("../../apps/api/config/env");

const moderationRoutes = require("../routes/moderation");
const adminRoutes = require("../routes/admin");
const mediaRoutes = require("../routes/media");
const postsRoutes = require("../../apps/api/routes/posts");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const User = require("../models/User");
const Message = require("../models/Message");
const ModerationAuditLog = require("../models/ModerationAuditLog");
const ModerationCase = require("../models/ModerationCase");
const Post = require("../models/Post");
const UserStrike = require("../models/UserStrike");
const Video = require("../models/Video");
const { MODERATION_REPEAT_VIOLATOR_STRIKE_THRESHOLD } = require("../config/moderation");
const { STEP_UP_COOKIE_NAME, signStepUpToken } = require("../services/authTokens");
const { saveUploadedMedia, saveUploadedMediaToGridFs } = require("../services/mediaStore");
const {
  createOrUpdateModerationCase,
} = require("../services/moderationService");
const {
  createUploadModerationCase,
} = require("../services/uploadModerationService");

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

const makeTempUploadFile = async ({ prefix, filename, contents }) => {
  const filePath = path.join(
    os.tmpdir(),
    `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}-${filename}`
  );
  await fs.writeFile(filePath, Buffer.from(contents));
  return filePath;
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
  app.use("/api/media", mediaRoutes);
  app.use("/api/admin", adminRoutes);
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
  test("multipart explicit image uploads are blocked before a post is created", async () => {
    const tempFilePath = path.join(
      os.tmpdir(),
      `tengacion-explicit-${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`
    );
    await fs.writeFile(tempFilePath, Buffer.from("explicit test image bytes"));

    try {
      const response = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${userToken}`)
        .field("text", "Vacation upload")
        .attach("file", tempFilePath, {
          filename: "porn.jpg",
          contentType: "image/jpeg",
        })
        .expect(422);

      expect(response.body).toMatchObject({
        moderationStatus: "BLOCK_EXPLICIT_ADULT",
        reviewRequired: false,
      });
      expect(await Post.countDocuments()).toBe(0);

      const moderationCase = await ModerationCase.findOne({
        queue: "explicit_pornography",
        "subject.targetType": "post_upload",
      }).lean();
      expect(moderationCase).toBeTruthy();
      expect(moderationCase.status).toBe("BLOCK_EXPLICIT_ADULT");
      expect(moderationCase.quarantine.isQuarantined).toBe(true);
    } finally {
      await fs.unlink(tempFilePath).catch(() => null);
    }
  });

  test("multipart explicit video uploads are blocked before a post is created", async () => {
    const tempFilePath = await makeTempUploadFile({
      prefix: "tengacion-explicit-video",
      filename: "porn-video.mp4",
      contents: "explicit porn test video bytes",
    });

    try {
      const response = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${userToken}`)
        .field("text", "Video upload")
        .attach("file", tempFilePath, {
          filename: "porn-video.mp4",
          contentType: "video/mp4",
        })
        .expect(422);

      expect(response.body).toMatchObject({
        moderationStatus: "BLOCK_EXPLICIT_ADULT",
        reviewRequired: false,
      });
      expect(await Post.countDocuments()).toBe(0);

      const moderationCase = await ModerationCase.findOne({
        queue: "upload_moderation",
        "subject.targetType": "post_upload",
        "subject.mediaType": "video",
      }).lean();
      expect(moderationCase).toBeTruthy();
      expect(moderationCase.status).toBe("rejected");
      expect(moderationCase.visibility).toBe("blocked");
      expect(String(moderationCase.fileUrl || "")).toContain("private://");
    } finally {
      await fs.unlink(tempFilePath).catch(() => null);
    }
  });

  test("gory uploads are quarantined and kept private", async () => {
    const tempFilePath = await makeTempUploadFile({
      prefix: "tengacion-gore",
      filename: "gore-review.jpg",
      contents: "graphic violence scene",
    });

    try {
      const response = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${userToken}`)
        .field("text", "graphic violence scene")
        .attach("file", tempFilePath, {
          filename: "gore-review.jpg",
          contentType: "image/jpeg",
        })
        .expect(202);

      expect(response.body).toMatchObject({
        moderationStatus: "quarantined",
        reviewRequired: true,
      });
      expect(await Post.countDocuments()).toBe(0);

      const moderationCase = await ModerationCase.findOne({
        queue: "upload_moderation",
        "subject.targetType": "post_upload",
        "subject.mediaType": "image",
      }).lean();
      expect(moderationCase).toBeTruthy();
      expect(moderationCase.status).toBe("quarantined");
      expect(moderationCase.visibility).toBe("private");
      expect(moderationCase.storageStage).toBe("quarantine");
      expect(String(moderationCase.fileUrl || "")).toContain("private://");
    } finally {
      await fs.unlink(tempFilePath).catch(() => null);
    }
  });

  test("safe uploads are approved and published", async () => {
    const tempFilePath = await makeTempUploadFile({
      prefix: "tengacion-safe",
      filename: "family-pic.jpg",
      contents: "family picnic at the park",
    });

    try {
      const response = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${userToken}`)
        .field("text", "Family picnic at the park")
        .attach("file", tempFilePath, {
          filename: "family-pic.jpg",
          contentType: "image/jpeg",
        })
        .expect(201);

      expect(response.body.visibility).toBe("public");
      expect(response.body.moderationStatus).toBe("approved");
      expect(await Post.countDocuments()).toBe(1);

      const post = await Post.findOne({ text: "Family picnic at the park" }).lean();
      expect(post).toBeTruthy();
      expect(post.visibility).toBe("public");
      expect(post.moderationStatus).toBe("approved");

      const moderationCase = await ModerationCase.findOne({
        queue: "upload_moderation",
        targetType: "post",
        targetId: post._id.toString(),
      }).lean();
      expect(moderationCase).toBeTruthy();
      expect(moderationCase.status).toBe("approved");
      expect(moderationCase.visibility).toBe("public");
    } finally {
      await fs.unlink(tempFilePath).catch(() => null);
    }
  });

  test("admin approve and reject moderation items update target content", async () => {
    const approvedPost = await Post.create({
      author: regularUser._id,
      text: "Queued image",
      visibility: "private",
      privacy: "public",
      moderationStatus: "pending",
      storageStage: "temporary",
      media: [{ url: "https://cdn.test/media/queued-safe.jpg", type: "image" }],
    });

    const approvedCase = await createUploadModerationCase({
      targetType: "post",
      targetId: approvedPost._id.toString(),
      uploader: {
        userId: regularUser._id,
        email: regularUser.email,
        username: regularUser.username,
        displayName: regularUser.name,
      },
      fileUrl: "https://cdn.test/media/queued-safe.jpg",
      mimeType: "image/jpeg",
      labels: ["manual_review"],
      reason: "Pending admin review",
      confidence: 0.42,
      status: "pending",
      visibility: "private",
      storageStage: "temporary",
      subject: {
        title: "Queued image",
        description: "Queued image",
        mediaType: "image",
        createdAt: new Date(),
      },
      media: [
        {
          role: "primary",
          mediaType: "image",
          mimeType: "image/jpeg",
          sourceUrl: "https://cdn.test/media/queued-safe.jpg",
          previewUrl: "https://cdn.test/media/queued-safe.jpg",
          originalFilename: "queued-safe.jpg",
          fileSizeBytes: 123,
        },
      ],
    });

    await request(app)
      .post(`/api/admin/moderation/items/${approvedCase._id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Looks safe" })
      .expect(200);

    const approvedCaseAfter = await ModerationCase.findById(approvedCase._id).lean();
    const approvedPostAfter = await Post.findById(approvedPost._id).lean();

    expect(approvedCaseAfter.status).toBe("approved");
    expect(approvedPostAfter.visibility).toBe("public");
    expect(approvedPostAfter.moderationStatus).toBe("approved");

    const rejectedPost = await Post.create({
      author: regularUser._id,
      text: "Queued image for rejection",
      visibility: "private",
      privacy: "public",
      moderationStatus: "pending",
      storageStage: "temporary",
      media: [{ url: "https://cdn.test/media/queued-reject.jpg", type: "image" }],
    });

    const rejectedCase = await createUploadModerationCase({
      targetType: "post",
      targetId: rejectedPost._id.toString(),
      uploader: {
        userId: regularUser._id,
        email: regularUser.email,
        username: regularUser.username,
        displayName: regularUser.name,
      },
      fileUrl: "https://cdn.test/media/queued-reject.jpg",
      mimeType: "image/jpeg",
      labels: ["manual_review"],
      reason: "Pending admin review",
      confidence: 0.42,
      status: "pending",
      visibility: "private",
      storageStage: "temporary",
      subject: {
        title: "Queued image for rejection",
        description: "Queued image for rejection",
        mediaType: "image",
        createdAt: new Date(),
      },
      media: [
        {
          role: "primary",
          mediaType: "image",
          mimeType: "image/jpeg",
          sourceUrl: "https://cdn.test/media/queued-reject.jpg",
          previewUrl: "https://cdn.test/media/queued-reject.jpg",
          originalFilename: "queued-reject.jpg",
          fileSizeBytes: 123,
        },
      ],
    });

    await request(app)
      .post(`/api/admin/moderation/items/${rejectedCase._id}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Violates safety rules" })
      .expect(200);

    const rejectedCaseAfter = await ModerationCase.findById(rejectedCase._id).lean();
    const rejectedPostAfter = await Post.findById(rejectedPost._id).lean();

    expect(rejectedCaseAfter.status).toBe("rejected");
    expect(rejectedPostAfter.visibility).toBe("blocked");
    expect(rejectedPostAfter.moderationStatus).toBe("rejected");
  });

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

  test("admin scan can pull a matched user's image and video content into manual review", async () => {
    const matchedUser = await User.create({
      name: "Stephen Daniel Kurah",
      username: "stephen_kurah",
      email: "stephen.kurah@test.com",
      password: "Password123!",
    });

    await Post.create({
      author: matchedUser._id,
      text: "Summer memories",
      media: [{ url: "https://cdn.test/media/photo-safe.jpg", type: "image" }],
      privacy: "public",
      visibility: "public",
    });

    await Video.create({
      userId: matchedUser._id.toString(),
      name: matchedUser.name,
      username: matchedUser.username,
      videoUrl: "https://cdn.test/media/video-safe.mp4",
      caption: "Clip upload",
      description: "Recent upload",
    });

    const response = await request(app)
      .post("/api/moderation/scan")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ search: "Stephen Daniel Kurah", includeManualReview: true, limit: 10 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.scannedCount).toBeGreaterThanOrEqual(2);
    expect(response.body.flaggedCount).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(response.body.cases)).toBe(true);
    expect(response.body.cases.length).toBeGreaterThanOrEqual(2);
    expect(
      response.body.cases.every((entry) => entry.status === "HOLD_FOR_REVIEW")
    ).toBe(true);
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

    const warningMessage = await Message.findOne({
      receiverId: regularUser._id,
      senderId: primaryAdmin._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    expect(warningMessage).toBeTruthy();
    expect(warningMessage.text).toContain("Rejected by trust and safety");
  });

  test("hold for review action updates the case and keeps the post hidden", async () => {
    const post = await Post.create({
      author: regularUser._id,
      text: "Documentary post",
      visibility: "public",
      privacy: "public",
      media: [{ url: "https://cdn.test/media/gore-image.jpg", type: "image" }],
    });

    const created = await createOrUpdateModerationCase({
      targetType: "post",
      targetId: post._id.toString(),
      title: "documentary on graphic violence",
      description: "news coverage of beheading",
      media: [{ mediaType: "image", sourceUrl: "https://cdn.test/media/gore-image.jpg" }],
      uploader: {
        userId: regularUser._id,
        email: regularUser.email,
        username: regularUser.username,
        displayName: regularUser.name,
      },
      detectionSource: "automated_upload_scan",
      targetDoc: post,
    });

    await request(app)
      .post(`/api/moderation/cases/${created.moderationCase._id}/actions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "hold_for_review", reason: "Needs an additional reviewer" })
      .expect(200);

    const refreshedCase = await ModerationCase.findById(created.moderationCase._id).lean();
    const refreshedPost = await Post.findById(post._id).lean();

    expect(refreshedCase.status).toBe("HOLD_FOR_REVIEW");
    expect(refreshedCase.workflowState).toBe("UNDER_REVIEW");
    expect(refreshedPost.moderationStatus).toBe("HOLD_FOR_REVIEW");
    expect(refreshedPost.reviewRequired).toBe(true);
    expect(refreshedPost.visibility).toBe("private");
    expect(refreshedPost.originalVisibility).toBe("public");
  });

  test("restore content action republishes previously blocked content", async () => {
    const post = await Post.create({
      author: regularUser._id,
      text: "Borderline clip",
      visibility: "public",
      privacy: "public",
      media: [{ url: "https://cdn.test/media/review-image.jpg", type: "image" }],
    });

    const created = await createOrUpdateModerationCase({
      targetType: "post",
      targetId: post._id.toString(),
      title: "graphic violence scene",
      description: "bloody fight clip",
      media: [{ mediaType: "image", sourceUrl: "https://cdn.test/media/review-image.jpg" }],
      uploader: {
        userId: regularUser._id,
        email: regularUser.email,
        username: regularUser.username,
        displayName: regularUser.name,
      },
      detectionSource: "automated_upload_scan",
      targetDoc: post,
    });

    await request(app)
      .post(`/api/moderation/cases/${created.moderationCase._id}/actions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "reject", reason: "Hidden pending further action" })
      .expect(200);

    await request(app)
      .post(`/api/moderation/cases/${created.moderationCase._id}/actions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "restore_content", reason: "Allowed after manual review" })
      .expect(200);

    const refreshedCase = await ModerationCase.findById(created.moderationCase._id).lean();
    const refreshedPost = await Post.findById(post._id).lean();

    expect(refreshedCase.status).toBe("ALLOW");
    expect(refreshedPost.moderationStatus).toBe("ALLOW");
    expect(refreshedPost.reviewRequired).toBe(false);
    expect(refreshedPost.visibility).toBe("public");
  });

  test("delete media action blocks the video and archives it from public use", async () => {
    const video = await Video.create({
      userId: regularUser._id.toString(),
      name: regularUser.name,
      username: regularUser.username,
      videoUrl: "https://cdn.test/media/violent-video.mp4",
      coverImageUrl: "https://cdn.test/media/violent-video-cover.jpg",
      caption: "Investigation clip",
      description: "graphic violence and bloodshed",
    });

    const created = await createOrUpdateModerationCase({
      targetType: "video",
      targetId: video._id.toString(),
      title: "graphic violence and bloodshed",
      description: "violent upload",
      media: [{ mediaType: "video", sourceUrl: video.videoUrl, previewUrl: video.coverImageUrl }],
      uploader: {
        userId: regularUser._id,
        email: regularUser.email,
        username: regularUser.username,
        displayName: regularUser.name,
      },
      detectionSource: "automated_upload_scan",
      targetDoc: video,
    });

    await request(app)
      .post(`/api/moderation/cases/${created.moderationCase._id}/actions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "delete_media", reason: "Remove from public access" })
      .expect(200);

    const refreshedCase = await ModerationCase.findById(created.moderationCase._id).lean();
    const refreshedVideo = await Video.findById(video._id).lean();

    expect(refreshedCase.latestDecisionSummary.actionType).toBe("delete_media");
    expect(refreshedVideo.moderationStatus).toBe("BLOCK_EXTREME_GORE");
    expect(refreshedVideo.publishedStatus).toBe("blocked");
    expect(refreshedVideo.archivedAt).toBeTruthy();
  });

  test("moderation uploader detail route returns the uploader account state", async () => {
    const created = await createOrUpdateModerationCase({
      targetType: "creator_upload",
      targetId: "queue-case-uploader-1",
      title: "graphic violence",
      media: [{ mediaType: "image", originalFilename: "queue-uploader.jpg" }],
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

    const response = await request(app)
      .get(`/api/moderation/cases/${created.moderationCase._id}/uploader`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.user).toBeTruthy();
    expect(response.body.user.username).toBe("regular_user");
    expect(response.body.user.isSuspended).toBe(true);
    expect(response.body.strike.count).toBeGreaterThanOrEqual(1);
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

    const warningMessages = await Message.find({
      receiverId: regularUser._id,
      senderId: primaryAdmin._id,
    })
      .sort({ createdAt: 1 })
      .lean();

    expect(warningMessages.length).toBeGreaterThanOrEqual(2);
    expect(warningMessages.some((entry) => String(entry.text || "").includes("Temporary restriction"))).toBe(true);
    expect(warningMessages.some((entry) => String(entry.text || "").includes("Severe repeat violation"))).toBe(true);
  });

  test("admin moderation stats and filtered cases reflect real moderation data", async () => {
    const uploader = {
      userId: regularUser._id,
      email: regularUser.email,
      username: regularUser.username,
      displayName: regularUser.name,
    };

    const pendingCase = await createUploadModerationCase({
      targetType: "creator_upload",
      targetId: "stats-pending-1",
      queue: "explicit_pornography",
      title: "Pending explicit review",
      description: "Pending explicit review",
      media: [{ mediaType: "image", originalFilename: "pending-explicit.jpg" }],
      uploader,
      detectionSource: "automated_upload_scan",
      status: "pending",
      reason: "Pending explicit review",
      confidence: 0.42,
      subject: {
        title: "Pending explicit review",
        description: "Pending explicit review",
        mediaType: "image",
        createdAt: new Date(),
      },
    });

    await createUploadModerationCase({
      targetType: "creator_upload",
      targetId: "stats-blocked-1",
      queue: "explicit_pornography",
      title: "Blocked explicit review",
      description: "Blocked explicit review",
      media: [{ mediaType: "image", originalFilename: "blocked-explicit.jpg" }],
      uploader,
      detectionSource: "automated_upload_scan",
      status: "BLOCK_EXPLICIT_ADULT",
      reason: "Blocked explicit review",
      confidence: 0.98,
      subject: {
        title: "Blocked explicit review",
        description: "Blocked explicit review",
        mediaType: "image",
        createdAt: new Date(),
      },
    });

    await createUploadModerationCase({
      targetType: "creator_upload",
      targetId: "stats-csam-1",
      queue: "suspected_child_exploitation",
      title: "CSAM suspect case",
      description: "CSAM suspect case",
      media: [{ mediaType: "image", originalFilename: "csam.jpg" }],
      uploader,
      detectionSource: "automated_upload_scan",
      status: "BLOCK_SUSPECTED_CHILD_EXPLOITATION",
      reason: "CSAM suspect case",
      confidence: 0.99,
      subject: {
        title: "CSAM suspect case",
        description: "CSAM suspect case",
        mediaType: "image",
        createdAt: new Date(),
      },
    });

    await createUploadModerationCase({
      targetType: "creator_upload",
      targetId: "stats-gore-1",
      queue: "graphic_gore",
      title: "Restricted gore case",
      description: "Restricted gore case",
      media: [{ mediaType: "image", originalFilename: "gore.jpg" }],
      uploader,
      detectionSource: "automated_upload_scan",
      status: "RESTRICTED_BLURRED",
      reason: "Restricted gore case",
      confidence: 0.7,
      subject: {
        title: "Restricted gore case",
        description: "Restricted gore case",
        mediaType: "image",
        createdAt: new Date(),
      },
    });

    await createUploadModerationCase({
      targetType: "creator_upload",
      targetId: "stats-animal-1",
      queue: "animal_cruelty",
      title: "Animal cruelty case",
      description: "Animal cruelty case",
      media: [{ mediaType: "image", originalFilename: "animal.jpg" }],
      uploader,
      detectionSource: "automated_upload_scan",
      status: "BLOCK_ANIMAL_CRUELTY",
      reason: "Animal cruelty case",
      confidence: 0.94,
      subject: {
        title: "Animal cruelty case",
        description: "Animal cruelty case",
        mediaType: "image",
        createdAt: new Date(),
      },
    });

    await UserStrike.create({
      userId: regularUser._id,
      count: MODERATION_REPEAT_VIOLATOR_STRIKE_THRESHOLD,
      lastActionAt: new Date(),
      lastActionType: "ban_user",
      lastSeverity: "high",
      lastEnforcementAction: "permanent_ban",
    });

    const statsResponse = await request(app)
      .get("/api/admin/moderation/stats")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(statsResponse.body).toMatchObject({
      pendingReview: 1,
      blockedExplicit: 1,
      suspectedCsam: 1,
      restrictedGore: 1,
      animalCruelty: 1,
      repeatViolators: 1,
      repeatViolatorThreshold: MODERATION_REPEAT_VIOLATOR_STRIKE_THRESHOLD,
    });

    const casesResponse = await request(app)
      .get("/api/admin/moderation/cases")
      .query({
        category: "explicit_pornography",
        status: "pending",
        search: "Pending explicit",
        limit: 20,
      })
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(casesResponse.body.total).toBe(1);
    expect(casesResponse.body.cases).toHaveLength(1);
    expect(casesResponse.body.cases[0]._id).toBe(pendingCase._id.toString());
    expect(casesResponse.body.cases[0].queue).toBe("explicit_pornography");
  });

  test("admin scan recent alias processes recent media", async () => {
    await Post.create({
      author: regularUser._id,
      text: "Family picnic at the park",
      privacy: "public",
      visibility: "public",
      media: [{ url: "https://cdn.test/media/family-pic.jpg", type: "image" }],
    });

    await Video.create({
      userId: regularUser._id.toString(),
      name: regularUser.name,
      username: regularUser.username,
      videoUrl: "https://cdn.test/media/explicit-family-video.mp4",
      coverImageUrl: "https://cdn.test/media/explicit-family-cover.jpg",
      caption: "xxx porn clip",
      description: "explicit porn example",
    });

    const response = await request(app)
      .post("/api/admin/moderation/scan/recent")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ limit: 20 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.scannedCount).toBeGreaterThanOrEqual(4);
    expect(response.body.approvedCount).toBeGreaterThanOrEqual(1);
    expect(response.body.blockedCount).toBeGreaterThanOrEqual(1);
    expect(response.body.accountsFlagged).toBe(0);
    expect(Array.isArray(response.body.cases)).toBe(true);
    expect(response.body.cases).toHaveLength(1);
  });

  test("admin scan recent alias flags user accounts and direct messages", async () => {
    await User.updateOne(
      { _id: regularUser._id },
      {
        $set: {
          bio: "explicit pornography fan page",
          "status.text": "xxx porn archive",
        },
      }
    );

    await Message.create({
      conversationId: `${regularUser._id.toString()}-${primaryAdmin._id.toString()}`,
      senderId: regularUser._id,
      receiverId: primaryAdmin._id,
      text: "graphic violence beheading clip",
      senderName: regularUser.name,
      type: "text",
      attachments: [],
    });

    const response = await request(app)
      .post("/api/admin/moderation/scan/recent")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ limit: 20 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.scannedCount).toBeGreaterThanOrEqual(4);
    expect(response.body.flaggedCount).toBeGreaterThanOrEqual(2);
    expect(response.body.accountsFlagged).toBe(1);
    expect(response.body.cases.some((entry) => entry.subject.targetType === "user")).toBe(true);
    expect(response.body.cases.some((entry) => entry.subject.targetType === "message")).toBe(true);
  });

  test("admin scan search alias scans content for matching users", async () => {
    const matchedUser = await User.create({
      name: "Search Match Person",
      username: "search_match_person",
      email: "search.match@test.com",
      password: "Password123!",
    });

    await Post.create({
      author: matchedUser._id,
      text: "Search match safe post",
      privacy: "public",
      visibility: "public",
      media: [{ url: "https://cdn.test/media/search-safe.jpg", type: "image" }],
    });

    await Video.create({
      userId: matchedUser._id.toString(),
      name: matchedUser.name,
      username: matchedUser.username,
      videoUrl: "https://cdn.test/media/search-explicit.mp4",
      coverImageUrl: "https://cdn.test/media/search-explicit-cover.jpg",
      caption: "search explicit",
      description: "xxx porn search hit",
    });

    const response = await request(app)
      .post("/api/admin/moderation/scan/search")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ search: matchedUser.name, limit: 20 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.scannedCount).toBeGreaterThanOrEqual(3);
    expect(response.body.flaggedCount).toBeGreaterThanOrEqual(1);
    expect(response.body.cases.length).toBeGreaterThanOrEqual(1);
  });

  test("repeat violators and direct user enforcement routes reflect real account state", async () => {
    await UserStrike.create({
      userId: regularUser._id,
      count: MODERATION_REPEAT_VIOLATOR_STRIKE_THRESHOLD,
      lastActionAt: new Date(),
      lastActionType: "ban_user",
      lastSeverity: "high",
      lastEnforcementAction: "permanent_ban",
    });

    const repeatResponse = await request(app)
      .get("/api/admin/moderation/repeat-violators")
      .query({ search: "Regular", limit: 20 })
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(repeatResponse.body.total).toBe(1);
    expect(repeatResponse.body.users).toHaveLength(1);
    expect(repeatResponse.body.users[0].user.username).toBe("regular_user");
    expect(repeatResponse.body.users[0].strikeCount).toBe(MODERATION_REPEAT_VIOLATOR_STRIKE_THRESHOLD);

    const adminSession = jwt.verify(adminToken, process.env.JWT_SECRET);
    const stepUpToken = signStepUpToken({
      userId: primaryAdmin._id,
      sessionId: adminSession.sid,
    });
    const stepUpCookie = `${STEP_UP_COOKIE_NAME}=${stepUpToken}`;

    const actionUser = await User.create({
      name: "Queue Action User",
      username: "queue_action_user",
      email: "queue-action@test.com",
      password: "Password123!",
    });

    await request(app)
      .post(`/api/admin/users/${actionUser._id}/suspend`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Cookie", stepUpCookie)
      .send({ reason: "Temporary restriction" })
      .expect(200);

    let refreshedUser = await User.findById(actionUser._id).lean();
    expect(refreshedUser.isSuspended).toBe(true);
    expect(refreshedUser.isActive).toBe(false);

    await request(app)
      .post(`/api/admin/users/${actionUser._id}/unsuspend`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Cookie", stepUpCookie)
      .send({ reason: "Lifted after review" })
      .expect(200);

    refreshedUser = await User.findById(actionUser._id).lean();
    expect(refreshedUser.isSuspended).toBe(false);
    expect(refreshedUser.isActive).toBe(true);

    await request(app)
      .post(`/api/admin/users/${actionUser._id}/ban`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Cookie", stepUpCookie)
      .send({ reason: "Severe violation" })
      .expect(200);

    await request(app)
      .post(`/api/admin/users/${actionUser._id}/unban`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Cookie", stepUpCookie)
      .send({ reason: "Cleared after appeal" })
      .expect(200);

    refreshedUser = await User.findById(actionUser._id).lean();
    expect(refreshedUser.isBanned).toBe(false);
    expect(refreshedUser.isActive).toBe(true);

    await request(app)
      .delete(`/api/admin/users/${primaryAdmin._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Cookie", stepUpCookie)
      .expect(400);

    const ordinaryAdminSession = jwt.verify(ordinaryAdminToken, process.env.JWT_SECRET);
    const ordinaryAdminStepUpToken = signStepUpToken({
      userId: ordinaryAdmin._id,
      sessionId: ordinaryAdminSession.sid,
    });
    const ordinaryAdminStepUpCookie = `${STEP_UP_COOKIE_NAME}=${ordinaryAdminStepUpToken}`;

    await request(app)
      .get(`/api/admin/users/${primaryAdmin._id}`)
      .set("Authorization", `Bearer ${ordinaryAdminToken}`)
      .set("Cookie", ordinaryAdminStepUpCookie)
      .expect(403);

    await request(app)
      .post(`/api/admin/users/${primaryAdmin._id}/ban`)
      .set("Authorization", `Bearer ${ordinaryAdminToken}`)
      .set("Cookie", ordinaryAdminStepUpCookie)
      .send({ reason: "Forbidden escalation test" })
      .expect(403);
  });

  test("blocked moderated media cannot be fetched from the public media endpoint", async () => {
    const tempFilePath = path.join(
      os.tmpdir(),
      `tengacion-blocked-media-${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`
    );
    const fileBuffer = Buffer.from("blocked media test bytes");
    await fs.writeFile(tempFilePath, fileBuffer);

    try {
      const uploaded = await saveUploadedMediaToGridFs({
        path: tempFilePath,
        originalname: "blocked-media.jpg",
        mimetype: "image/jpeg",
        size: fileBuffer.length,
      });

      const created = await createOrUpdateModerationCase({
        targetType: "post",
        targetId: new mongoose.Types.ObjectId().toString(),
        title: "explicit porn",
        media: [
          {
            mediaType: "image",
            sourceUrl: uploaded.url,
            previewUrl: uploaded.url,
            originalFilename: "blocked-media.jpg",
            mimeType: "image/jpeg",
            fileSizeBytes: fileBuffer.length,
          },
        ],
        uploader: {
          userId: regularUser._id,
          email: regularUser.email,
          username: regularUser.username,
          displayName: regularUser.name,
        },
        detectionSource: "automated_upload_scan",
      });

      expect(created.moderationDecision.status).toBe("BLOCK_EXPLICIT_ADULT");

      await request(app).get(uploaded.url).expect(404);
    } finally {
      await fs.unlink(tempFilePath).catch(() => null);
    }
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
