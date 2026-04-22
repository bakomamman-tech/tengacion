const mongoose = require("mongoose");

const Album = require("../models/Album");
const Book = require("../models/Book");
const Purchase = require("../models/Purchase");
const Track = require("../models/Track");
const Video = require("../models/Video");
const { buildAlbumArchiveUrl } = require("./albumArchiveService");
const { findCreatorProfileByReference } = require("./creatorLookupService");
const {
  getLatestCreatorSubscriptionPurchase,
  getUserPaidPurchases,
} = require("./entitlementService");
const { buildSignedMediaUrl } = require("./mediaSigner");
const {
  buildCreatorIdPath,
  buildCreatorPublicPath,
  buildCreatorSubscribePath,
} = require("./publicRouteService");
const { resolveSubscriptionLifecycle } = require("./purchaseLifecycleService");
const { normalizeCreatorTypes } = require("./creatorProfileService");

const ACTIVE_TRACK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_BOOK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_ALBUM_FILTER = { status: "published", isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_VIDEO_FILTER = { isPublished: { $ne: false }, archivedAt: null };

const toCleanString = (value = "") => String(value || "").trim();

const pickFirstText = (...values) => {
  for (const value of values) {
    const normalized = toCleanString(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

const numberOrZero = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasMeaningfulCopy = (...values) =>
  values.some((value) => toCleanString(value).replace(/\s+/g, " ").length >= 24);

const buildCreatorTabPaths = ({ creatorId = "", username = "" } = {}) => ({
  home: buildCreatorPublicPath({ creatorId, username }),
  music: buildCreatorPublicPath({ creatorId, username, tab: "music" }),
  albums: buildCreatorPublicPath({ creatorId, username, tab: "albums" }),
  podcasts: buildCreatorPublicPath({ creatorId, username, tab: "podcasts" }),
  books: buildCreatorPublicPath({ creatorId, username, tab: "books" }),
});

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

const buildViewerPurchaseState = async (viewerId) => {
  if (!mongoose.Types.ObjectId.isValid(viewerId)) {
    return {
      entitlements: new Set(),
      subscriptionsByCreatorId: new Map(),
    };
  }

  const purchases = await getUserPaidPurchases(viewerId);
  const entitlements = new Set();
  const subscriptionsByCreatorId = new Map();

  purchases.forEach((row) => {
    const itemType = toCleanString(row.itemType).toLowerCase();
    const itemId = String(row.itemId || "");
    if (itemType && itemId) {
      entitlements.add(`${itemType}:${itemId}`);
    }
    if (itemType === "subscription") {
      const creatorId = toCleanString(row.creatorId || row.itemId);
      if (creatorId && !subscriptionsByCreatorId.has(creatorId)) {
        subscriptionsByCreatorId.set(creatorId, row);
      }
    }
  });

  return {
    entitlements,
    subscriptionsByCreatorId,
  };
};

const buildSubscriptionPayload = ({
  profile,
  ownerAccess = false,
  latestSubscription = null,
} = {}) => {
  if (ownerAccess) {
    return {
      price: numberOrZero(profile?.subscriptionPrice || 2000) || 2000,
      interval: "monthly",
      description:
        "Supporters unlock endless streams, premium downloads, and direct support access from the creator page.",
      purchaseId: "",
      isSubscribed: true,
      lifecycleStatus: "owner",
      lifecycleLabel: "Creator access",
      accessExpiresAt: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      refundedAt: null,
      inGracePeriod: false,
      canCancel: false,
      canRenew: false,
    };
  }

  const lifecycle = resolveSubscriptionLifecycle(latestSubscription || {});
  return {
    price: numberOrZero(profile?.subscriptionPrice || 2000) || 2000,
    interval: "monthly",
    description:
      "Supporters unlock endless streams, premium downloads, and direct support access from the creator page.",
    purchaseId: String(latestSubscription?._id || ""),
    isSubscribed: lifecycle.isSubscribed,
    lifecycleStatus: lifecycle.lifecycleStatus,
    lifecycleLabel: lifecycle.label,
    accessExpiresAt: latestSubscription?.accessExpiresAt || null,
    cancelAtPeriodEnd: lifecycle.cancelAtPeriodEnd,
    canceledAt: latestSubscription?.canceledAt || null,
    refundedAt: latestSubscription?.refundedAt || null,
    inGracePeriod: lifecycle.inGracePeriod,
    canCancel: lifecycle.canCancel,
    canRenew: lifecycle.canRenew,
  };
};

const buildTrackPreviewSource = (track, canAccessFull) => {
  if (!track) {
    return "";
  }
  if (toCleanString(track.moderationStatus) === "RESTRICTED_BLURRED" && !canAccessFull) {
    return toCleanString(track.blurPreviewUrl);
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
  if (toCleanString(video.moderationStatus) === "RESTRICTED_BLURRED" && !canAccessFull) {
    return toCleanString(video.blurPreviewUrl);
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
  if (toCleanString(book.moderationStatus) === "RESTRICTED_BLURRED" && !canAccessFull) {
    return toCleanString(book.blurPreviewUrl);
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
  if (toCleanString(album?.moderationStatus) === "RESTRICTED_BLURRED" && !canAccessFull) {
    return toCleanString(album?.blurPreviewUrl);
  }
  const firstTrack = Array.isArray(album?.tracks) ? album.tracks[0] : null;
  if (!firstTrack) {
    return "";
  }
  if (canAccessFull) {
    return toCleanString(firstTrack.trackUrl);
  }
  return toCleanString(firstTrack.previewUrl) || (numberOrZero(album?.price) <= 0 ? toCleanString(firstTrack.trackUrl) : "");
};

const mapTrackItem = ({ track, req, viewerId, ownerAccess, entitlements, creatorSubscriptionActive = false }) => {
  const isPodcast = toCleanString(track.kind).toLowerCase() === "podcast";
  const entitlementKey = `track:${String(track._id)}`;
  const canAccessFull =
    ownerAccess
    || creatorSubscriptionActive
    || numberOrZero(track.price) <= 0
    || entitlements.has(entitlementKey);
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
    coverUrl: toCleanString(
      track.moderationStatus === "RESTRICTED_BLURRED"
        ? track.blurPreviewUrl || track.coverImageUrl || track.coverUrl
        : track.coverImageUrl || track.coverUrl
    ),
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
    durationSec: numberOrZero(track.durationSec),
    previewStartSec: numberOrZero(track.previewStartSec),
    previewLimitSec: numberOrZero(track.previewLimitSec || 30),
    playsCount: numberOrZero(track.playsCount || track.playCount),
    purchaseCount: numberOrZero(track.purchaseCount),
    genre: toCleanString(track.genre),
    releaseType: toCleanString(track.releaseType || "single"),
    releaseDate: track.releaseDate || null,
    artistName: toCleanString(track.artistName),
    podcastSeries: toCleanString(track.podcastSeries),
    seasonNumber: numberOrZero(track.seasonNumber),
    episodeNumber: numberOrZero(track.episodeNumber),
    showNotes: toCleanString(track.showNotes),
    guestNames: Array.isArray(track.guestNames) ? track.guestNames.filter(Boolean) : [],
    episodeTags: Array.isArray(track.episodeTags) ? track.episodeTags.filter(Boolean) : [],
    publishedAt: track.updatedAt || track.createdAt || null,
  };
};

const mapAlbumItem = ({ album, req, viewerId, ownerAccess, entitlements, creatorSubscriptionActive = false }) => {
  const entitlementKey = `album:${String(album._id)}`;
  const canAccessFull =
    ownerAccess
    || creatorSubscriptionActive
    || numberOrZero(album.price) <= 0
    || entitlements.has(entitlementKey);
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
    coverUrl: toCleanString(
      album.moderationStatus === "RESTRICTED_BLURRED"
        ? album.blurPreviewUrl || album.coverUrl
        : album.coverUrl
    ),
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
    trackTitles: tracks.map((track) => toCleanString(track?.title)).filter(Boolean).slice(0, 6),
    publishedAt: album.updatedAt || album.createdAt || null,
  };
};

const mapVideoItem = ({ video, req, viewerId, ownerAccess, entitlements, creatorSubscriptionActive = false }) => {
  const entitlementKey = `video:${String(video._id)}`;
  const canAccessFull =
    ownerAccess
    || creatorSubscriptionActive
    || numberOrZero(video.price) <= 0
    || entitlements.has(entitlementKey);
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
    coverUrl: toCleanString(
      video.moderationStatus === "RESTRICTED_BLURRED"
        ? video.blurPreviewUrl || video.coverImageUrl
        : video.coverImageUrl
    ),
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

const mapBookItem = ({ book, req, viewerId, ownerAccess, entitlements, creatorSubscriptionActive = false }) => {
  const entitlementKey = `book:${String(book._id)}`;
  const canAccessFull =
    ownerAccess
    || creatorSubscriptionActive
    || numberOrZero(book.price) <= 0
    || entitlements.has(entitlementKey);
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
    coverUrl: toCleanString(
      book.moderationStatus === "RESTRICTED_BLURRED"
        ? book.blurPreviewUrl || book.coverImageUrl || book.coverUrl
        : book.coverImageUrl || book.coverUrl
    ),
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
    authorName: toCleanString(book.authorName),
    subtitle: toCleanString(book.subtitle),
    genre: toCleanString(book.genre),
    pageCount: numberOrZero(book.pageCount),
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

const buildLatestReleases = ({ tracks = [], albums = [], videos = [], books = [], podcasts = [] } = {}) =>
  [
    ...tracks.map((item) => ({ ...item, lane: "music", contentLabel: "Track" })),
    ...albums.map((item) => ({ ...item, lane: "music", contentLabel: "Album" })),
    ...videos.map((item) => ({ ...item, lane: "music", contentLabel: "Video" })),
    ...podcasts.map((item) => ({ ...item, lane: "podcast", contentLabel: "Podcast Episode" })),
    ...books.map((item) => ({ ...item, lane: "bookPublishing", contentLabel: "Book" })),
  ]
    .sort((left, right) => new Date(right.publishedAt || 0) - new Date(left.publishedAt || 0))
    .slice(0, 6);

const buildCreatorIdentity = ({ profile, creatorTypes = [], indexable = true }) => {
  const creatorUser = profile?.userId || {};
  const followersCount = Array.isArray(creatorUser.followers) ? creatorUser.followers.length : 0;
  const creatorId = String(profile?._id || "");
  const username = toCleanString(creatorUser?.username);
  const publicPath = buildCreatorPublicPath({ creatorId, username });
  const publicTabs = buildCreatorTabPaths({ creatorId, username });

  return {
    id: creatorId,
    userId: String(creatorUser?._id || profile?.userId || ""),
    displayName: toCleanString(profile?.displayName || profile?.fullName || creatorUser?.name),
    username,
    avatarUrl:
      typeof creatorUser?.avatar === "string"
        ? creatorUser.avatar
        : toCleanString(creatorUser?.avatar?.url),
    bannerUrl: toCleanString(profile?.heroBannerUrl || profile?.coverImageUrl),
    bio: toCleanString(profile?.bio),
    tagline: toCleanString(profile?.tagline),
    subscriptionPrice: numberOrZero(profile?.subscriptionPrice || 2000) || 2000,
    genres: Array.isArray(profile?.genres) ? profile.genres.filter(Boolean) : [],
    links: Array.isArray(profile?.links) ? profile.links.filter((entry) => entry?.url) : [],
    verified: Boolean(creatorUser?.isVerified || creatorUser?.emailVerified),
    followersCount,
    location: toCleanString(creatorUser?.country || profile?.country),
    creatorTypes,
    canonicalPath: publicPath,
    legacyPath: buildCreatorIdPath({ creatorId }),
    subscribePath: buildCreatorSubscribePath(creatorId),
    tabPaths: publicTabs,
    isIndexable: Boolean(indexable),
  };
};

const buildCreatorPublicPayload = async ({ creatorId, viewerId = "", req }) => {
  const profile = await findCreatorProfileByReference({
    creatorRef: creatorId,
    populate: "name username avatar followers isVerified emailVerified country",
    lean: true,
  });

  if (!profile) {
    const error = new Error("Creator not found");
    error.status = 404;
    throw error;
  }

  const objectId = profile._id;

  const ownerAccess = String(profile?.userId?._id || profile?.userId || "") === String(viewerId || "");
  const viewerPurchaseState = ownerAccess
    ? { entitlements: new Set(), subscriptionsByCreatorId: new Map() }
    : await buildViewerPurchaseState(viewerId);
  const entitlements = viewerPurchaseState.entitlements;
  const activeSubscription = viewerPurchaseState.subscriptionsByCreatorId.get(String(profile?._id || "")) || null;
  const latestSubscription = ownerAccess
    ? null
    : activeSubscription || await getLatestCreatorSubscriptionPurchase({
      userId: viewerId,
      creatorId: profile?._id,
    });
  const subscriptionPayload = buildSubscriptionPayload({
    profile,
    ownerAccess,
    latestSubscription,
  });
  const creatorSubscriptionActive = ownerAccess || Boolean(subscriptionPayload.isSubscribed);

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
    mapTrackItem({
      track,
      req,
      viewerId,
      ownerAccess,
      entitlements,
      creatorSubscriptionActive,
    })
  );
  const podcasts = podcastsRaw.map((track) =>
    mapTrackItem({
      track,
      req,
      viewerId,
      ownerAccess,
      entitlements,
      creatorSubscriptionActive,
    })
  );
  const albums = albumsRaw.map((album) =>
    mapAlbumItem({
      album,
      req,
      viewerId,
      ownerAccess,
      entitlements,
      creatorSubscriptionActive,
    })
  );
  const videos = videosRaw.map((video) =>
    mapVideoItem({
      video,
      req,
      viewerId,
      ownerAccess,
      entitlements,
      creatorSubscriptionActive,
    })
  );
  const books = booksRaw.map((book) =>
    mapBookItem({
      book,
      req,
      viewerId,
      ownerAccess,
      entitlements,
      creatorSubscriptionActive,
    })
  );

  const creatorTypes = normalizeCreatorTypes(profile.creatorTypes).length
    ? normalizeCreatorTypes(profile.creatorTypes)
    : inferCreatorTypesFromContent({ tracks, albums, videos, books, podcasts });
  const totalPublicItems = tracks.length + albums.length + videos.length + books.length + podcasts.length;
  const isIndexable = totalPublicItems > 0 || hasMeaningfulCopy(profile?.tagline, profile?.bio);
  const creator = buildCreatorIdentity({ profile, creatorTypes, indexable: isIndexable });
  const featured = buildFeaturedRelease({ tracks, albums, videos, books, podcasts });
  const latestReleases = buildLatestReleases({ tracks, albums, videos, books, podcasts });
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
    subscription: subscriptionPayload,
    featured,
    latestReleases,
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
    seo: {
      indexable: Boolean(isIndexable),
      canonicalPath: creator.canonicalPath,
      hasMeaningfulBio: hasMeaningfulCopy(profile?.tagline, profile?.bio),
      totalPublicItems,
      introText: pickFirstText(
        profile?.tagline,
        profile?.bio,
        `${creator.displayName} publishes across ${creatorTypes.join(", ") || "music, books, and podcasts"} on Tengacion.`
      ),
    },
  };
};

module.exports = {
  buildCreatorPublicPayload,
};
