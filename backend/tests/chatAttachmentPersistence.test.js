const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

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

    expect(imageUpload.body.url).toMatch(/^\/api\/media\//);
    expect(voiceUpload.body.url).toMatch(/^\/api\/media\//);
    expect(imageUpload.body.type).toBe("image");
    expect(voiceUpload.body.type).toBe("audio");

    const imageMediaId = imageUpload.body.url.split("/").pop();
    const voiceMediaId = voiceUpload.body.url.split("/").pop();

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
            type: "audio",
            name: voiceUpload.body.name,
            size: voiceUpload.body.size,
            durationSeconds: 3,
          },
        ],
        clientId: "messenger-voice-persist",
      })
      .expect(201);

    const imageFileDoc = await mongoose.connection.db
      .collection("uploads.files")
      .findOne({ _id: new mongoose.Types.ObjectId(imageMediaId) });
    const voiceFileDoc = await mongoose.connection.db
      .collection("uploads.files")
      .findOne({ _id: new mongoose.Types.ObjectId(voiceMediaId) });

    expect(imageFileDoc).toBeTruthy();
    expect(voiceFileDoc).toBeTruthy();

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
      type: "image",
      name: "persist.jpg",
    });
    expect(loadedVoice.attachments[0]).toMatchObject({
      url: voiceUpload.body.url,
      type: "audio",
      name: "voice-note.webm",
      durationSeconds: 3,
    });

    await request(app).get(imageUpload.body.url).expect(200);
    await request(app).get(voiceUpload.body.url).expect(200);
  });
});
