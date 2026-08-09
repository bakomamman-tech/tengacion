const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";

const app = require("../app");
const User = require("../models/User");
const Post = require("../models/Post");
const Message = require("../models/Message");
const Story = require("../models/Story");
const AuditLog = require("../models/AuditLog");
const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");

describe("self-service account controls", () => {
  let mongod;
  let user;
  let friend;
  let token;
  let gridFsId;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
    await mongoose.connect(mongod.getUri(), {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    });
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    user = await User.create({
      name: "Delete Me",
      username: "delete_me",
      email: "delete@example.com",
      password: "Password123!",
    });
    friend = await User.create({
      name: "Friend",
      username: "friend_user",
      email: "friend@example.com",
      password: "Password123!",
      friends: [user._id],
      followers: [user._id],
    });

    const uploadStream = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    }).openUploadStream("delete-me.txt", { contentType: "text/plain" });
    await new Promise((resolve, reject) => {
      uploadStream.once("finish", resolve);
      uploadStream.once("error", reject);
      uploadStream.end(Buffer.from("personal upload"));
    });
    gridFsId = uploadStream.id;
    user.avatar = {
      url: `/api/media/${gridFsId}`,
      public_id: String(gridFsId),
      resource_type: "raw",
    };
    await user.save();

    const login = await request(app).post("/api/auth/login").send({
      email: "delete@example.com",
      password: "Password123!",
    });
    token = login.body.token;

    await Promise.all([
      Post.create({ author: user._id, text: "Remove this post" }),
      Message.create({
        conversationId: [user._id, friend._id].map(String).sort().join(":"),
        senderId: user._id,
        receiverId: friend._id,
        text: "Remove this message",
      }),
      Story.create({
        userId: String(user._id),
        authorId: user._id,
        name: user.name,
        username: user.username,
        text: "Remove this story",
      }),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  test("requires an explicit confirmation and current password", async () => {
    await request(app)
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "Password123!", confirmation: "delete" })
      .expect(400);

    await request(app)
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "wrong-password", confirmation: "DELETE" })
      .expect(403)
      .expect("Cache-Control", "no-store");

    await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });

  test("exports a bounded portable snapshot without authentication secrets or others' replies", async () => {
    await request(app).post("/api/users/me/export").expect(401);

    await Promise.all([
      CreatorProfile.create({
        userId: user._id,
        displayName: "Export Creator",
        accountNumber: "0123456789",
        bankName: "Test Bank",
        payoutRecipientCode: "RCP_INTERNAL_SECRET",
      }),
      Purchase.create({
        userId: user._id,
        itemType: "track",
        itemId: new mongoose.Types.ObjectId(),
        amount: 1200,
        priceNGN: 1200,
        currency: "NGN",
        provider: "paystack",
        providerRef: "export-purchase-reference",
        status: "paid",
      }),
      Message.create({
        conversationId: [user._id, friend._id].map(String).sort().join(":"),
        senderId: friend._id,
        receiverId: user._id,
        text: "Incoming private message",
      }),
      User.updateOne(
        { _id: user._id },
        {
          $set: {
            "twoFactor.secretCipher": "TOTP_INTERNAL_SECRET",
            "twoFactor.pendingSecretCipher": "TOTP_PENDING_INTERNAL_SECRET",
          },
        }
      ),
    ]);

    const post = await Post.findOne({ author: user._id });
    post.likes.push(friend._id);
    post.comments.push({ author: friend._id, text: "Friend-only reply" });
    await post.save();

    await request(app)
      .post("/api/users/me/export")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "wrong-password" })
      .expect(403);

    const response = await request(app)
      .post("/api/users/me/export")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "Password123!" })
      .expect(200);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["content-disposition"]).toMatch(
      /^attachment; filename="tengacion-delete_me-account-data-\d{4}-\d{2}-\d{2}\.json"$/
    );
    expect(response.body).toMatchObject({
      schemaVersion: "1.0",
      manifest: {
        complete: true,
        sections: {
          posts: { exportedCount: 1, complete: true },
          stories: { exportedCount: 1, complete: true },
          sentMessages: { exportedCount: 1, complete: true },
          purchases: { exportedCount: 1, complete: true },
        },
      },
      data: {
        account: {
          profile: { email: "delete@example.com" },
        },
        creatorProfile: {
          displayName: "Export Creator",
          accountNumber: "0123456789",
        },
        posts: [{ text: "Remove this post" }],
        sentMessages: [{ text: "Remove this message" }],
        purchases: [{ providerRef: "export-purchase-reference" }],
      },
    });

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("Password123!");
    expect(serialized).not.toContain("RCP_INTERNAL_SECRET");
    expect(serialized).not.toContain("TOTP_INTERNAL_SECRET");
    expect(serialized).not.toContain("TOTP_PENDING_INTERNAL_SECRET");
    expect(serialized).not.toContain("Incoming private message");
    expect(serialized).not.toContain("Friend-only reply");
    expect(response.body.data.account.security.sessions[0]).not.toHaveProperty(
      "refreshTokenHash"
    );

    expect(
      await AuditLog.findOne({
        actorId: user._id,
        action: "account_data_exported",
      }).lean()
    ).toMatchObject({
      targetType: "User",
      targetId: String(user._id),
      metadata: { schemaVersion: "1.0", complete: true },
    });
  });

  test("deletes personal content, anonymizes the account, and revokes access", async () => {
    const response = await request(app)
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "Password123!", confirmation: "DELETE" })
      .expect(200);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toMatchObject({ success: true, deleted: true });

    const deletedUser = await User.findById(user._id).select("+password").lean();
    expect(deletedUser.isDeleted).toBe(true);
    expect(deletedUser.isActive).toBe(false);
    expect(deletedUser.name).toBe("Deleted user");
    expect(deletedUser.email).toMatch(/^deleted\+/);
    expect(deletedUser.password).toBeUndefined();
    expect(deletedUser.sessions).toHaveLength(0);

    expect(await Post.countDocuments({ author: user._id })).toBe(0);
    expect(await Message.countDocuments({ senderId: user._id })).toBe(0);
    expect(await Story.countDocuments({ authorId: user._id })).toBe(0);
    expect(await mongoose.connection.db.collection("uploads.files").countDocuments({ _id: gridFsId })).toBe(0);

    const updatedFriend = await User.findById(friend._id).lean();
    expect(updatedFriend.friends.map(String)).not.toContain(String(user._id));
    expect(updatedFriend.followers.map(String)).not.toContain(String(user._id));

    expect(
      await AuditLog.findOne({
        actorId: user._id,
        action: "account_deleted",
      }).lean()
    ).toMatchObject({
      targetType: "User",
      targetId: String(user._id),
      metadata: { retainedFinancialRecords: true },
    });

    await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });
});
