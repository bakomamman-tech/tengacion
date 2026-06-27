const User = require("../models/User");
const Post = require("../models/Post");
const Message = require("../models/Message");
const Story = require("../models/Story");
const Notification = require("../models/Notification");
const Room = require("../models/Room");
const RoomMessage = require("../models/RoomMessage");
const CreatorProfile = require("../models/CreatorProfile");
const ArtistProfile = require("../models/ArtistProfile");
const Track = require("../models/Track");
const Book = require("../models/Book");
const Chapter = require("../models/Chapter");
const Album = require("../models/Album");
const Video = require("../models/Video");
const MarketplaceSeller = require("../models/MarketplaceSeller");
const MarketplaceProduct = require("../models/MarketplaceProduct");
const MarketplaceOrder = require("../models/MarketplaceOrder");
const Purchase = require("../models/Purchase");
const WalletAccount = require("../models/WalletAccount");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const AssistantFeedback = require("../models/AssistantFeedback");
const AssistantMemory = require("../models/AssistantMemory");
const AssistantReviewItem = require("../models/AssistantReviewItem");
const AuthChallenge = require("../models/AuthChallenge");
const Entitlement = require("../models/Entitlement");
const LiveReminder = require("../models/LiveReminder");
const NewsComplaint = require("../models/NewsComplaint");
const NewsFeedImpression = require("../models/NewsFeedImpression");
const NewsUserPreference = require("../models/NewsUserPreference");
const PlayerProgress = require("../models/PlayerProgress");
const RechargeRafflePlay = require("../models/RechargeRafflePlay");
const RecommendationLog = require("../models/RecommendationLog");
const Report = require("../models/Report");
const SavedCreatorContent = require("../models/SavedCreatorContent");
const TalentShowApplication = require("../models/TalentShowApplication");
const UserAffinityProfile = require("../models/UserAffinityProfile");
const UserSavedNews = require("../models/UserSavedNews");
const AdminComplaint = require("../models/AdminComplaint");
const Otp = require("../models/Otp");
const SchoolInquiry = require("../models/SchoolInquiry");
const { deleteUploadedMediaBatch } = require("./mediaStore");

const toId = (value) => String(value?._id || value || "");

const collectMediaAssets = (value, assets, seen = new Set()) => {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);

  if (
    value.publicId ||
    value.public_id ||
    value.provider === "cloudinary" ||
    value.provider === "s3"
  ) {
    assets.push(value);
  }

  Object.values(value).forEach((entry) => {
    if (Array.isArray(entry)) {
      entry.forEach((item) => collectMediaAssets(item, assets, seen));
    } else if (entry && typeof entry === "object") {
      collectMediaAssets(entry, assets, seen);
    }
  });
};

const deletePersonalActivity = async ({ userId, email }) => {
  const directDeletes = [
    [AnalyticsEvent, { userId }],
    [AssistantFeedback, { userId }],
    [AssistantMemory, { userId }],
    [AssistantReviewItem, { userId }],
    [AuthChallenge, { userId }],
    [Entitlement, { userId }],
    [LiveReminder, { userId }],
    [NewsComplaint, { userId }],
    [NewsFeedImpression, { userId }],
    [NewsUserPreference, { userId }],
    [PlayerProgress, { userId }],
    [RechargeRafflePlay, { userId }],
    [RecommendationLog, { userId }],
    [Report, { reporterId: userId }],
    [SavedCreatorContent, { userId }],
    [UserAffinityProfile, { userId }],
    [UserSavedNews, { userId }],
    [AdminComplaint, { reporterId: userId }],
    [TalentShowApplication, { $or: [{ applicantUserId: userId }, { normalizedEmail: email }] }],
    [SchoolInquiry, { email }],
    [Otp, { email }],
  ];

  await Promise.all(directDeletes.map(([Model, filter]) => Model.deleteMany(filter)));
};

const removeUserFromSharedContent = async (userId) => {
  await Promise.all([
    User.updateMany(
      { _id: { $ne: userId } },
      {
        $pull: {
          friends: userId,
          friendRequests: userId,
          followers: userId,
          following: userId,
          blockedUsers: userId,
          blocks: userId,
          mutes: userId,
          restricts: userId,
          hiddenStoriesFrom: userId,
          closeFriends: userId,
        },
      }
    ),
    Post.updateMany(
      { author: { $ne: userId } },
      {
        $pull: {
          comments: { author: userId },
          reactions: { userId },
          mentions: userId,
          taggedUsers: { userId },
          "poll.votes": { userId },
          "quiz.answers": { userId },
        },
      }
    ),
    Post.updateMany(
      { "comments.replies.author": userId },
      { $pull: { "comments.$[].replies": { author: userId } } }
    ),
    Post.updateMany(
      { "comments.likes": userId },
      { $pull: { "comments.$[].likes": userId } }
    ),
    Post.updateMany(
      { "comments.reactions.userId": userId },
      { $pull: { "comments.$[].reactions": { userId } } }
    ),
    Story.updateMany(
      { authorId: { $ne: userId } },
      {
        $pull: {
          reactions: { userId },
          replies: { userId },
          seenBy: toId(userId),
        },
      }
    ),
    Room.updateMany(
      { ownerId: { $ne: userId } },
      { $pull: { admins: userId, members: userId } }
    ),
    RoomMessage.updateMany(
      { senderId: { $ne: userId } },
      { $pull: { reactions: { userId } } }
    ),
  ]);
};

const deleteCreatorContent = async ({ userId, creatorProfile, mediaAssets }) => {
  const creatorId = creatorProfile?._id || null;
  const [tracks, books, albums, videos] = await Promise.all([
    creatorId ? Track.find({ creatorId }).lean() : [],
    creatorId ? Book.find({ creatorId }).lean() : [],
    creatorId ? Album.find({ creatorId }).lean() : [],
    Video.find({ userId: toId(userId) }).lean(),
  ]);

  [...tracks, ...books, ...albums, ...videos].forEach((entry) =>
    collectMediaAssets(entry, mediaAssets)
  );

  await Promise.all([
    creatorId ? Track.deleteMany({ creatorId }) : null,
    creatorId ? Chapter.deleteMany({ bookId: { $in: books.map((book) => book._id) } }) : null,
    creatorId ? Book.deleteMany({ creatorId }) : null,
    creatorId ? Album.deleteMany({ creatorId }) : null,
    Video.deleteMany({ userId: toId(userId) }),
    ArtistProfile.deleteMany({ userId }),
  ]);

  if (creatorId) {
    await CreatorProfile.updateOne(
      { _id: creatorId },
      {
        $set: {
          displayName: "Deleted creator",
          fullName: "Deleted creator",
          phoneNumber: "",
          accountNumber: "",
          country: "",
          countryOfResidence: "",
          bio: "",
          coverImageUrl: "",
          heroBannerUrl: "",
          tagline: "",
          links: [],
          socialHandles: {},
          musicProfile: {},
          booksProfile: {},
          podcastsProfile: {},
          genres: [],
          status: "restricted",
        },
      }
    );
    await WalletAccount.updateMany(
      { ownerType: "creator", ownerId: creatorId },
      {
        $set: {
          label: "Deleted creator",
          status: "archived",
          settlementAccount: { accountName: "", bankName: "", accountNumber: "" },
        },
      }
    );
  }
};

const deleteMarketplaceProfile = async ({ userId, mediaAssets }) => {
  const seller = await MarketplaceSeller.findOne({ user: userId }).lean();
  if (!seller) {
    return;
  }

  collectMediaAssets(seller.cacCertificate, mediaAssets);
  const products = await MarketplaceProduct.find({ seller: seller._id }).lean();
  products.forEach((product) => collectMediaAssets(product, mediaAssets));

  await MarketplaceProduct.deleteMany({ seller: seller._id });
  await MarketplaceSeller.updateOne(
    { _id: seller._id },
    {
      $set: {
        fullName: "Deleted seller",
        storeName: "Deleted store",
        slug: `deleted-${toId(userId)}`,
        phoneNumber: "",
        bankName: "",
        accountNumber: "",
        accountName: "",
        residentialAddress: "",
        businessAddress: "",
        state: "",
        city: "",
        cacCertificate: {},
        status: "suspended",
        isActive: false,
      },
    }
  );
};

const anonymizeRetainedRecords = async (userId) => {
  const now = new Date();
  await Promise.all([
    MarketplaceOrder.updateMany(
      { buyer: userId },
      {
        $set: {
          deliveryAddress: "",
          deliveryContactPhone: "",
          fulfillmentNotes: "",
          paystackAccessCode: "",
        },
      },
    ),
    Purchase.updateMany(
      { userId, itemType: "subscription" },
      { $set: { cancelAtPeriodEnd: true, canceledAt: now } }
    ),
  ]);
};

const anonymizeUser = async (user) => {
  const userId = user._id;
  const stamp = `${toId(userId).slice(-8)}_${Date.now()}`;
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        name: "Deleted user",
        username: `deleted_${stamp}`,
        email: `deleted+${stamp}@tengacion.local`,
        phone: "",
        country: "",
        stateOfOrigin: "",
        dob: null,
        bio: "",
        currentCity: "",
        hometown: "",
        workplace: "",
        education: "",
        website: "",
        gender: "",
        pronouns: "",
        avatar: {},
        cover: {},
        status: { text: "", emoji: "", updatedAt: null },
        birthday: { day: 0, month: 0, year: 0, visibility: "private" },
        permissions: [],
        sessions: [],
        trustedDevices: [],
        followers: [],
        following: [],
        friends: [],
        friendRequests: [],
        blockedUsers: [],
        blocks: [],
        mutes: [],
        restricts: [],
        hiddenStoriesFrom: [],
        closeFriends: [],
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
        isBanned: false,
        isSuspended: false,
        banReason: "",
        suspensionReason: "",
        tokenVersion: (Number(user.tokenVersion) || 0) + 1,
      },
      $unset: {
        password: 1,
        emailVerifyTokenHash: 1,
        emailVerifyExpiresAt: 1,
        resetPasswordTokenHash: 1,
        resetPasswordExpiresAt: 1,
        "twoFactor.secretCipher": 1,
        "twoFactor.pendingSecretCipher": 1,
      },
    }
  );
};

const deleteAccount = async (user) => {
  const userId = user._id;
  const email = String(user.email || "").trim().toLowerCase();
  const mediaAssets = [];
  collectMediaAssets(user.avatar, mediaAssets);
  collectMediaAssets(user.cover, mediaAssets);

  const [posts, messages, stories, creatorProfile, ownedRooms] = await Promise.all([
    Post.find({ author: userId }).lean(),
    Message.find({ $or: [{ senderId: userId }, { receiverId: userId }] }).lean(),
    Story.find({ $or: [{ authorId: userId }, { userId: toId(userId) }] }).lean(),
    CreatorProfile.findOne({ userId }).lean(),
    Room.find({ ownerId: userId }).lean(),
  ]);
  [...posts, ...messages, ...stories, ...ownedRooms].forEach((entry) =>
    collectMediaAssets(entry, mediaAssets)
  );

  await Promise.all([
    Post.deleteMany({ author: userId }),
    Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] }),
    Story.deleteMany({ $or: [{ authorId: userId }, { userId: toId(userId) }] }),
    Notification.deleteMany({ $or: [{ recipient: userId }, { sender: userId }] }),
    RoomMessage.deleteMany({
      $or: [{ senderId: userId }, { roomId: { $in: ownedRooms.map((room) => room._id) } }],
    }),
    Room.deleteMany({ ownerId: userId }),
    deletePersonalActivity({ userId, email }),
    deleteCreatorContent({ userId, creatorProfile, mediaAssets }),
    deleteMarketplaceProfile({ userId, mediaAssets }),
    anonymizeRetainedRecords(userId),
  ]);

  await removeUserFromSharedContent(userId);
  await anonymizeUser(user);
  await deleteUploadedMediaBatch(mediaAssets);

  return { deleted: true, retainedFinancialRecords: true };
};

module.exports = { deleteAccount };
