const mongoose = require("mongoose");
const CreatorProfile = require("../models/CreatorProfile");
const CreatorQualityProfile = require("../models/CreatorQualityProfile");
const Track = require("../models/Track");
const Book = require("../models/Book");
const Album = require("../models/Album");
const Video = require("../models/Video");
const Purchase = require("../models/Purchase");
const Report = require("../models/Report");
const Post = require("../models/Post");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const User = require("../models/User");
const { normalizeId } = require("./affinityService");

const PROFILE_TTL_MS = 6 * 60 * 60 * 1000;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const sumBy = (rows, getter) =>
  (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + Number(getter(row) || 0), 0);

const computeQualityTier = ({ trustScore, engagementRate, purchaseRate }) => {
  if (trustScore >= 0.75 && (engagementRate >= 8 || purchaseRate >= 0.06)) return "high";
  if (trustScore >= 0.45 && (engagementRate >= 2 || purchaseRate >= 0.015)) return "medium";
  return "low";
};

const computeCreatorQualityProfile = async (creatorId) => {
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return null;
  }

  const creator = await CreatorProfile.findById(creatorId).select("userId").lean();
  if (!creator?.userId) {
    return null;
  }

  const creatorUserId = normalizeId(creator.userId);
  const creatorIdString = normalizeId(creatorId);

  const [
    creatorUser,
    tracks,
    books,
    albums,
    videos,
    posts,
    paidPurchases,
    streamStarted,
    streamCompleted,
  ] = await Promise.all([
    User.findById(creatorUserId).select("followers").lean(),
    Track.find({ creatorId, archivedAt: null }).select("playsCount playCount purchaseCount").lean(),
    Book.find({ creatorId, archivedAt: null }).select("downloadCount purchaseCount").lean(),
    Album.find({ creatorId, archivedAt: null }).select("playCount purchaseCount").lean(),
    Video.find({ creatorProfileId: creatorId, archivedAt: null }).select("viewsCount").lean(),
    Post.find({ author: creatorUserId }).select("likes commentsCount reactionsCount shareCount").lean(),
    Purchase.find({ creatorId, status: "paid" }).select("amount").lean(),
    AnalyticsEvent.countDocuments({
      type: { $in: ["track_stream_started", "stream_started"] },
      "metadata.creatorId": creatorIdString,
    }),
    AnalyticsEvent.countDocuments({
      type: { $in: ["track_stream_completed", "stream_completed"] },
      "metadata.creatorId": creatorIdString,
    }),
  ]);

  const postIds = posts.map((post) => post._id);
  const reportQuery = postIds.length
    ? {
        $or: [
          { targetType: "user", targetId: creatorUserId },
          { targetType: "post", targetId: { $in: postIds } },
        ],
      }
    : { targetType: "user", targetId: creatorUserId };

  const [reportCount, openReportCount] = await Promise.all([
    Report.countDocuments(reportQuery),
    Report.countDocuments({
      ...reportQuery,
      status: { $in: ["open", "reviewing"] },
    }),
  ]);

  const followerCount = Array.isArray(creatorUser?.followers) ? creatorUser.followers.length : 0;
  const contentCount = tracks.length + books.length + albums.length + videos.length;
  const paidPurchaseCount = paidPurchases.length;
  const totalTrackPlays = sumBy(tracks, (row) => row?.playsCount || row?.playCount);
  const totalBookDownloads = sumBy(books, (row) => row?.downloadCount);
  const totalAlbumPlays = sumBy(albums, (row) => row?.playCount);
  const totalVideoViews = sumBy(videos, (row) => row?.viewsCount);
  const totalPostEngagement = sumBy(posts, (row) => {
    const likes = Array.isArray(row?.likes) ? row.likes.length : 0;
    return likes + Number(row?.reactionsCount || 0) + Number(row?.commentsCount || 0) + Number(row?.shareCount || 0);
  });
  const engagementRate = contentCount > 0
    ? (totalTrackPlays + totalBookDownloads + totalAlbumPlays + totalVideoViews + totalPostEngagement) / contentCount
    : totalPostEngagement;

  const completionRate = streamStarted > 0
    ? clamp(Number(streamCompleted || 0) / Number(streamStarted || 1), 0, 1)
    : 0.55;

  const purchaseRate = (() => {
    const denominator = totalTrackPlays + totalBookDownloads + totalAlbumPlays + totalVideoViews;
    if (denominator <= 0) {
      return paidPurchaseCount > 0 ? 0.08 : 0;
    }
    return clamp(paidPurchaseCount / denominator, 0, 1);
  })();

  const reportRate = clamp(reportCount / Math.max(1, followerCount + contentCount * 5), 0, 1);
  const trustScore = clamp(
    0.65
      + Math.min(0.18, completionRate * 0.2)
      + Math.min(0.12, purchaseRate * 1.2)
      - Math.min(0.4, reportRate * 5)
      - Math.min(0.15, openReportCount * 0.04),
    0,
    1
  );

  const payload = {
    creatorId,
    engagementRate: Number(engagementRate.toFixed(3)),
    completionRate: Number(completionRate.toFixed(3)),
    purchaseRate: Number(purchaseRate.toFixed(4)),
    reportRate: Number(reportRate.toFixed(4)),
    trustScore: Number(trustScore.toFixed(4)),
    qualityTier: computeQualityTier({ trustScore, engagementRate, purchaseRate }),
    followerCount,
    contentCount,
    paidPurchaseCount,
    lastComputedAt: new Date(),
  };

  return CreatorQualityProfile.findOneAndUpdate(
    { creatorId },
    { $set: payload },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
};

const loadCreatorQualityProfiles = async ({ creatorIds = [] } = {}) => {
  const uniqueCreatorIds = Array.from(
    new Set(
      (Array.isArray(creatorIds) ? creatorIds : [])
        .map((creatorId) => normalizeId(creatorId))
        .filter((creatorId) => mongoose.Types.ObjectId.isValid(creatorId))
    )
  );

  if (!uniqueCreatorIds.length) {
    return new Map();
  }

  const existing = await CreatorQualityProfile.find({
    creatorId: { $in: uniqueCreatorIds },
  }).lean();

  const existingMap = new Map(existing.map((row) => [normalizeId(row?.creatorId), row]));
  const staleIds = uniqueCreatorIds.filter((creatorId) => {
    const current = existingMap.get(creatorId);
    if (!current?.lastComputedAt) return true;
    return Date.now() - new Date(current.lastComputedAt).getTime() > PROFILE_TTL_MS;
  });

  if (staleIds.length) {
    const refreshed = await Promise.all(staleIds.map((creatorId) => computeCreatorQualityProfile(creatorId)));
    for (const row of refreshed) {
      if (!row?.creatorId) continue;
      existingMap.set(normalizeId(row.creatorId), row);
    }
  }

  return existingMap;
};

module.exports = {
  loadCreatorQualityProfiles,
};
