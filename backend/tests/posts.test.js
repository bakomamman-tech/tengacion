const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const { v2: cloudinary } = require("cloudinary");

process.env.NODE_ENV = "test";
require("../../apps/api/config/env");

const postsRoutes = require("../../apps/api/routes/posts");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const User = require("../models/User");
const Post = require("../models/Post");
const {
  createUploadModerationCase,
} = require("../services/uploadModerationService");
const {
  classifyRecordMedia,
  LEGACY_MEDIA_SOURCES,
} = require("../services/mediaAuditService");

let mongod;
let app;
let authToken;
let artist;
const postSource = LEGACY_MEDIA_SOURCES.find((entry) => entry.key === "Post");

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

  test("POST /api/posts uploads an image to Cloudinary and stores metadata", async () => {
    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authToken}`)
      .field("text", "Family picnic at the beach")
      .attach("image", Buffer.from("image-bytes"), {
        filename: "family-pic.png",
        contentType: "image/png",
      })
      .expect(201);

    expect(response.body.type).toBe("image");
    expect(response.body.image).toContain("https://res.cloudinary.com/test-cloud/image/upload/");

    const stored = await Post.findById(response.body._id).lean();
    expect(stored).toBeTruthy();
    expect(stored.media).toHaveLength(1);
    expect(stored.media[0]).toMatchObject({
      assetId: "asset-1",
      publicId: "tengacion/posts/images/mock-1",
      secureUrl: expect.stringContaining(
        "https://res.cloudinary.com/test-cloud/image/upload/"
      ),
      resourceType: "image",
      originalFilename: "family-pic.png",
      folder: "tengacion/posts/images",
      type: "image",
      legacyPath: "",
    });
    expect(String(stored.media[0].url || "")).not.toContain("/uploads/");
    expect(classifyRecordMedia(stored, postSource).status).toBe("cloudinary");

    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: "tengacion/posts/images",
        resource_type: "image",
      }),
      expect.any(Function)
    );
  });

  test("POST /api/posts rejects unsupported upload types", async () => {
    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authToken}`)
      .field("text", "Unsupported upload")
      .attach("file", Buffer.from("not-allowed"), {
        filename: "payload.exe",
        contentType: "application/x-msdownload",
      })
      .expect(400);

    expect(response.body.message).toMatch(/Unsupported file type/i);
    expect(await Post.countDocuments()).toBe(0);
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });

  test("POST /api/posts rejects oversized image uploads", async () => {
    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authToken}`)
      .field("text", "Oversized photo")
      .attach("image", Buffer.alloc(10 * 1024 * 1024 + 1, 1), {
        filename: "too-large.png",
        contentType: "image/png",
      })
      .expect(413);

    expect(response.body.message).toMatch(/10MB or smaller/i);
    expect(await Post.countDocuments()).toBe(0);
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
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

  test("POST /api/posts/:id/like persists emoji reactions and returns viewerReaction", async () => {
    const post = await Post.create({
      author: artist._id,
      text: "Reaction test post",
      privacy: "public",
    });

    const reacted = await request(app)
      .post(`/api/posts/${post._id}/like`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ reactionKey: "love" })
      .expect(200);

    expect(reacted.body).toMatchObject({
      success: true,
      liked: true,
      likedByViewer: true,
      likesCount: 1,
      viewerReaction: "love",
    });

    const stored = await Post.findById(post._id).lean();
    expect(stored).toBeTruthy();
    expect(stored.likes).toHaveLength(1);
    expect(stored.reactions).toHaveLength(1);
    expect(stored.reactions[0]).toMatchObject({
      emoji: "\u{2764}\u{FE0F}",
    });

    const unreacted = await request(app)
      .post(`/api/posts/${post._id}/like`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ reactionKey: "" })
      .expect(200);

    expect(unreacted.body).toMatchObject({
      success: true,
      liked: false,
      likedByViewer: false,
      likesCount: 0,
      viewerReaction: "",
    });

    const refetched = await request(app).get(`/api/posts/${post._id}`).expect(200);
    expect(refetched.body).toMatchObject({
      likedByViewer: false,
      viewerReaction: "",
      likesCount: 0,
    });
  });

  test("POST /api/posts uploads a video to Cloudinary and stores metadata", async () => {
    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authToken}`)
      .field("text", "Road trip highlights")
      .attach("file", Buffer.from("video-bytes"), {
        filename: "road-trip.mp4",
        contentType: "video/mp4",
      })
      .expect(201);

    expect(response.body.type).toBe("video");
    expect(response.body.video).toMatchObject({
      url: expect.stringContaining("https://res.cloudinary.com/test-cloud/video/upload/"),
      playbackUrl: expect.stringContaining(
        "https://res.cloudinary.com/test-cloud/video/upload/"
      ),
    });

    const stored = await Post.findById(response.body._id).lean();
    expect(stored).toBeTruthy();
    expect(stored.media).toHaveLength(1);
    expect(stored.media[0]).toMatchObject({
      assetId: "asset-1",
      publicId: "tengacion/posts/videos/mock-1",
      secureUrl: expect.stringContaining(
        "https://res.cloudinary.com/test-cloud/video/upload/"
      ),
      resourceType: "video",
      originalFilename: "road-trip.mp4",
      folder: "tengacion/posts/videos",
      type: "video",
      legacyPath: "",
    });
    expect(stored.video).toMatchObject({
      assetId: "asset-1",
      publicId: "tengacion/posts/videos/mock-1",
      secureUrl: expect.stringContaining(
        "https://res.cloudinary.com/test-cloud/video/upload/"
      ),
      playbackUrl: expect.stringContaining(
        "https://res.cloudinary.com/test-cloud/video/upload/"
      ),
      resourceType: "video",
      mimeType: "video/mp4",
      originalFilename: "road-trip.mp4",
      folder: "tengacion/posts/videos",
      legacyPath: "",
    });
    expect(String(stored.video.url || "")).not.toContain("/uploads/");
    expect(classifyRecordMedia(stored, postSource).status).toBe("cloudinary");

    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: "tengacion/posts/videos",
        resource_type: "video",
      }),
      expect.any(Function)
    );
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

  test("GET /api/posts normalizes secureUrl-only media entries for legacy records", async () => {
    await Post.create({
      author: artist._id,
      text: "Legacy secure url image",
      media: [{ secureUrl: "https://cdn.test/media/legacy-photo.jpg", type: "image" }],
      privacy: "public",
    });

    const response = await request(app).get("/api/posts").expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      text: "Legacy secure url image",
      type: "image",
      image: "https://cdn.test/media/legacy-photo.jpg",
    });
    expect(response.body[0].media[0]).toMatchObject({
      url: "https://cdn.test/media/legacy-photo.jpg",
      secureUrl: "https://cdn.test/media/legacy-photo.jpg",
      type: "image",
    });
  });

  test("GET /api/posts keeps approved upload-moderation posts non-sensitive", async () => {
    const post = await Post.create({
      author: artist._id,
      text: "Approved upload should stay visible on mobile",
      media: [{ url: "https://cdn.test/media/approved-photo.jpg", type: "image" }],
      type: "image",
      privacy: "public",
      visibility: "public",
      sensitiveContent: false,
      sensitiveType: "",
      moderationStatus: "approved",
    });

    await createUploadModerationCase({
      targetType: "post",
      targetId: post._id.toString(),
      uploader: {
        userId: artist._id,
        email: artist.email,
        username: artist.username,
        displayName: artist.name,
      },
      fileUrl: "https://cdn.test/media/approved-photo.jpg",
      mimeType: "image/jpeg",
      labels: [],
      reason: "",
      confidence: 0.12,
      status: "approved",
      visibility: "public",
      storageStage: "permanent",
      subject: {
        title: post.text,
        description: post.text,
        mediaType: "image",
        createdAt: post.createdAt,
      },
      media: [
        {
          role: "primary",
          mediaType: "image",
          mimeType: "image/jpeg",
          sourceUrl: "https://cdn.test/media/approved-photo.jpg",
          previewUrl: "https://cdn.test/media/approved-photo.jpg",
          originalFilename: "approved-photo.jpg",
          fileSizeBytes: 1024,
        },
      ],
    });

    const response = await request(app).get("/api/posts").expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      _id: post._id.toString(),
      moderationStatus: "approved",
      sensitiveContent: false,
      sensitiveType: "",
      image: "https://cdn.test/media/approved-photo.jpg",
    });
  });

  test("GET /api/posts/:id hides posts with pending upload-moderation cases", async () => {
    const post = await Post.create({
      author: artist._id,
      text: "Pending upload should not be public",
      media: [{ url: "https://cdn.test/media/pending-photo.jpg", type: "image" }],
      type: "image",
      privacy: "public",
      visibility: "public",
    });

    await createUploadModerationCase({
      targetType: "post",
      targetId: post._id.toString(),
      uploader: {
        userId: artist._id,
        email: artist.email,
        username: artist.username,
        displayName: artist.name,
      },
      fileUrl: "https://cdn.test/media/pending-photo.jpg",
      mimeType: "image/jpeg",
      labels: ["manual_review"],
      reason: "Awaiting review",
      confidence: 0.67,
      status: "pending",
      visibility: "blocked",
      storageStage: "quarantine",
      subject: {
        title: post.text,
        description: post.text,
        mediaType: "image",
        createdAt: post.createdAt,
      },
      media: [
        {
          role: "primary",
          mediaType: "image",
          mimeType: "image/jpeg",
          sourceUrl: "https://cdn.test/media/pending-photo.jpg",
          previewUrl: "https://cdn.test/media/pending-photo.jpg",
          originalFilename: "pending-photo.jpg",
          fileSizeBytes: 1024,
        },
      ],
    });

    await request(app).get(`/api/posts/${post._id}`).expect(404);
  });

  test("DELETE /api/posts removes cloudinary-backed media after the record is deleted", async () => {
    const post = await Post.create({
      author: artist._id,
      text: "delete me",
      media: [
        {
          publicId: "tengacion/posts/images/delete-me",
          public_id: "tengacion/posts/images/delete-me",
          url: "https://res.cloudinary.com/test-cloud/image/upload/v1/tengacion/posts/images/delete-me.jpg",
          secureUrl:
            "https://res.cloudinary.com/test-cloud/image/upload/v1/tengacion/posts/images/delete-me.jpg",
          secure_url:
            "https://res.cloudinary.com/test-cloud/image/upload/v1/tengacion/posts/images/delete-me.jpg",
          resourceType: "image",
          resource_type: "image",
          provider: "cloudinary",
          type: "image",
        },
      ],
      type: "image",
      privacy: "public",
    });

    await request(app)
      .delete(`/api/posts/${post._id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(await Post.findById(post._id).lean()).toBeNull();
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      "tengacion/posts/images/delete-me",
      expect.objectContaining({
        resource_type: "image",
        invalidate: true,
      })
    );
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
