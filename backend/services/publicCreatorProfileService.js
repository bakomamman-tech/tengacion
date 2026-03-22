const mongoose = require("mongoose");

const Album = require("../models/Album");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const Track = require("../models/Track");
const Video = require("../models/Video");
const { buildAlbumArchiveUrl } = require("./albumArchiveService");
const { getUserPaidPurchases } = require("./entitlementService");
const { buildSignedMediaUrl } = require("./mediaSigner");
const { normalizeCreatorTypes } = require("./creatorProfileService");

const ACTIVE_TRACK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_BOOK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_ALBUM_FILTER = { status: "published", isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_VIDEO_FILTER = { isPublished: { $ne: false }, archivedAt: null };

const toObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }
  return new mongoose.Types.ObjectId(value);
};

const toCleanString = (value = "") => String(value || "").trim();

const numberOrZero = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildSignedUrl = ({
  req,
  sourceUrl,
  itemType,
  itemId,
  userId = "",
  allowDownload = false,
}) =>
  sourceUrl
    ? buildSignedMediaUrl({
        sourceUrl,
        itemType,
        itemId,
        userId,
        allowDownload,
        req,
        expiresInSec: 10 * 60,
      })
    : "";

const buildEntitlementSet = async (viewerId) => {
  if (!mongoose.Types.ObjectId.isValid(viewerId)) {
    return new Set();
  }

  const purchases = await getUserPaidPurchases(viewerId);
  return new Set(
    purchases.map((row) => `${toCleanString(row.itemType).toLowerCase()}:${String(row.itemId || "")}`)
  );
};

const buildTrackPreviewSource = (track, canAccessFull) => {
  if (!track) {
    return "";
  }
  if (canAccessFull) {
    return toCleanString(track.audioUrl);
  }
  return toCleanString(track.previewUrl) || (numberOrZero(track.price) <= 0 ? toCleanString(track.audioUrl) : "");
};

const buildVideoPreviewSource = (video, canAccessFull) => {
  if (!video) {
    return "";
  }
  if (canAccessFull) {
    return toCleanString(video.videoUrl);
  }
  return toCleanString(video.previewClipUrl) || (numberOrZero(video.price) <= 0 ? toCleanString(video.videoUrl) : "");
};

const buildBookPreviewSource = (book, canAccessFull) => {
  if (!book) {
    return "";
  }
  if (canAccessFull) {
    return toCleanString(book.contentUrl || book.fileUrl);
  }
  return (
    toCleanString(book.previewUrl) ||
    (book.isFreePreview ? toCleanString(book.contentUrl || book.fileUrl) : "")
  );
};

const buildAlbumPreviewSource = (album, canAccessFull) => {
  const firstTrack = Array.isArray(album?.tracks) ? album.tracks[0] : null;
  if (!firstTrack) {
    return "";
  }
  if (canAccessFull) {
    return toCleanString(firstTrack.trackUrl);
  }
  return toCleanString(firstTrack.previewUrl) || (numberOrZero(album?.price) <= 0 ? toCleanString(firstTrack.trackUrl) : "");
};

const mapTrackItem = ({ track, req, viewerId, ownerAccess, entitlements }) => {
  const isPodcast = toCleanString(track.kind).toLowerCase() === "podcast";
  const entitlementKey = `track:${String(track._id)}`;
  const canAccessFull = ownerAccess || numberOrZero(track.price) <= 0 || entitlements.has(entitlementKey);
  const previewSource = buildTrackPreviewSource(track, false);
  const streamSource = buildTrackPreviewSource(track, canAccessFull);
  const itemType = isPodcast ? "podcast" : "track";

  return {
    id: String(track._id),
    itemType,
    mediaType: toCleanString(track.mediaType || (track.videoUrl ? "video" : "audio")) === "video" ? "video" : "audio",
    lane: isPodcast ? "podcast" : "music",
    title: toCleanString(track.title),
    description: toCleanString(track.description),
    subtitle: isPodcast
      ? [toCleanString(track.podcastSeries), track.seasonNumber ? `S${track.seasonNumber}` : "", track.episodeNumber ? `E${track.episodeNumber}` : ""]
          .filter(Boolean)
          .join(" ")
      : toCleanString(track.genre),
    coverUrl: toCleanString(track.coverImageUrl || track.coverUrl),
    previewUrl: buildSignedUrl({
      req,
      sourceUrl: previewSource,
      itemType: "track",
      itemId: String(track._id),
      userId: viewerId,
    }),
    streamUrl: buildSignedUrl({
      req,
      sourceUrl: streamSource,
      itemType: "track",
      itemId: String(track._id),
      userId: viewerId,
    }),
    downloadUrl: canAccessFull
      ? buildSignedUrl({
          req,
          sourceUrl: toCleanString(track.audioUrl),
          itemType: "track",
          itemId: String(track._id),
          userId: viewerId,
          allowDownload: true,
        })
      : "",
    route: `/tracks/${String(track._id)}`,
    price: numberOrZero(track.price),
    isFree: numberOrZero(track.price) <= 0,
    canAccessFull,
    canPreview: Boolean(previewSource || streamSource),
    canStream: Boolean(streamSource),
    canDownload: Boolean(canAccessFull && toCleanString(track.audioUrl)),
    canBuy: numberOrZero(track.price) > 0 && !canAccessFull,
    previewStartSec: numberOrZero(track.previewStartSec),
    previewLimitSec: numberOrZero(track.previewLimitSec || 30),
    playsCount: numberOrZero(track.playsCount || track.playCount),
    purchaseCount: numberOrZero(track.purchaseCount),
    genre: toCleanString(track.genre),
    podcastSeries: toCleanString(track.podcastSeries),
    seasonNumber: numberOrZero(track.seasonNumber),
    episodeNumber: numberOrZero(track.episodeNumber),
    publishedAt: track.updatedAt || track.createdAt || null,
  };
};

const mapAlbumItem = ({ album, req, viewerId, ownerAccess, entitlements }) => {
  const entitlementKey = `album:${String(album._id)}`;
  const canAccessFull = ownerAccess || numberOrZero(album.price) <= 0 || entitlements.has(entitlementKey);
  const previewSource = buildAlbumPreviewSource(album, false);
  const streamSource = buildAlbumPreviewSource(album, canAccessFull);
  const tracks = Array.isArray(album.tracks) ? album.tracks : [];

  return {
    id: String(album._id),
    itemType: "album",
    mediaType: "audio",
    lane: "music",
    title: toCleanString(album.title),
    description: toCleanString(album.description),
    subtitle: `${numberOrZero(album.totalTracks || tracks.length)} ${numberOrZero(album.totalTracks || tracks.length) === 1 ? "track" : "tracks"}`,
    coverUrl: toCleanString(album.coverUrl),
    previewUrl: buildSignedUrl({
      req,
      sourceUrl: previewSource,
      itemType: "album",
      itemId: String(album._id),
      userId: viewerId,
    }),
    streamUrl: buildSignedUrl({
      req,
      sourceUrl: streamSource,
      itemType: "album",
      itemId: String(album._id),
      userId: viewerId,
    }),
    downloadUrl: canAccessFull
      ? buildAlbumArchiveUrl({
          albumId: String(album._id),
          req,
          userId: viewerId,
        })
      : "",
    route: `/albums/${String(album._id)}`,
    price: numberOrZero(album.price),
    isFree: numberOrZero(album.price) <= 0,
    canAccessFull,
    canPreview: Boolean(previewSource || streamSource),
    canStream: Boolean(streamSource),
    canDownload: canAccessFull,
    canBuy: numberOrZero(album.price) > 0 && !canAccessFull,
    totalTracks: numberOrZero(album.totalTracks || tracks.length),
    playCount: numberOrZero(album.playCount),
    purchaseCount: numberOrZero(album.purchaseCount),
    releaseType: toCleanString(album.releaseType || album.contentType || "album"),
    publishedAt: album.updatedAt || album.createdAt || null,
  };
};

const mapVideoItem = ({ video, req, viewerId, ownerAccess, entitlements }) => {
  const entitlementKey = `video:${String(video._id)}`;
  const canAccessFull = ownerAccess || numberOrZero(video.price) <= 0 || entitlements.has(entitlementKey);
  const previewSource = buildVideoPreviewSource(video, false);
  const streamSource = buildVideoPreviewSource(video, canAccessFull);

  return {
    id: String(video._id),
    itemType: "video",
    mediaType: "video",
    lane: "music",
    title: toCleanString(video.caption || "Music video"),
    description: toCleanString(video.description || video.caption),
    subtitle: numberOrZero(video.viewsCount) ? `${numberOrZero(video.viewsCount).toLocaleString()} views` : "Music video",
    coverUrl: toCleanString(video.coverImageUrl),
    previewUrl: buildSignedUrl({
      req,
      sourceUrl: previewSource,
      itemType: "video",
      itemId: String(video._id),
      userId: viewerId,
    }),
    streamUrl: buildSignedUrl({
      req,
      sourceUrl: streamSource,
      itemType: "video",
      itemId: String(video._id),
      userId: viewerId,
    }),
    downloadUrl: canAccessFull
      ? buildSignedUrl({
          req,
          sourceUrl: toCleanString(video.videoUrl),
          itemType: "video",
          itemId: String(video._id),
          userId: viewerId,
          allowDownload: true,
        })
      : "",
    route: "",
    price: numberOrZero(video.price),
    isFree: numberOrZero(video.price) <= 0,
    canAccessFull,
    canPreview: Boolean(previewSource || streamSource),
    canStream: Boolean(streamSource),
    canDownload: Boolean(canAccessFull && toCleanString(video.videoUrl)),
    canBuy: numberOrZero(video.price) > 0 && !canAccessFull,
    viewsCount: numberOrZero(video.viewsCount),
    publishedAt: video.updatedAt || video.createdAt || video.time || null,
  };
};

const mapBookItem = ({ book, req, viewerId, ownerAccess, entitlements }) => {
  const entitlementKey = `book:${String(book._id)}`;
  const canAccessFull = ownerAccess || numberOrZero(book.price) <= 0 || entitlements.has(entitlementKey);
  const previewSource = buildBookPreviewSource(book, false);
  const streamSource = buildBookPreviewSource(book, canAccessFull);
  const bookFile = toCleanString(book.contentUrl || book.fileUrl);

  return {
    id: String(book._id),
    itemType: "book",
    mediaType: "document",
    lane: "bookPublishing",
    title: toCleanString(book.title),
    description: toCleanString(book.description),
    subtitle: [toCleanString(book.genre), toCleanString(book.fileFormat).toUpperCase()].filter(Boolean).join(" • "),
    coverUrl: toCleanString(book.coverImageUrl || book.coverUrl),
    previewUrl: buildSignedUrl({
      req,
      sourceUrl: previewSource,
      itemType: "book",
      itemId: String(book._id),
      userId: viewerId,
    }),
    streamUrl: buildSignedUrl({
      req,
      sourceUrl: streamSource,
      itemType: "book",
      itemId: String(book._id),
      userId: viewerId,
    }),
    downloadUrl: canAccessFull
      ? buildSignedUrl({
          req,
          sourceUrl: bookFile,
          itemType: "book",
          itemId: String(book._id),
          userId: viewerId,
          allowDownload: true,
        })
      : "",
    route: `/books/${String(book._id)}`,
    price: numberOrZero(book.price),
    isFree: numberOrZero(book.price) <= 0,
    canAccessFull,
    canPreview: Boolean(previewSource || streamSource),
    canStream: Boolean(streamSource),
    canDownload: Boolean(canAccessFull && bookFile),
    canBuy: numberOrZero(book.price) > 0 && !canAccessFull,
    fileFormat: toCleanString(book.fileFormat).toUpperCase(),
    language: toCleanString(book.language || ""),
    tags: Array.isArray(book.tags) ? book.tags : [],
    previewExcerptText: toCleanString(book.previewExcerptText),
    purchaseCount: numberOrZero(book.purchaseCount || book.downloadCount),
    publishedAt: book.updatedAt || book.createdAt || null,
  };
};

const inferCreatorTypesFromContent = ({ tracks = [], albums = [], videos = [], books = [], podcasts = [] }) =>
  normalizeCreatorTypes([
    tracks.length || albums.length || videos.length ? "music" : "",
    books.length ? "bookPublishing" : "",
    podcasts.length ? "podcast" : "",
  ]);

const buildFeaturedRelease = ({ tracks = [], albums = [], videos = [], books = [], podcasts = [] }) => {
  const candidates = [
    ...tracks.map((item) => ({ lane: "music", itemType: "track", item, timestamp: item.publishedAt })),
    ...albums.map((item) => ({ lane: "music", itemType: "album", item, timestamp: item.publishedAt })),
    ...videos.map((item) => ({ lane: "music", itemType: "video", item, timestamp: item.publishedAt })),
    ...podcasts.map((item) => ({ lane: "podcast", itemType: "podcast", item, timestamp: item.publishedAt })),
    ...books.map((item) => ({ lane: "bookPublishing", itemType: "book", item, timestamp: item.publishedAt })),
  ]
    .filter((entry) => entry.item)
    .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));

  if (!candidates.length) {
    return null;
  }

  const [featured] = candidates;
  return {
    lane: featured.lane,
    itemType: featured.itemType,
    headline:
      featured.itemType === "podcast"
        ? "Fresh podcast drop"
        : featured.itemType === "book"
          ? "New reading release"
          : featured.itemType === "video"
            ? "Latest video premiere"
            : "Featured release",
    item: featured.item,
  };
};

const buildStats = ({ creator, tracks = [], albums = [], videos = [], books = [], podcasts = [], purchases = [] }) => ({
  followersCount: numberOrZero(creator.followersCount),
  totalTracks: tracks.length,
  totalAlbums: albums.length,
  totalVideos: videos.length,
  totalEpisodes: podcasts.length,
  totalBooks: books.length,
  totalPlays:
    tracks.reduce((sum, item) => sum + numberOrZero(item.playsCount), 0) +
    podcasts.reduce((sum, item) => sum + numberOrZero(item.playsCount), 0) +
    albums.reduce((sum, item) => sum + numberOrZero(item.playCount), 0) +
    videos.reduce((sum, item) => sum + numberOrZero(item.viewsCount), 0),
  totalSales: purchases.length,
  revenue: purchases.reduce((sum, row) => sum + numberOrZero(row.amount), 0),
});

const buildCreatorIdentity = ({ profile, creatorTypes = [] }) => {
  const creatorUser = profile?.userId || {};
  const followersCount = Array.isArray(creatorUser.followers) ? creatorUser.followers.length : 0;

  return {
    id: String(profile?._id || ""),
    userId: String(creatorUser?._id || profile?.userId || ""),
    displayName: toCleanString(profile?.displayName || profile?.fullName || creatorUser?.name),
    username: toCleanString(creatorUser?.username),
    avatarUrl:
      typeof creatorUser?.avatar === "string"
        ? creatorUser.avatar
        : toCleanString(creatorUser?.avatar?.url),
    bannerUrl: toCleanString(profile?.heroBannerUrl || profile?.coverImageUrl),
    bio: toCleanString(profile?.bio),
    tagline: toCleanString(profile?.tagline),
    genres: Array.isArray(profile?.genres) ? profile.genres.filter(Boolean) : [],
    links: Array.isArray(profile?.links) ? profile.links.filter((entry) => entry?.url) : [],
    verified: Boolean(creatorUser?.isVerified || creatorUser?.emailVerified),
    followersCount,
    location: toCleanString(creatorUser?.country || profile?.country),
    creatorTypes,
  };
};

const buildCreatorPublicPayload = async ({ creatorId, viewerId = "", req }) => {
  const objectId = toObjectId(creatorId);
  if (!objectId) {
    const error = new Error("Invalid creator id");
    error.status = 400;
    throw error;
  }

  const profile = await CreatorProfile.findById(objectId).populate(
    "userId",
    "name username avatar followers isVerified emailVerified country"
  ).lean();

  if (!profile) {
    const error = new Error("Creator not found");
    error.status = 404;
    throw error;
  }

  const ownerAccess = String(profile?.userId?._id || profile?.userId || "") === String(viewerId || "");
  const entitlements = ownerAccess ? new Set() : await buildEntitlementSet(viewerId);

  const [tracksRaw, podcastsRaw, albumsRaw, booksRaw, videosRaw, purchases] = await Promise.all([
    Track.find({ creatorId: objectId, kind: { $in: ["music", null] }, ...ACTIVE_TRACK_FILTER })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean(),
    Track.find({ creatorId: objectId, kind: "podcast", ...ACTIVE_TRACK_FILTER })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean(),
    Album.find({ creatorId: objectId, ...ACTIVE_ALBUM_FILTER })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean(),
    Book.find({ creatorId: objectId, ...ACTIVE_BOOK_FILTER })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean(),
    Video.find({
      $or: [{ creatorProfileId: objectId }, { userId: String(profile?.userId?._id || "") }],
      ...ACTIVE_VIDEO_FILTER,
    })
      .sort({ updatedAt: -1, createdAt: -1, time: -1 })
      .lean(),
    Purchase.find({
      creatorId: objectId,
      status: "paid",
      itemType: { $in: ["track", "album", "book", "video"] },
    })
      .select("amount itemType itemId paidAt createdAt")
      .lean(),
  ]);

  const tracks = tracksRaw.map((track) =>
    mapTrackItem({ track, req, viewerId, ownerAccess, entitlements })
  );
  const podcasts = podcastsRaw.map((track) =>
    mapTrackItem({ track, req, viewerId, ownerAccess, entitlements })
  );
  const albums = albumsRaw.map((album) =>
    mapAlbumItem({ album, req, viewerId, ownerAccess, entitlements })
  );
  const videos = videosRaw.map((video) =>
    mapVideoItem({ video, req, viewerId, ownerAccess, entitlements })
  );
  const books = booksRaw.map((book) =>
    mapBookItem({ book, req, viewerId, ownerAccess, entitlements })
  );

  const creatorTypes = normalizeCreatorTypes(profile.creatorTypes).length
    ? normalizeCreatorTypes(profile.creatorTypes)
    : inferCreatorTypesFromContent({ tracks, albums, videos, books, podcasts });
  const creator = buildCreatorIdentity({ profile, creatorTypes });
  const featured = buildFeaturedRelease({ tracks, albums, videos, books, podcasts });
  const viewerFollows = Array.isArray(profile?.userId?.followers)
    ? profile.userId.followers.some((entry) => String(entry) === String(viewerId || ""))
    : false;

  return {
    creator,
    viewer: {
      isAuthenticated: Boolean(viewerId),
      isOwner: ownerAccess,
      isFollowing: viewerFollows,
    },
    featured,
    music: {
      tracks,
      albums,
      videos,
    },
    podcasts: {
      series: {
        podcastName: toCleanString(profile?.podcastsProfile?.podcastName || profile?.displayName),
        hostName: toCleanString(profile?.podcastsProfile?.hostName || profile?.displayName),
        themeOrTopic: toCleanString(profile?.podcastsProfile?.themeOrTopic),
        seriesTitle: toCleanString(profile?.podcastsProfile?.seriesTitle),
        description: toCleanString(profile?.podcastsProfile?.description),
        totalEpisodes: podcasts.length,
      },
      episodes: podcasts,
    },
    books,
    stats: buildStats({
      creator,
      tracks,
      albums,
      videos,
      books,
      podcasts,
      purchases,
    }),
  };
};

module.exports = {
  buildCreatorPublicPayload,
};
