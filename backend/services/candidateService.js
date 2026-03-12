const mongoose = require("mongoose");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const Book = require("../models/Book");
const Album = require("../models/Album");
const Video = require("../models/Video");
const Purchase = require("../models/Purchase");
const LiveSession = require("../models/LiveSession");
const PostService = require("../../apps/api/services/postService");
const { normalizeId, normalizeContentType } = require("./affinityService");

const ACTIVE_TRACK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_BOOK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_ALBUM_FILTER = { status: "published", isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_VIDEO_FILTER = { isPublished: { $ne: false }, archivedAt: null };

const safeDate = (value) => (value ? new Date(value) : new Date(0));
const makeEntityKey = (entityType, entityId) => `${entityType}:${entityId}`;

const buildCreatorStatsMaps = async (creatorIds = []) => {
  const ids = Array.from(
    new Set(
      (Array.isArray(creatorIds) ? creatorIds : [])
        .map((creatorId) => normalizeId(creatorId))
        .filter(Boolean)
    )
  );

  if (!ids.length) {
    return {
      contentCountMap: new Map(),
      popularityMap: new Map(),
      purchaseMap: new Map(),
    };
  }

  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const [trackRows, bookRows, albumRows, videoRows, purchaseRows] = await Promise.all([
    Track.aggregate([
      { $match: { creatorId: { $in: objectIds }, ...ACTIVE_TRACK_FILTER } },
      { $group: { _id: "$creatorId", count: { $sum: 1 }, popularity: { $sum: { $add: ["$playsCount", "$purchaseCount"] } } } },
    ]),
    Book.aggregate([
      { $match: { creatorId: { $in: objectIds }, ...ACTIVE_BOOK_FILTER } },
      { $group: { _id: "$creatorId", count: { $sum: 1 }, popularity: { $sum: { $add: ["$downloadCount", "$purchaseCount"] } } } },
    ]),
    Album.aggregate([
      { $match: { creatorId: { $in: objectIds }, ...ACTIVE_ALBUM_FILTER } },
      { $group: { _id: "$creatorId", count: { $sum: 1 }, popularity: { $sum: { $add: ["$playCount", "$purchaseCount"] } } } },
    ]),
    Video.aggregate([
      { $match: { creatorProfileId: { $in: objectIds }, ...ACTIVE_VIDEO_FILTER } },
      { $group: { _id: "$creatorProfileId", count: { $sum: 1 }, popularity: { $sum: "$viewsCount" } } },
    ]),
    Purchase.aggregate([
      { $match: { creatorId: { $in: objectIds }, status: "paid" } },
      { $group: { _id: "$creatorId", purchases: { $sum: 1 } } },
    ]),
  ]);

  const contentCountMap = new Map();
  const popularityMap = new Map();
  const purchaseMap = new Map();

  for (const rows of [trackRows, bookRows, albumRows, videoRows]) {
    for (const row of rows) {
      const key = normalizeId(row?._id);
      if (!key) continue;
      contentCountMap.set(key, Number(contentCountMap.get(key) || 0) + Number(row?.count || 0));
      popularityMap.set(key, Number(popularityMap.get(key) || 0) + Number(row?.popularity || 0));
    }
  }

  for (const row of purchaseRows) {
    const key = normalizeId(row?._id);
    if (!key) continue;
    purchaseMap.set(key, Number(row?.purchases || 0));
  }

  return { contentCountMap, popularityMap, purchaseMap };
};

const listHomeCandidates = async ({ userId, limit = 20 } = {}) => {
  const feed = await PostService.getFeed({ userId, search: "" });
  const authorIds = Array.from(
    new Set(
      feed
        .map((post) => normalizeId(post?.user?._id))
        .filter(Boolean)
    )
  );
  const creatorProfiles = authorIds.length
    ? await CreatorProfile.find({ userId: { $in: authorIds } })
      .select("_id userId")
      .lean()
    : [];
  const creatorIdByUserId = new Map(
    creatorProfiles.map((profile) => [
      normalizeId(profile?.userId),
      normalizeId(profile?._id),
    ])
  );

  return feed
    .slice(0, Math.max(limit * 4, 60))
    .map((post) => {
      const authorUserId = normalizeId(post?.user?._id);

      return {
        candidateId: makeEntityKey("post", post._id),
        entityType: "post",
        entityId: post._id,
        creatorId: creatorIdByUserId.get(authorUserId) || "",
        authorUserId,
        contentType: normalizeContentType(post?.type),
        createdAt: safeDate(post?.createdAt),
        popularity: Number(post?.likesCount || 0) + Number(post?.commentsCount || 0) * 1.5 + Number(post?.shareCount || 0) * 2,
        topics: Array.isArray(post?.hashtags) ? post.hashtags : [],
        payload: post,
      };
    });
};

const listCreatorCandidates = async ({ userId, limit = 20 } = {}) => {
  const profiles = await CreatorProfile.find({ isCreator: true })
    .populate("userId", "name username avatar followers isVerified emailVerified")
    .sort({ createdAt: -1 })
    .limit(Math.max(limit * 3, 30))
    .lean();

  const filtered = profiles.filter((profile) => normalizeId(profile?.userId?._id || profile?.userId) !== normalizeId(userId));
  const creatorIds = filtered.map((profile) => normalizeId(profile?._id)).filter(Boolean);
  const { contentCountMap, popularityMap, purchaseMap } = await buildCreatorStatsMaps(creatorIds);

  return filtered
    .map((profile) => {
      const creatorId = normalizeId(profile?._id);
      const user = profile?.userId || {};
      const followerCount = Array.isArray(user?.followers) ? user.followers.length : 0;
      const contentCount = Number(contentCountMap.get(creatorId) || 0);
      if (contentCount <= 0) return null;

      return {
        candidateId: makeEntityKey("creator", creatorId),
        entityType: "creator",
        entityId: creatorId,
        creatorId,
        authorUserId: normalizeId(user?._id),
        contentType: "creator",
        createdAt: safeDate(profile?.createdAt),
        popularity: Number(popularityMap.get(creatorId) || 0),
        followerCount,
        contentCount,
        purchaseCount: Number(purchaseMap.get(creatorId) || 0),
        topics: Array.isArray(profile?.genres) ? profile.genres : [],
        payload: {
          id: creatorId,
          displayName: profile?.displayName || "",
          bio: profile?.bio || "",
          tagline: profile?.tagline || "",
          genres: Array.isArray(profile?.genres) ? profile.genres : [],
          userId: normalizeId(user?._id),
          username: user?.username || "",
          name: user?.name || "",
          avatar: typeof user?.avatar === "string" ? user.avatar : user?.avatar?.url || "",
          followerCount,
          contentCount,
          purchaseCount: Number(purchaseMap.get(creatorId) || 0),
          isVerified: Boolean(user?.isVerified || user?.emailVerified),
        },
      };
    })
    .filter(Boolean);
};

const listLiveCandidates = async ({ limit = 20 } = {}) => {
  const sessions = await LiveSession.find({ status: "active" })
    .sort({ startedAt: -1 })
    .limit(Math.max(limit * 3, 20))
    .lean();

  const hostUserIds = Array.from(new Set(sessions.map((session) => normalizeId(session?.hostUserId)).filter(Boolean)));
  const creatorProfiles = await CreatorProfile.find({ userId: { $in: hostUserIds } })
    .select("_id userId displayName")
    .lean();
  const creatorByUserId = new Map(creatorProfiles.map((profile) => [normalizeId(profile?.userId), profile]));

  return sessions.map((session) => {
    const hostUserId = normalizeId(session?.hostUserId);
    const creatorProfile = creatorByUserId.get(hostUserId);
    const creatorId = normalizeId(creatorProfile?._id);

    return {
      candidateId: makeEntityKey("live", normalizeId(session?._id)),
      entityType: "live",
      entityId: normalizeId(session?._id),
      creatorId,
      authorUserId: hostUserId,
      contentType: "live",
      createdAt: safeDate(session?.startedAt || session?.createdAt),
      popularity: Number(session?.viewerCount || 0),
      viewerCount: Number(session?.viewerCount || 0),
      payload: {
        id: normalizeId(session?._id),
        roomName: session?.roomName || "",
        title: session?.title || "Live now",
        status: session?.status || "active",
        viewerCount: Number(session?.viewerCount || 0),
        startedAt: session?.startedAt || null,
        host: {
          userId: hostUserId,
          username: session?.hostUsername || "",
          name: session?.hostName || "",
          avatar: session?.hostAvatar || "",
          creatorId,
          displayName: creatorProfile?.displayName || session?.hostName || "",
        },
      },
    };
  });
};

const listCreatorHubCandidates = async ({ creatorId = "", limit = 24 } = {}) => {
  const matchCreatorId = normalizeId(creatorId);
  const trackQuery = { ...ACTIVE_TRACK_FILTER };
  const bookQuery = { ...ACTIVE_BOOK_FILTER };
  const albumQuery = { ...ACTIVE_ALBUM_FILTER };
  const videoQuery = { ...ACTIVE_VIDEO_FILTER };
  if (mongoose.Types.ObjectId.isValid(matchCreatorId)) {
    trackQuery.creatorId = matchCreatorId;
    bookQuery.creatorId = matchCreatorId;
    albumQuery.creatorId = matchCreatorId;
    videoQuery.creatorProfileId = matchCreatorId;
  }

  const perTypeLimit = Math.max(6, Math.ceil(limit / 2));
  const [tracks, books, albums, videos, creatorProfiles] = await Promise.all([
    Track.find(trackQuery).sort({ playsCount: -1, purchaseCount: -1, createdAt: -1 }).limit(perTypeLimit).lean(),
    Book.find(bookQuery).sort({ downloadCount: -1, purchaseCount: -1, createdAt: -1 }).limit(perTypeLimit).lean(),
    Album.find(albumQuery).sort({ playCount: -1, purchaseCount: -1, createdAt: -1 }).limit(perTypeLimit).lean(),
    Video.find(videoQuery).sort({ viewsCount: -1, time: -1, createdAt: -1 }).limit(perTypeLimit).lean(),
    CreatorProfile.find({ isCreator: true }).populate("userId", "name username avatar").lean(),
  ]);

  const creatorMap = new Map(
    creatorProfiles.map((profile) => [
      normalizeId(profile?._id),
      {
        creatorId: normalizeId(profile?._id),
        displayName: profile?.displayName || "",
        userId: normalizeId(profile?.userId?._id || profile?.userId),
        username: profile?.userId?.username || "",
        avatar: typeof profile?.userId?.avatar === "string"
          ? profile.userId.avatar
          : profile?.userId?.avatar?.url || "",
      },
    ])
  );

  const items = [];
  for (const track of tracks) {
    const creatorMeta = creatorMap.get(normalizeId(track?.creatorId)) || {};
    items.push({
      candidateId: makeEntityKey("track", normalizeId(track?._id)),
      entityType: "track",
      entityId: normalizeId(track?._id),
      creatorId: normalizeId(track?.creatorId),
      authorUserId: normalizeId(creatorMeta?.userId),
      contentType: normalizeContentType(track?.kind || "track"),
      createdAt: safeDate(track?.createdAt),
      popularity: Number(track?.playsCount || track?.playCount || 0) + Number(track?.purchaseCount || 0) * 4,
      price: Number(track?.price || 0),
      payload: {
        id: normalizeId(track?._id),
        title: track?.title || "",
        creatorId: normalizeId(track?.creatorId),
        creatorName: creatorMeta?.displayName || "",
        username: creatorMeta?.username || "",
        avatar: creatorMeta?.avatar || "",
        coverUrl: track?.coverImageUrl || track?.coverUrl || "",
        price: Number(track?.price || 0),
        kind: track?.kind || "music",
        playsCount: Number(track?.playsCount || track?.playCount || 0),
        purchaseCount: Number(track?.purchaseCount || 0),
      },
    });
  }
  for (const book of books) {
    const creatorMeta = creatorMap.get(normalizeId(book?.creatorId)) || {};
    items.push({
      candidateId: makeEntityKey("book", normalizeId(book?._id)),
      entityType: "book",
      entityId: normalizeId(book?._id),
      creatorId: normalizeId(book?.creatorId),
      authorUserId: normalizeId(creatorMeta?.userId),
      contentType: "book",
      createdAt: safeDate(book?.createdAt),
      popularity: Number(book?.downloadCount || 0) + Number(book?.purchaseCount || 0) * 4,
      price: Number(book?.price || 0),
      payload: {
        id: normalizeId(book?._id),
        title: book?.title || "",
        creatorId: normalizeId(book?.creatorId),
        creatorName: creatorMeta?.displayName || "",
        username: creatorMeta?.username || "",
        avatar: creatorMeta?.avatar || "",
        coverUrl: book?.coverImageUrl || book?.coverUrl || "",
        price: Number(book?.price || 0),
        downloadCount: Number(book?.downloadCount || 0),
        purchaseCount: Number(book?.purchaseCount || 0),
      },
    });
  }
  for (const album of albums) {
    const creatorMeta = creatorMap.get(normalizeId(album?.creatorId)) || {};
    items.push({
      candidateId: makeEntityKey("album", normalizeId(album?._id)),
      entityType: "album",
      entityId: normalizeId(album?._id),
      creatorId: normalizeId(album?.creatorId),
      authorUserId: normalizeId(creatorMeta?.userId),
      contentType: "album",
      createdAt: safeDate(album?.createdAt),
      popularity: Number(album?.playCount || 0) + Number(album?.purchaseCount || 0) * 4,
      price: Number(album?.price || 0),
      payload: {
        id: normalizeId(album?._id),
        title: album?.title || "",
        creatorId: normalizeId(album?.creatorId),
        creatorName: creatorMeta?.displayName || "",
        username: creatorMeta?.username || "",
        avatar: creatorMeta?.avatar || "",
        coverUrl: album?.coverUrl || "",
        price: Number(album?.price || 0),
        playCount: Number(album?.playCount || 0),
        purchaseCount: Number(album?.purchaseCount || 0),
      },
    });
  }
  for (const video of videos) {
    const creatorMeta = creatorMap.get(normalizeId(video?.creatorProfileId)) || {};
    items.push({
      candidateId: makeEntityKey("video", normalizeId(video?._id)),
      entityType: "video",
      entityId: normalizeId(video?._id),
      creatorId: normalizeId(video?.creatorProfileId),
      authorUserId: normalizeId(creatorMeta?.userId || video?.userId),
      contentType: "video",
      createdAt: safeDate(video?.createdAt || video?.time),
      popularity: Number(video?.viewsCount || 0),
      price: Number(video?.price || 0),
      payload: {
        id: normalizeId(video?._id),
        title: video?.caption || "Video",
        creatorId: normalizeId(video?.creatorProfileId),
        creatorName: creatorMeta?.displayName || video?.name || "",
        username: creatorMeta?.username || video?.username || "",
        avatar: creatorMeta?.avatar || video?.avatar || "",
        coverUrl: video?.coverImageUrl || "",
        price: Number(video?.price || 0),
        viewsCount: Number(video?.viewsCount || 0),
      },
    });
  }

  return items;
};

module.exports = {
  listHomeCandidates,
  listCreatorCandidates,
  listLiveCandidates,
  listCreatorHubCandidates,
};
