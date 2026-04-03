const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { v2: cloudinary } = require("cloudinary");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";

const app = require("../app");
const User = require("../models/User");
const Message = require("../models/Message");

const loginUser = async (email, password) => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);

  return String(response.body?.token || "");
};

describe("Messenger attachment persistence", () => {
  let mongod;
  let userA;
  let userB;
  let tokenA;

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

    userA = await User.create({
      name: "User A",
      username: "user_a",
      email: "usera@test.com",
      password: "Password123!",
    });
    userB = await User.create({
      name: "User B",
      username: "user_b",
      email: "userb@test.com",
      password: "Password123!",
    });

    tokenA = await loginUser("usera@test.com", "Password123!");
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  test("keeps Messenger image and voice attachments after logout and re-login", async () => {
    const imageUpload = await request(app)
      .post("/api/messages/upload")
      .set("Authorization", `Bearer ${tokenA}`)
      .attach("file", Buffer.from("image-binary"), {
        filename: "persist.jpg",
        contentType: "image/jpeg",
      })
      .expect(200);

    const voiceUpload = await request(app)
      .post("/api/messages/upload")
      .set("Authorization", `Bearer ${tokenA}`)
      .attach("file", Buffer.from("voice-binary"), {
        filename: "voice-note.webm",
        contentType: "audio/webm",
      })
      .expect(200);

    expect(imageUpload.body.url).toMatch(/^https:\/\/res\.cloudinary\.com\/test-cloud\/image\/upload\//);
    expect(voiceUpload.body.url).toMatch(/^https:\/\/res\.cloudinary\.com\/test-cloud\/video\/upload\//);
    expect(imageUpload.body.type).toBe("image");
    expect(voiceUpload.body.type).toBe("audio");
    expect(imageUpload.body.provider).toBe("cloudinary");
    expect(voiceUpload.body.provider).toBe("cloudinary");
    expect(imageUpload.body.publicId).toBe("tengacion/messages/images/mock-1");
    expect(voiceUpload.body.publicId).toBe("tengacion/messages/audio/mock-2");
    expect(voiceUpload.body.resourceType).toBe("video");

    await request(app)
      .post("/api/chat/messages")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        receiverId: userB._id.toString(),
        type: "text",
        text: "",
        attachments: [
          {
            url: imageUpload.body.url,
            secureUrl: imageUpload.body.secureUrl,
            publicId: imageUpload.body.publicId,
            resourceType: imageUpload.body.resourceType,
            provider: imageUpload.body.provider,
            type: "image",
            name: imageUpload.body.name,
            size: imageUpload.body.size,
          },
        ],
        clientId: "messenger-image-persist",
      })
      .expect(201);

    await request(app)
      .post("/api/chat/messages")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        receiverId: userB._id.toString(),
        type: "voice",
        text: "",
        attachments: [
          {
            url: voiceUpload.body.url,
            secureUrl: voiceUpload.body.secureUrl,
            publicId: voiceUpload.body.publicId,
            resourceType: voiceUpload.body.resourceType,
            provider: voiceUpload.body.provider,
            type: "audio",
            name: voiceUpload.body.name,
            size: voiceUpload.body.size,
            durationSeconds: 3,
          },
        ],
        clientId: "messenger-voice-persist",
      })
      .expect(201);

    const storedMessages = (await Message.find({ senderId: userA._id }).sort({ createdAt: 1 }).lean()).filter(
      (entry) => Array.isArray(entry.attachments) && entry.attachments.length > 0
    );
    expect(storedMessages).toHaveLength(2);
    expect(storedMessages[0].attachments[0]).toMatchObject({
      url: imageUpload.body.url,
      publicId: imageUpload.body.publicId,
      provider: "cloudinary",
      resourceType: "image",
    });
    expect(storedMessages[1].attachments[0]).toMatchObject({
      url: voiceUpload.body.url,
      publicId: voiceUpload.body.publicId,
      provider: "cloudinary",
      resourceType: "video",
    });

    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    tokenA = await loginUser("usera@test.com", "Password123!");

    const loaded = await request(app)
      .get(`/api/messages/${userB._id.toString()}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    const loadedImage = loaded.body.find(
      (entry) => Array.isArray(entry.attachments) && entry.attachments.some((file) => file.url === imageUpload.body.url)
    );
    const loadedVoice = loaded.body.find(
      (entry) => Array.isArray(entry.attachments) && entry.attachments.some((file) => file.url === voiceUpload.body.url)
    );

    expect(loadedImage).toBeTruthy();
    expect(loadedVoice).toBeTruthy();
    expect(loadedImage.attachments[0]).toMatchObject({
      url: imageUpload.body.url,
      publicId: imageUpload.body.publicId,
      provider: "cloudinary",
      type: "image",
      name: "persist.jpg",
    });
    expect(loadedVoice.attachments[0]).toMatchObject({
      url: voiceUpload.body.url,
      publicId: voiceUpload.body.publicId,
      provider: "cloudinary",
      resourceType: "video",
      type: "audio",
      name: "voice-note.webm",
      durationSeconds: 3,
    });
  });

  test("unsending a cloudinary-backed attachment deletes the stored asset", async () => {
    const imageUpload = await request(app)
      .post("/api/messages/upload")
      .set("Authorization", `Bearer ${tokenA}`)
      .attach("file", Buffer.from("image-binary"), {
        filename: "unsend.jpg",
        contentType: "image/jpeg",
      })
      .expect(200);

    const message = await request(app)
      .post("/api/chat/messages")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        receiverId: userB._id.toString(),
        type: "text",
        text: "unsend me",
        attachments: [
          {
            url: imageUpload.body.url,
            secureUrl: imageUpload.body.secureUrl,
            publicId: imageUpload.body.publicId,
            resourceType: imageUpload.body.resourceType,
            provider: imageUpload.body.provider,
            type: "image",
            name: imageUpload.body.name,
            size: imageUpload.body.size,
          },
        ],
        clientId: "messenger-image-unsend",
      })
      .expect(201);

    cloudinary.uploader.destroy.mockClear();

    await request(app)
      .patch(`/api/messages/${message.body._id}/unsend`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(await Message.findById(message.body._id).lean()).toBeNull();
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      imageUpload.body.publicId,
      expect.objectContaining({
        resource_type: "image",
        invalidate: true,
      })
    );
  });

  test("unsending a legacy attachment without public id does not crash cleanup", async () => {
    const message = await request(app)
      .post("/api/chat/messages")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        receiverId: userB._id.toString(),
        type: "text",
        text: "legacy attachment",
        attachments: [
          {
            url: "/uploads/chat/legacy-audio.mp3",
            legacyPath: "/uploads/chat/legacy-audio.mp3",
            type: "audio",
            name: "legacy-audio.mp3",
            size: 120,
          },
        ],
        clientId: "messenger-legacy-unsend",
      })
      .expect(201);

    await request(app)
      .patch(`/api/messages/${message.body._id}/unsend`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(await Message.findById(message.body._id).lean()).toBeNull();
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });
});
