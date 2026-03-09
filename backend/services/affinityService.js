const mongoose = require("mongoose");
const User = require("../models/User");
const Message = require("../models/Message");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const PlayerProgress = require("../models/PlayerProgress");
const Purchase = require("../models/Purchase");
const CreatorProfile = require("../models/CreatorProfile");
const UserAffinityProfile = require("../models/UserAffinityProfile");

const PROFILE_TTL_MS = 15 * 60 * 1000;
const LOOKBACK_DAYS = 90;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (value.toString) return value.toString();
  return "";
};

const normalizeText = (value, maxLength = 80) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, maxLength);

const normalizeContentType = (value) => {
  const raw = normalizeText(value, 40);
  if (!raw) return "";
  if (["song", "music", "track"].includes(raw)) return "track";
  if (["podcast"].includes(raw)) return "podcast";
  if (["album"].includes(raw)) return "album";
  if (["book", "ebook"].includes(raw)) return "book";
  if (["video", "live"].includes(raw)) return raw;
  if (["creator"].includes(raw)) return "creator";
  if (["room", "rooms"].includes(raw)) return "room";
  if (["post", "image", "text", "poll", "quiz", "checkin"].includes(raw)) return "post";
  return raw;
};

const pickTop = (scoreMap, limit, keyName = "value") =>
  Array.from(scoreMap.entries())
    .filter(([key, value]) => key && Number(value) > 0)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, limit)
    .map(([key, value]) => ({ [keyName]: key, score: Number(value.toFixed(3)) }));

const toSet = (values = []) =>
  new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeId(value))
      .filter(Boolean)
  );

const addScore = (scoreMap, key, amount) => {
  if (!key) return;
  scoreMap.set(key, Number(scoreMap.get(key) || 0) + Number(amount || 0));
};

const getRelationshipSignals = async (user) => {
  const followingUserIds = Array.from(toSet(user?.following));
  const friendUserIds = Array.from(toSet(user?.friends));
  const closeFriendUserIds = Array.from(toSet(user?.closeFriends));

  const creatorProfiles = await CreatorProfile.find({
    userId: {
      $in: [
        ...followingUserIds,
        ...friendUserIds,
        ...closeFriendUserIds,
      ],
    },
  })
    .select("_id userId")
    .lean();

  const followingCreatorIds = [];
  const friendCreatorIds = [];
  const closeFriendCreatorIds = [];

  for (const profile of creatorProfiles) {
    const creatorId = normalizeId(profile?._id);
    const userId = normalizeId(profile?.userId);
    if (!creatorId || !userId) continue;
    if (followingUserIds.includes(userId)) followingCreatorIds.push(creatorId);
    if (friendUserIds.includes(userId)) friendCreatorIds.push(creatorId);
    if (closeFriendUserIds.includes(userId)) closeFriendCreatorIds.push(creatorId);
  }

  return {
    followingUserIds,
    friendUserIds,
    closeFriendUserIds,
    followingCreatorIds,
    friendCreatorIds,
    closeFriendCreatorIds,
    blockedUserIds: Array.from(toSet([...(user?.blockedUsers || []), ...(user?.blocks || [])])),
    mutedUserIds: Array.from(toSet(user?.mutes)),
    restrictedUserIds: Array.from(toSet(user?.restricts)),
  };
};

const EVENT_WEIGHTS = {
  recommendation_clicked: 2,
  recommendation_hidden: -1.5,
  recommendation_dismissed: -2,
  creator_followed: 6,
  creator_profile_viewed: 3,
  live_joined: 4,
  live_left: 1,
  post_opened: 2,
  post_dwell: 3,
  post_shared: 4,
  story_seen: 1,
  story_replied: 3,
  search_result_clicked: 1.5,
  track_preview_started: 1.5,
  track_stream_started: 2,
  track_stream_completed: 5,
  book_preview_opened: 1.5,
  book_downloaded: 4,
  paywall_viewed: 1.5,
  stream_started: 2,
  stream_completed: 4,
  download_completed: 4,
  purchase_success: 8,
};

const hydrateProfile = (profileDoc, relationshipSignals, messagePartnerIds, purchaseCreatorIds) => {
  const topCreators = Array.isArray(profileDoc?.topCreators) ? profileDoc.topCreators : [];
  const preferredContentTypes = Array.isArray(profileDoc?.preferredContentTypes)
    ? profileDoc.preferredContentTypes
    : [];
  const topTopics = Array.isArray(profileDoc?.topTopics) ? profileDoc.topTopics : [];

  return {
    userId: normalizeId(profileDoc?.userId),
    topCreators: topCreators.map((entry) => ({
      creatorId: normalizeId(entry?.creatorId),
      score: Number(entry?.score || 0),
    })),
    preferredContentTypes: preferredContentTypes.map((entry) => ({
      contentType: normalizeContentType(entry?.value),
      score: Number(entry?.score || 0),
    })),
    topTopics: topTopics.map((entry) => ({
      topic: normalizeText(entry?.value, 80),
      score: Number(entry?.score || 0),
    })),
    recentSignals: profileDoc?.recentSignals || {},
    negativeSignals: profileDoc?.negativeSignals || {},
    lastComputedAt: profileDoc?.lastComputedAt || null,
    relationshipSignals: {
      ...relationshipSignals,
      messagePartnerIds,
      purchaseCreatorIds,
    },
    topCreatorScores: new Map(
      topCreators
        .map((entry) => [normalizeId(entry?.creatorId), Number(entry?.score || 0)])
        .filter(([creatorId]) => Boolean(creatorId))
    ),
    contentTypeScores: new Map(
      preferredContentTypes
        .map((entry) => [normalizeContentType(entry?.value), Number(entry?.score || 0)])
        .filter(([contentType]) => Boolean(contentType))
    ),
    topicScores: new Map(
      topTopics
        .map((entry) => [normalizeText(entry?.value, 80), Number(entry?.score || 0)])
        .filter(([topic]) => Boolean(topic))
    ),
    relationshipSets: {
      followingUserIds: toSet(relationshipSignals?.followingUserIds),
      friendUserIds: toSet(relationshipSignals?.friendUserIds),
      closeFriendUserIds: toSet(relationshipSignals?.closeFriendUserIds),
      followingCreatorIds: toSet(relationshipSignals?.followingCreatorIds),
      friendCreatorIds: toSet(relationshipSignals?.friendCreatorIds),
      closeFriendCreatorIds: toSet(relationshipSignals?.closeFriendCreatorIds),
      blockedUserIds: toSet(relationshipSignals?.blockedUserIds),
      mutedUserIds: toSet(relationshipSignals?.mutedUserIds),
      restrictedUserIds: toSet(relationshipSignals?.restrictedUserIds),
      messagePartnerIds: toSet(messagePartnerIds),
      purchaseCreatorIds: toSet(purchaseCreatorIds),
    },
  };
};

const computeAffinityProfile = async (user) => {
  const userId = normalizeId(user?._id);
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  const relationshipSignals = await getRelationshipSignals(user);
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [events, progressRows, purchases, messages] = await Promise.all([
    AnalyticsEvent.find({
      userId,
      createdAt: { $gte: cutoff },
    })
      .sort({ createdAt: -1 })
      .limit(500)
      .select("type targetId targetType contentType metadata createdAt")
      .lean(),
    PlayerProgress.find({
      userId,
      playedAt: { $gte: cutoff },
    })
      .sort({ playedAt: -1 })
      .limit(120)
      .select("creatorId itemType positionSec durationSec playedAt")
      .lean(),
    Purchase.find({
      userId,
      status: "paid",
      paidAt: { $gte: cutoff },
    })
      .sort({ paidAt: -1 })
      .limit(120)
      .select("creatorId itemType amount paidAt")
      .lean(),
    Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
      createdAt: { $gte: cutoff },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .select("senderId receiverId")
      .lean(),
  ]);

  const creatorScores = new Map();
  const topicScores = new Map();
  const contentTypeScores = new Map();
  const messagePartnerScores = new Map();

  for (const interest of Array.isArray(user?.interests) ? user.interests : []) {
    const topic = normalizeText(interest, 80);
    addScore(topicScores, topic, 3);
  }

  for (const event of events) {
    const weight = Number(EVENT_WEIGHTS[event?.type] || 0.75);
    const creatorId = normalizeId(event?.metadata?.creatorId)
      || (normalizeText(event?.targetType, 40) === "creator" ? normalizeId(event?.targetId) : "");
    const contentType = normalizeContentType(event?.contentType || event?.targetType || event?.metadata?.itemType);
    const topic = normalizeText(event?.metadata?.topic || event?.metadata?.genre, 80);

    addScore(creatorScores, creatorId, weight);
    addScore(contentTypeScores, contentType, clamp(weight * 0.8, -2, 6));
    addScore(topicScores, topic, clamp(weight * 0.5, -1, 4));
  }

  for (const row of progressRows) {
    const creatorId = normalizeId(row?.creatorId);
    const contentType = normalizeContentType(row?.itemType);
    const completionRatio = row?.durationSec > 0
      ? clamp(Number(row.positionSec || 0) / Number(row.durationSec || 1), 0, 1)
      : 0.35;

    addScore(creatorScores, creatorId, 2 + completionRatio * 3);
    addScore(contentTypeScores, contentType, 2 + completionRatio * 2);
  }

  const purchaseCreatorIds = [];
  for (const purchase of purchases) {
    const creatorId = normalizeId(purchase?.creatorId);
    const contentType = normalizeContentType(purchase?.itemType);
    addScore(creatorScores, creatorId, 8);
    addScore(contentTypeScores, contentType, 5);
    if (creatorId) {
      purchaseCreatorIds.push(creatorId);
    }
  }

  for (const message of messages) {
    const senderId = normalizeId(message?.senderId);
    const receiverId = normalizeId(message?.receiverId);
    const counterpartId = senderId === userId ? receiverId : senderId;
    addScore(messagePartnerScores, counterpartId, 1);
  }

  for (const creatorId of relationshipSignals.followingCreatorIds || []) {
    addScore(creatorScores, creatorId, 6);
  }
  for (const creatorId of relationshipSignals.friendCreatorIds || []) {
    addScore(creatorScores, creatorId, 3);
  }

  const profilePayload = {
    userId,
    topCreators: pickTop(creatorScores, 12, "creatorId"),
    topTopics: pickTop(topicScores, 8, "value"),
    preferredContentTypes: pickTop(contentTypeScores, 8, "value"),
    recentSignals: {
      events: events.length,
      progressRows: progressRows.length,
      purchases: purchases.length,
      messagePartners: Array.from(messagePartnerScores.keys()).filter(Boolean).length,
    },
    negativeSignals: {
      blockedUserIds: relationshipSignals.blockedUserIds,
      mutedUserIds: relationshipSignals.mutedUserIds,
      restrictedUserIds: relationshipSignals.restrictedUserIds,
    },
    lastComputedAt: new Date(),
  };

  const storedProfile = await UserAffinityProfile.findOneAndUpdate(
    { userId },
    { $set: profilePayload },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  return hydrateProfile(
    storedProfile,
    relationshipSignals,
    Array.from(messagePartnerScores.keys()).filter(Boolean),
    Array.from(new Set(purchaseCreatorIds.filter(Boolean)))
  );
};

const buildUserAffinityProfile = async ({ userId, force = false } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  const user = await User.findById(userId)
    .select("following friends closeFriends blockedUsers blocks mutes restricts interests")
    .lean();
  if (!user) {
    return null;
  }

  if (!force) {
    const existing = await UserAffinityProfile.findOne({ userId }).lean();
    const freshEnough = existing?.lastComputedAt
      && Date.now() - new Date(existing.lastComputedAt).getTime() < PROFILE_TTL_MS;
    if (freshEnough) {
      const relationshipSignals = await getRelationshipSignals(user);
      const purchaseCreatorIds = await Purchase.find({
        userId,
        status: "paid",
        creatorId: { $ne: null },
      })
        .sort({ paidAt: -1, createdAt: -1 })
        .limit(50)
        .select("creatorId")
        .lean()
        .then((rows) => rows.map((row) => normalizeId(row?.creatorId)).filter(Boolean));
      const messagePartnerIds = await Message.find({
        $or: [{ senderId: userId }, { receiverId: userId }],
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .select("senderId receiverId")
        .lean()
        .then((rows) =>
          rows
            .map((row) => {
              const senderId = normalizeId(row?.senderId);
              const receiverId = normalizeId(row?.receiverId);
              return senderId === userId ? receiverId : senderId;
            })
            .filter(Boolean)
        );

      return hydrateProfile(existing, relationshipSignals, messagePartnerIds, purchaseCreatorIds);
    }
  }

  return computeAffinityProfile({ ...user, _id: userId });
};

module.exports = {
  buildUserAffinityProfile,
  normalizeContentType,
  normalizeId,
};
