const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { v2: cloudinary } = require("cloudinary");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";

const app = require("../app");
const User = require("../models/User");

const loginUser = async (email, password) => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);

  return String(response.body?.token || "");
};

describe("user media uploads", () => {
  let mongod;
  let user;
  let token;

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
    user = await User.create({
      name: "Uploader User",
      username: "uploader_user",
      email: "uploader@test.com",
      password: "Password123!",
    });
    token = await loginUser("uploader@test.com", "Password123!");
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  test("replacing a cloudinary avatar removes the previous asset", async () => {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          avatar: {
            publicId: "tengacion/profiles/existing-avatar",
            public_id: "tengacion/profiles/existing-avatar",
            url: "https://res.cloudinary.com/test-cloud/image/upload/v1/tengacion/profiles/existing-avatar.jpg",
            secureUrl:
              "https://res.cloudinary.com/test-cloud/image/upload/v1/tengacion/profiles/existing-avatar.jpg",
            secure_url:
              "https://res.cloudinary.com/test-cloud/image/upload/v1/tengacion/profiles/existing-avatar.jpg",
            resourceType: "image",
            resource_type: "image",
            provider: "cloudinary",
            folder: "tengacion/profiles",
          },
        },
      }
    );

    const response = await request(app)
      .post("/api/users/me/avatar")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", Buffer.from("avatar-image"), {
        filename: "avatar.jpg",
        contentType: "image/jpeg",
      })
      .expect(200);

    expect(response.body.media).toMatchObject({
      provider: "cloudinary",
      publicId: "tengacion/profiles/mock-1",
    });
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      "tengacion/profiles/existing-avatar",
      expect.objectContaining({
        resource_type: "image",
        invalidate: true,
      })
    );
  });

  test("replacing a legacy local avatar succeeds without cloudinary deletion", async () => {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          avatar: {
            url: "/uploads/legacy/avatar.jpg",
            secureUrl: "/uploads/legacy/avatar.jpg",
            legacyPath: "/uploads/legacy/avatar.jpg",
          },
        },
      }
    );

    const response = await request(app)
      .post("/api/users/me/avatar")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", Buffer.from("avatar-image"), {
        filename: "avatar.jpg",
        contentType: "image/jpeg",
      })
      .expect(200);

    expect(response.body.media).toMatchObject({
      provider: "cloudinary",
      publicId: "tengacion/profiles/mock-1",
    });
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });
});
