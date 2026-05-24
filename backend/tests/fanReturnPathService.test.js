const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";

const app = require("../app");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const LiveReminder = require("../models/LiveReminder");
const LiveSession = require("../models/LiveSession");
const Notification = require("../models/Notification");
const Purchase = require("../models/Purchase");
const SavedCreatorContent = require("../models/SavedCreatorContent");
const Track = require("../models/Track");
const User = require("../models/User");
const {
  notifyCreatorPublishedPaidContent,
  notifyCreatorWentLive,
  notifyPurchaseUnlocked,
  notifySavedContentUpdated,
  notifySubscriptionRenewalFailed,
  notifySubscriptionRenewalUpcoming,
} = require("../services/fanReturnPathService");

let mongod;

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

const createUser = ({
  name = "Fan Example",
  username = "fan_example",
  email = "fan@example.com",
  role = "user",
  isArtist = false,
} = {}) =>
  User.create({
    name,
    username,
    email,
    password: "Password123!",
    role,
    isArtist,
    isVerified: true,
  });

const createCreator = async () => {
  const user = await createUser({
    name: "Creator Example",
    username: "creator_example",
    email: "creator@example.com",
    role: "artist",
    isArtist: true,
  });
  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName: "Creator Example",
    fullName: "Creator Example",
    phoneNumber: "08000000000",
    accountNumber: "1234567890",
    country: "Nigeria",
    countryOfResidence: "Nigeria",
    creatorTypes: ["music", "bookPublishing"],
    acceptedTerms: true,
    acceptedCopyrightDeclaration: true,
    onboardingCompleted: true,
    onboardingComplete: true,
    status: "active",
  });
  return { user, profile };
};

describe("fan return path primitives", () => {
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

  test("tracks follow, save, and continue progress as fan return signals", async () => {
    const { user: creatorUser, profile } = await createCreator();
    const fan = await createUser();
    const token = await issueSessionToken(fan._id);
    const track = await Track.create({
      creatorId: profile._id,
      title: "Return Path Single",
      description: "A paid track with enough metadata for saving.",
      price: 1500,
      audioUrl: "https://cdn.test/return-path.mp3",
      previewUrl: "https://cdn.test/return-path-preview.mp3",
      coverImageUrl: "https://cdn.test/return-path.jpg",
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      durationSec: 180,
      publishedStatus: "published",
      isPublished: true,
    });
    const book = await Book.create({
      creatorId: profile._id,
      title: "Return Path Book",
      description: "A paid book with resume-ready progress.",
      price: 1200,
      contentUrl: "https://cdn.test/book.pdf",
      previewUrl: "https://cdn.test/book-preview.pdf",
      coverImageUrl: "https://cdn.test/book.jpg",
      fileFormat: "pdf",
      pageCount: 120,
      publishedStatus: "published",
      isPublished: true,
    });

    const followResponse = await request(app)
      .put(`/api/creators/${profile._id}/follow`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(followResponse.body.following).toBe(true);
    expect(await AnalyticsEvent.countDocuments({ type: "creator_followed" })).toBe(1);
    expect(await Notification.countDocuments({
      recipient: creatorUser._id,
      sender: fan._id,
      type: "follow",
    })).toBe(1);

    const saveResponse = await request(app)
      .post("/api/library/save")
      .set("Authorization", `Bearer ${token}`)
      .send({ itemType: "track", itemId: track._id.toString() })
      .expect(201);

    expect(saveResponse.body.item).toMatchObject({
      itemType: "track",
      title: "Return Path Single",
      route: `/tracks/${track._id}`,
    });
    expect(await SavedCreatorContent.countDocuments({ userId: fan._id })).toBe(1);
    expect(await AnalyticsEvent.countDocuments({ type: "content_saved" })).toBe(1);

    const savedListResponse = await request(app)
      .get("/api/library/saved")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(savedListResponse.body.items[0]).toMatchObject({
      title: "Return Path Single",
      itemType: "track",
    });

    await request(app)
      .post("/api/player/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({
        itemType: "song",
        itemId: track._id.toString(),
        positionSec: 42,
        durationSec: 180,
      })
      .expect(201);

    await request(app)
      .post("/api/player/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({
        itemType: "book",
        itemId: book._id.toString(),
        positionSec: 18,
        durationSec: 120,
      })
      .expect(201);

    expect(await AnalyticsEvent.countDocuments({ type: "continue_progress_saved" })).toBe(2);

    const continueResponse = await request(app)
      .get("/api/player/continue")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(continueResponse.body.some((item) => item.type === "book")).toBe(true);
    expect(continueResponse.body.some((item) => item.type === "song")).toBe(true);
  });

  test("sends bounded notifications for purchases, paid releases, saved updates, and live reminders", async () => {
    const { user: creatorUser, profile } = await createCreator();
    const fan = await createUser();
    const subscriber = await createUser({
      name: "Subscriber Example",
      username: "subscriber_example",
      email: "subscriber@example.com",
    });
    const fanToken = await issueSessionToken(fan._id);
    const track = await Track.create({
      creatorId: profile._id,
      title: "Paid Return Single",
      description: "A paid track for notification tests.",
      price: 2000,
      audioUrl: "https://cdn.test/paid-return.mp3",
      previewUrl: "https://cdn.test/paid-return-preview.mp3",
      coverImageUrl: "https://cdn.test/paid-return.jpg",
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
    });

    await request(app)
      .put(`/api/creators/${profile._id}/follow`)
      .set("Authorization", `Bearer ${fanToken}`)
      .expect(200);
    await request(app)
      .post("/api/library/save")
      .set("Authorization", `Bearer ${fanToken}`)
      .send({ itemType: "track", itemId: track._id.toString() })
      .expect(201);

    const purchase = await Purchase.create({
      userId: fan._id,
      creatorId: profile._id,
      itemType: "track",
      itemId: track._id,
      amount: 2000,
      currency: "NGN",
      status: "paid",
      provider: "paystack",
      providerRef: "fan_return_paid_track",
      paidAt: new Date(),
    });

    const unlockResult = await notifyPurchaseUnlocked({ purchase });
    expect(unlockResult.sent).toBe(true);
    expect(await AnalyticsEvent.countDocuments({ type: "paid_content_unlocked" })).toBe(1);

    const publishResult = await notifyCreatorPublishedPaidContent({
      creatorProfile: profile,
      itemType: "track",
      itemId: track._id,
      title: track.title,
      price: track.price,
    });
    expect(publishResult.sentCount).toBeGreaterThan(0);
    await notifyCreatorPublishedPaidContent({
      creatorProfile: profile,
      itemType: "track",
      itemId: track._id,
      title: track.title,
      price: track.price,
    });
    expect(await Notification.countDocuments({
      recipient: fan._id,
      type: "system",
      "metadata.eventType": "creator_published_paid_content",
    })).toBe(1);

    const savedUpdateResult = await notifySavedContentUpdated({
      creatorProfile: profile,
      itemType: "track",
      itemId: track._id,
      title: track.title,
      reason: "metadata_updated",
    });
    expect(savedUpdateResult.sentCount).toBeGreaterThan(0);
    expect(await Notification.countDocuments({
      recipient: fan._id,
      type: "system",
      "metadata.eventType": "saved_content_updated",
    })).toBe(1);

    const activeSubscription = await Purchase.create({
      userId: subscriber._id,
      creatorId: profile._id,
      itemType: "subscription",
      itemId: profile._id,
      amount: 2500,
      currency: "NGN",
      status: "paid",
      provider: "paystack",
      providerRef: "fan_return_subscription",
      billingInterval: "monthly",
      accessExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paidAt: new Date(),
    });

    const renewalUpcomingResult = await notifySubscriptionRenewalUpcoming({
      purchase: activeSubscription,
      daysUntilRenewal: 3,
    });
    expect(renewalUpcomingResult.sent).toBe(true);
    expect(await Notification.countDocuments({
      recipient: subscriber._id,
      "metadata.eventType": "subscription_renewal_upcoming",
    })).toBe(1);
    expect(await AnalyticsEvent.countDocuments({
      type: "subscription_renewal_upcoming_notification_sent",
    })).toBe(1);

    const failedSubscription = await Purchase.create({
      userId: subscriber._id,
      creatorId: profile._id,
      itemType: "subscription",
      itemId: profile._id,
      amount: 2500,
      currency: "NGN",
      status: "failed",
      provider: "paystack",
      providerRef: "fan_return_subscription_failed",
      billingInterval: "monthly",
      accessExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    });
    const renewalFailedResult = await notifySubscriptionRenewalFailed({
      purchase: failedSubscription,
      reason: "provider_declined",
    });
    expect(renewalFailedResult.sent).toBe(true);
    expect(await Notification.countDocuments({
      recipient: subscriber._id,
      "metadata.eventType": "subscription_renewal_failed",
    })).toBe(1);
    expect(await AnalyticsEvent.countDocuments({
      type: "subscription_renewal_failed_notification_sent",
    })).toBe(1);

    const reminderResponse = await request(app)
      .post("/api/live/reminders")
      .set("Authorization", `Bearer ${fanToken}`)
      .send({ creatorId: profile._id.toString() })
      .expect(201);

    expect(reminderResponse.body.reminder).toMatchObject({
      creatorId: profile._id.toString(),
      status: "active",
    });
    expect(await AnalyticsEvent.countDocuments({ type: "live_reminder_set" })).toBe(1);

    const session = await LiveSession.create({
      hostUserId: creatorUser._id,
      hostName: creatorUser.name,
      hostUsername: creatorUser.username,
      roomName: "live-return-path-room",
      title: "Return Path Live",
      status: "active",
      startedAt: new Date(),
    });

    const liveResult = await notifyCreatorWentLive({ session });
    expect(liveResult.sentCount).toBe(2);
    expect(await LiveReminder.countDocuments({ status: "notified" })).toBe(1);
    expect(await Notification.countDocuments({
      recipient: fan._id,
      "metadata.eventType": "live_reminder_ready",
    })).toBe(1);
    expect(await Notification.countDocuments({
      recipient: subscriber._id,
      "metadata.eventType": "subscribed_creator_went_live",
    })).toBe(1);
  });
});
