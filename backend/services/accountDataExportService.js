const CreatorProfile = require("../models/CreatorProfile");
const Message = require("../models/Message");
const Post = require("../models/Post");
const Purchase = require("../models/Purchase");
const Story = require("../models/Story");
const User = require("../models/User");

const ACCOUNT_DATA_EXPORT_SCHEMA_VERSION = "1.0";
const ACCOUNT_DATA_EXPORT_RECORD_LIMIT = 5000;

class AccountDataExportError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "AccountDataExportError";
    this.statusCode = statusCode;
  }
}

const idList = (values = []) =>
  [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || ""))
      .filter(Boolean)
  )];

const safeSession = (session = {}) => ({
  sessionId: String(session.sessionId || ""),
  deviceName: String(session.deviceName || ""),
  ip: String(session.ip || ""),
  userAgent: String(session.userAgent || ""),
  country: String(session.country || ""),
  city: String(session.city || ""),
  createdAt: session.createdAt || null,
  lastSeenAt: session.lastSeenAt || null,
  revokedAt: session.revokedAt || null,
});

const safeTrustedDevice = (device = {}) => ({
  deviceName: String(device.deviceName || ""),
  userAgent: String(device.userAgent || ""),
  firstSeenAt: device.firstSeenAt || null,
  lastSeenAt: device.lastSeenAt || null,
  lastIp: String(device.lastIp || ""),
  lastCountry: String(device.lastCountry || ""),
});

const buildAccountSection = (user = {}) => ({
  id: String(user._id || ""),
  profile: {
    name: user.name || "",
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    country: user.country || "",
    stateOfOrigin: user.stateOfOrigin || "",
    dateOfBirth: user.dob || null,
    birthday: user.birthday || {},
    bio: user.bio || "",
    currentCity: user.currentCity || "",
    hometown: user.hometown || "",
    workplace: user.workplace || "",
    education: user.education || "",
    website: user.website || "",
    gender: user.gender || "",
    pronouns: user.pronouns || "",
    status: user.status || {},
    avatar: user.avatar || null,
    cover: user.cover || null,
  },
  account: {
    role: user.role || "user",
    isArtist: Boolean(user.isArtist),
    isVerified: Boolean(user.isVerified),
    emailVerified: Boolean(user.emailVerified),
    isActive: Boolean(user.isActive),
    isBanned: Boolean(user.isBanned),
    isSuspended: Boolean(user.isSuspended),
    suspensionReason: user.suspensionReason || "",
    suspendedAt: user.suspendedAt || null,
    suspendedUntil: user.suspendedUntil || null,
    banReason: user.banReason || "",
    bannedAt: user.bannedAt || null,
    joinedAt: user.joined || user.createdAt || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
    lastLoginAt: user.lastLoginAt || user.lastLogin || null,
    lastSeenAt: user.lastSeenAt || null,
  },
  preferences: {
    privacy: user.privacy || {},
    notifications: user.notificationPrefs || {},
    audio: user.audioPrefs || {},
    onboarding: user.onboarding || {},
    interests: Array.isArray(user.interests) ? user.interests : [],
  },
  relationships: {
    followers: idList(user.followers),
    following: idList(user.following),
    friends: idList(user.friends),
    incomingFriendRequests: idList(user.friendRequests),
    closeFriends: idList(user.closeFriends),
    blocked: idList([...(user.blockedUsers || []), ...(user.blocks || [])]),
    muted: idList(user.mutes),
    restricted: idList(user.restricts),
    storiesHiddenFrom: idList(user.hiddenStoriesFrom),
  },
  security: {
    twoFactor: {
      enabled: Boolean(user.twoFactor?.enabled),
      method: user.twoFactor?.method || "none",
      enabledAt: user.twoFactor?.enabledAt || null,
      lastVerifiedAt: user.twoFactor?.lastVerifiedAt || null,
    },
    sessions: (user.sessions || []).map(safeSession),
    trustedDevices: (user.trustedDevices || []).map(safeTrustedDevice),
    passwordChangedAt: user.passwordChangedAt || null,
  },
  membershipAndProgress: {
    institutionMemberships: user.institutionMemberships || [],
    badges: user.badges || [],
    streaks: user.streaks || {},
    achievements: user.achievementsStats || {},
  },
});

const boundedSection = (records = [], limit = ACCOUNT_DATA_EXPORT_RECORD_LIMIT) => {
  const truncated = records.length > limit;
  return {
    records: truncated ? records.slice(0, limit) : records,
    exportedCount: Math.min(records.length, limit),
    recordLimit: limit,
    complete: !truncated,
  };
};

const sectionManifest = (section = {}) => ({
  exportedCount: Number(section.exportedCount || 0),
  recordLimit: Number(section.recordLimit || ACCOUNT_DATA_EXPORT_RECORD_LIMIT),
  complete: Boolean(section.complete),
});

const buildAccountDataExport = async ({ userId, now = new Date() } = {}) => {
  if (!userId) {
    throw new AccountDataExportError("A user id is required for account export", 400);
  }

  const accountQuery = User.findById(userId)
    .select([
      "name username email phone country stateOfOrigin dob birthday bio currentCity hometown",
      "workplace education website gender pronouns status avatar cover role isArtist isVerified",
      "emailVerified isActive isBanned isSuspended isDeleted suspensionReason suspendedAt suspendedUntil",
      "banReason bannedAt joined createdAt updatedAt lastLogin lastLoginAt lastSeenAt privacy",
      "notificationPrefs audioPrefs onboarding interests followers following friends friendRequests",
      "closeFriends blockedUsers blocks mutes restricts hiddenStoriesFrom twoFactor.enabled",
      "twoFactor.method twoFactor.enabledAt twoFactor.lastVerifiedAt sessions.sessionId",
      "sessions.deviceName sessions.ip sessions.userAgent sessions.country sessions.city",
      "sessions.createdAt sessions.lastSeenAt sessions.revokedAt trustedDevices.deviceName",
      "trustedDevices.userAgent trustedDevices.firstSeenAt trustedDevices.lastSeenAt",
      "trustedDevices.lastIp trustedDevices.lastCountry passwordChangedAt institutionMemberships",
      "badges streaks achievementsStats",
    ].join(" "))
    .lean();

  const creatorProfileQuery = CreatorProfile.findOne({ userId })
    .select([
      "displayName fullName phoneNumber accountNumber bankName bankCode accountName country",
      "countryOfResidence socialHandles musicProfile booksProfile podcastsProfile creatorTypes",
      "acceptedTerms acceptedCopyrightDeclaration bio coverImageUrl links isCreator",
      "onboardingComplete onboardingCompleted profileCompletionScore status heroBannerUrl tagline",
      "genres paymentModeDefault subscriptionPrice subscriptionPriceGlobal",
      "subscriptionDescription subscriptionBenefits createdAt updatedAt",
    ].join(" "))
    .lean();

  const recordLimit = ACCOUNT_DATA_EXPORT_RECORD_LIMIT + 1;
  const [user, creatorProfile, posts, stories, sentMessages, purchases] = await Promise.all([
    accountQuery,
    creatorProfileQuery,
    Post.find({ author: userId })
      .select([
        "text tags taggedUsers feeling location callToAction moreOptions type poll.question",
        "poll.options quiz.question quiz.options mentions visibility media video audio",
        "commentsCount privacy edited shareCount moderationStatus moderationLabels",
        "moderationReason sensitiveContent sensitiveType originalVisibility createdAt updatedAt",
      ].join(" "))
      .sort({ createdAt: 1, _id: 1 })
      .limit(recordLimit)
      .lean(),
    Story.find({ $or: [{ authorId: userId }, { userId: String(userId) }] })
      .select([
        "userId authorId name username image media mediaUrl mediaType thumbnailUrl",
        "musicAttachment text visibility time expiresAt moderationStatus sensitiveContent",
        "sensitiveType originalVisibility",
      ].join(" "))
      .sort({ time: 1, _id: 1 })
      .limit(recordLimit)
      .lean(),
    Message.find({ senderId: userId, isSystem: { $ne: true } })
      .select([
        "conversationId senderId receiverId text senderName type metadata time status",
        "attachments edited isSystem moderationStatus sensitiveContent sensitiveType",
        "originalVisibility createdAt updatedAt",
      ].join(" "))
      .sort({ createdAt: 1, _id: 1 })
      .limit(recordLimit)
      .lean(),
    Purchase.find({ userId })
      .select([
        "creatorId itemType itemId amount priceNGN listedPriceAmount taxableBaseAmount",
        "processingFeeAmount taxAmount taxRateBps taxPriceMode taxSource taxPolicy",
        "taxJurisdiction taxProviderReported taxEffectiveAt currency status provider providerRef",
        "providerSessionId billingInterval accessExpiresAt cancelAtPeriodEnd canceledAt",
        "refundedAt refundReason paidAt revenueCategory createdAt updatedAt",
      ].join(" "))
      .sort({ createdAt: 1, _id: 1 })
      .limit(recordLimit)
      .lean(),
  ]);

  if (!user || user.isDeleted) {
    throw new AccountDataExportError("Account not found", 404);
  }

  const sections = {
    posts: boundedSection(posts),
    stories: boundedSection(stories),
    sentMessages: boundedSection(sentMessages),
    purchases: boundedSection(purchases),
  };
  const complete = Object.values(sections).every((section) => section.complete);
  const generatedAt = now.toISOString();
  const dateStamp = generatedAt.slice(0, 10);
  const safeUsername = String(user.username || "account").replace(/[^a-z0-9_-]+/gi, "-");

  return {
    fileName: `tengacion-${safeUsername}-account-data-${dateStamp}.json`,
    schemaVersion: ACCOUNT_DATA_EXPORT_SCHEMA_VERSION,
    generatedAt,
    manifest: {
      format: "application/json",
      scope: [
        "account profile, preferences, relationships and security metadata",
        "creator profile and payout account details without provider recipient identifiers",
        "authored posts and stories without other people's reactions, comments, views or replies",
        "messages sent by this account without recipient reactions",
        "purchase history without internal accounting locks",
      ],
      excludedSecrets: [
        "password and password reset hashes",
        "access and refresh token material",
        "multi-factor secrets and trusted-device fingerprints",
        "payment-provider recipient identifiers",
        "internal accounting locks",
      ],
      complete,
      sections: Object.fromEntries(
        Object.entries(sections).map(([key, section]) => [key, sectionManifest(section)])
      ),
      nextStep: complete
        ? "No section reached the per-section safety limit."
        : "One or more sections reached the export limit. Contact privacy support for a complete archive.",
    },
    data: {
      account: buildAccountSection(user),
      creatorProfile: creatorProfile || null,
      posts: sections.posts.records,
      stories: sections.stories.records,
      sentMessages: sections.sentMessages.records,
      purchases: sections.purchases.records,
    },
  };
};

module.exports = {
  ACCOUNT_DATA_EXPORT_RECORD_LIMIT,
  ACCOUNT_DATA_EXPORT_SCHEMA_VERSION,
  AccountDataExportError,
  buildBoundedSection: boundedSection,
  buildAccountDataExport,
};
