process.env.NODE_ENV = "test";

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const ModerationCase = require("../models/ModerationCase");
const Book = require("../models/Book");
const Message = require("../models/Message");
const Post = require("../models/Post");
const Story = require("../models/Story");
const {
  hasProhibitedPublicationSignal,
  releaseSafePublicationHolds,
} = require("../services/moderationPublicationService");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  await Promise.all([
    ModerationCase.deleteMany({}),
    Book.deleteMany({}),
    Message.deleteMany({}),
    Post.deleteMany({}),
    Story.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("safe moderation hold release", () => {
  test("recognizes only the prohibited publication categories", () => {
    expect(hasProhibitedPublicationSignal({ status: "HOLD_FOR_REVIEW", labels: ["spam"] })).toBe(false);
    expect(hasProhibitedPublicationSignal({ status: "quarantined", labels: ["graphic_gore"] })).toBe(true);
    expect(hasProhibitedPublicationSignal({ status: "BLOCK_ANIMAL_CRUELTY" })).toBe(true);
  });

  test("publishes safe held social and creator content without releasing prohibited content", async () => {
    const authorId = new mongoose.Types.ObjectId();
    const safePost = await Post.create({
      author: authorId,
      text: "Safe post waiting for review",
      moderationStatus: "HOLD_FOR_REVIEW",
      reviewRequired: true,
      visibility: "private",
      originalVisibility: "public",
      privacy: "public",
      storageStage: "quarantine",
    });
    const rejectedWithoutCategory = await Post.create({
      author: authorId,
      text: "Safe generic rejection",
      moderationStatus: "rejected",
      reviewRequired: true,
    });
    const prohibitedPost = await Post.create({
      author: authorId,
      text: "Prohibited visual record",
      moderationStatus: "quarantined",
      moderationLabels: ["graphic_gore"],
      reviewRequired: true,
      visibility: "private",
    });
    const safeStory = await Story.create({
      userId: authorId.toString(),
      authorId,
      text: "Safe story waiting for review",
      moderationStatus: "pending",
      reviewRequired: true,
      visibility: "friends",
    });
    const safeBook = await Book.create({
      creatorId: new mongoose.Types.ObjectId(),
      title: "Safe book waiting for review",
      price: 0,
      publishedStatus: "under_review",
      reviewRequired: true,
      isPublished: false,
    });
    const safeMessage = await Message.create({
      conversationId: `${authorId}_${new mongoose.Types.ObjectId()}`,
      senderId: authorId,
      receiverId: new mongoose.Types.ObjectId(),
      text: "Safe attachment message",
      moderationStatus: "HOLD_FOR_REVIEW",
      reviewRequired: true,
    });
    const safeCase = await ModerationCase.create({
      queue: "user_reported_sensitive_content",
      targetType: "post",
      targetId: safePost._id.toString(),
      status: "HOLD_FOR_REVIEW",
      workflowState: "OPEN",
      labels: ["user_reported_sensitive_content"],
      subject: {
        targetType: "post",
        targetId: safePost._id.toString(),
        title: "Safe post waiting for review",
      },
    });

    const logger = { log: jest.fn() };
    await expect(releaseSafePublicationHolds({ logger })).resolves.toMatchObject({
      scannedPosts: 3,
      scannedStories: 1,
      releasedPosts: 2,
      releasedStories: 1,
      releasedBooks: 1,
      releasedMessages: 1,
      retainedProhibited: 1,
    });

    const [
      releasedPost,
      releasedRejectedPost,
      retainedPost,
      releasedStory,
      releasedBook,
      releasedMessage,
      resolvedCase,
    ] = await Promise.all([
      Post.findById(safePost._id).lean(),
      Post.findById(rejectedWithoutCategory._id).lean(),
      Post.findById(prohibitedPost._id).lean(),
      Story.findById(safeStory._id).lean(),
      Book.findById(safeBook._id).lean(),
      Message.findById(safeMessage._id).lean(),
      ModerationCase.findById(safeCase._id).lean(),
    ]);
    expect(releasedPost).toMatchObject({
      moderationStatus: "approved",
      reviewRequired: false,
      visibility: "public",
      storageStage: "permanent",
    });
    expect(releasedRejectedPost).toMatchObject({ moderationStatus: "approved", reviewRequired: false });
    expect(retainedPost).toMatchObject({ moderationStatus: "quarantined", reviewRequired: true });
    expect(releasedStory).toMatchObject({ moderationStatus: "approved", reviewRequired: false });
    expect(releasedBook).toMatchObject({
      moderationStatus: "approved",
      publishedStatus: "published",
      isPublished: true,
      reviewRequired: false,
    });
    expect(releasedMessage).toMatchObject({ moderationStatus: "approved", reviewRequired: false });
    expect(resolvedCase).toMatchObject({
      status: "approved",
      workflowState: "RESOLVED",
      visibilityDecision: "allowed",
    });
  });
});
