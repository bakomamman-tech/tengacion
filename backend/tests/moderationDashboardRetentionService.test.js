process.env.NODE_ENV = "test";

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const ModerationCase = require("../models/ModerationCase");
const Post = require("../models/Post");
const {
  purgeExpiredModerationDashboardRecords,
} = require("../services/moderationDashboardRetentionService");

let mongod;

const makeCase = (overrides = {}) => {
  const targetId = overrides.targetId || new mongoose.Types.ObjectId().toString();
  return ModerationCase.create({
    queue: "upload_moderation",
    targetType: "post",
    targetId,
    status: "approved",
    workflowState: "RESOLVED",
    subject: {
      targetType: "post",
      targetId,
      title: "Moderation retention test",
    },
    ...overrides,
  });
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  await Promise.all([ModerationCase.deleteMany({}), Post.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("moderation dashboard retention", () => {
  test("deletes resolved approved and rejected records after one hour only", async () => {
    const now = new Date("2026-07-19T12:00:00.000Z");
    const authorId = new mongoose.Types.ObjectId();
    const post = await Post.create({
      author: authorId,
      text: "Published content remains available",
      moderationStatus: "approved",
    });
    const oldApproved = await makeCase({ targetId: post._id.toString() });
    const oldRejected = await makeCase({ status: "rejected" });
    const recentApproved = await makeCase();
    const unresolvedEscalation = await makeCase({
      status: "BLOCK_SUSPECTED_CHILD_EXPLOITATION",
      workflowState: "ESCALATED",
      queue: "suspected_child_exploitation",
      labels: ["suspected_child_exploitation"],
    });
    post.moderationCaseId = oldApproved._id;
    await post.save();

    const oldDate = new Date(now.getTime() - 61 * 60 * 1000);
    const recentDate = new Date(now.getTime() - 30 * 60 * 1000);
    await ModerationCase.collection.updateMany(
      { _id: { $in: [oldApproved._id, oldRejected._id, unresolvedEscalation._id] } },
      { $set: { reviewedAt: oldDate, updatedAt: oldDate } }
    );
    await ModerationCase.collection.updateOne(
      { _id: recentApproved._id },
      { $set: { reviewedAt: recentDate, updatedAt: recentDate } }
    );

    await expect(purgeExpiredModerationDashboardRecords({
      now,
      logger: { log: jest.fn() },
    })).resolves.toMatchObject({ deletedCount: 2, clearedReferences: 1 });

    expect(await ModerationCase.findById(oldApproved._id)).toBeNull();
    expect(await ModerationCase.findById(oldRejected._id)).toBeNull();
    expect(await ModerationCase.findById(recentApproved._id)).toBeTruthy();
    expect(await ModerationCase.findById(unresolvedEscalation._id)).toBeTruthy();
    expect((await Post.findById(post._id).lean()).moderationCaseId).toBeNull();
  });
});
