const mongoose = require("mongoose");

const Album = require("../models/Album");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const User = require("../models/User");
const { buildSignedMediaUrl } = require("./mediaSigner");
const { getUserPaidPurchases } = require("./entitlementService");
const { getMediaUrl } = require("../utils/userMedia");

const ACTIVE_TRACK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_BOOK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_ALBUM_FILTER = { status: "published", isPublished: { $ne: false }, archivedAt: null };

const CATEGORY_ALIASES = {
  all: ["music", "books", "podcasts"],
  music: ["music"],
  books: ["books"],
  podcasts: ["podcasts"],
};

const DISCOVERY_TYPE_ALIASES = {
  music: ["music"],
  books: ["bookPublishing"],
  podcasts: ["podcast"],
};

const normalizeCategory = (value = "all") => {
  const lower = String(value || "all").trim().toLowerCase();
  return ["music", "books", "podcasts", "all"].includes(lower) ? lower : "all";
};

const normalizeMode = (value = "mixed") => {
  const lower = String(value || "mixed").trim().toLowerCase();
  return ["latest", "mixed", "classic"].includes(lower) ? lower : "mixed";
};

const normalizeSort = (value = "popular") => {
  const lower = String(value || "popular").trim().toLowerCase();
  return ["popular", "newest", "alphabetical"].includes(lower) ? lower : "popular";
};

const parseLimit = (value, fallback = 12) =>
  Math.max(1, Math.min(24, Number.parseInt(value, 10) || fallback));

const parsePage = (value, fallback = 1) =>
  Math.max(1, Number.parseInt(value, 10) || fallback);

const toObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }
  return new mongoose.Types.ObjectId(String(value));
};

const escapeRegExp = (value = "") =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toCleanString = (value = "") => String(value || "").trim();

const formatCurrency = (value = 0) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Free";
  }
  return `NGN ${amount.toLocaleString("en-NG")}`;
};

const formatRelativeTime = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const getCreatorTypeLabels = (creatorTypes = []) => {
  const normalized = Array.isArray(creatorTypes)
    ? creatorTypes.map((entry) => String(entry || "").trim().toLowerCase())
    : [];
  const labels = [];
  if (normalized.includes("music")) labels.push("Music");
  if (normalized.includes("bookpublishing")) labels.push("Books");
  if (normalized.includes("podcast")) labels.push("Podcasts");
  return labels;
};

const buildViewerState = async (viewerId) => {
  if (!mongoose.Types.ObjectId.isValid(viewerId)) {
    return {
      followingUserIds: new Set(),
      subscribedCreatorIds: new Set(),
      entitlementKeys: new Set(),
    };
  }

  const [viewer, purchases] = await Promise.all([
    User.findById(viewerId).select("following").lean(),
    getUserPaidPurchases(viewerId),
  ]);

  const followingUserIds = new Set(
    Array.isArray(viewer?.following) ? viewer.following.map((entry) => String(entry)) : []
  );
  const subscribedCreatorIds = new Set();
  const entitlementKeys = new Set();

  purchases.forEach((purchase) => {
    const itemType = toCleanString(purchase?.itemType).toLowerCase();
    const itemId = String(purchase?.itemId || "");
    if (itemType && itemId) {
      entitlementKeys.add(`${itemType}:${itemId}`);
    }
    if (itemType === "subscription") {
      const creatorId = toCleanString(purchase?.creatorId || purchase?.itemId);
      if (creatorId) {
        subscribedCreatorIds.add(creatorId);
      }
    }
  });

  return {
    followingUserIds,
    subscribedCreatorIds,
    entitlementKeys,
  };
};

const buildSignedPreviewUrl = ({ req, sourceUrl, itemType, itemId, viewerId }) => {
  const cleanSource = toCleanString(sourceUrl);
  if (!cleanSource) {
    return "";
  }

  return buildSignedMediaUrl({
    sourceUrl: cleanSource,
    itemType,
    itemId,
    userId: viewerId || "",
    req,
    expiresInSec: 10 * 60,
  });
};

const buildCreatorRoute = (creatorId) => `/creator/${String(creatorId || "").trim()}`;
const buildSubscribeRoute = (creatorId) =>
  `/creators/${String(creatorId || "").trim()}/subscribe`;

const resolveCreatorAvatar = (creatorProfile = {}, user = {}) =>
  toCleanString(
    creatorProfile?.coverImageUrl ||
      getMediaUrl(user?.avatar || user?.profilePic) ||
      creatorProfile?.heroBannerUrl
  );

const getCreatorProfileMeta = (creatorProfile) => {
  const user = creatorProfile?.userId || {};
  const creatorId = String(creatorProfile?._id || "").trim();
  const creatorUserId = String(user?._id || creatorProfile?.userId || "").trim();
  return {
    creatorId,
    creatorUserId,
    creatorName:
      creatorProfile?.displayName ||
      creatorProfile?.fullName ||
      user?.name ||
      "Creator",
    creatorUsername: toCleanString(user?.username || ""),
    creatorAvatar: resolveCreatorAvatar(creatorProfile, user),
    creatorBanner:
      toCleanString(creatorProfile?.heroBannerUrl || creatorProfile?.coverImageUrl) || "",
    creatorBio:
      toCleanString(creatorProfile?.tagline || creatorProfile?.bio || "") ||
      "A premium creator on Tengacion.",
    creatorTypes: getCreatorTypeLabels(creatorProfile?.creatorTypes),
    subscriptionPrice: Number(creatorProfile?.subscriptionPrice ?? 2000) || 2000,
    followerCount: Number(
      user?.followersCount ?? (Array.isArray(user?.followers) ? user.followers.length : 0)
    ) || 0,
  };
};

const scoreItem = ({ item, mode = "mixed" }) => {
  const createdAt = item.createdAt || item.updatedAt || Date.now();
  const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / (60 * 60 * 1000));
  const popularity = Math.log1p(
    Number(item.popularity || 0) +
      Number(item.purchaseCount || 0) * 4 +
      Number(item.followerCount || 0) / 10
  );
  const freshness = 1 / (1 + ageHours / 24);
  const ageBoost = Math.log1p(ageHours + 1) / 2.2;

  if (mode === "latest") {
    return Number((freshness * 12 + popularity * 2).toFixed(4));
  }

  if (mode === "classic") {
    return Number((ageBoost * 8 + popularity * 2 + freshness * 1.2).toFixed(4));
  }

  return Number((freshness * 7.5 + popularity * 3 + ageBoost * 2.4).toFixed(4));
};

const rankAndMixFeedItems = ({ items = [], mode = "mixed", limit = 12 }) => {
  const grouped = new Map();
  const creatorCounts = new Map();
  const normalizedMode = normalizeMode(mode);

  for (const item of Array.isArray(items) ? items : []) {
    const category = normalizeCategory(item?.creatorCategory || "all");
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category).push({ ...item, score: scoreItem({ item, mode: normalizedMode }) });
  }

  for (const list of grouped.values()) {
    list.sort((left, right) => {
      const scoreDelta = Number(right.score || 0) - Number(left.score || 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });
  }

  const categoryOrder =
    normalizedMode === "classic"
      ? ["books", "podcasts", "music"]
      : normalizedMode === "latest"
        ? ["music", "podcasts", "books"]
        : ["music", "books", "podcasts"];

  const selected = [];
  const overflow = [];

  const pickNext = (allowOverflow = false) => {
    for (const category of categoryOrder) {
      const list = grouped.get(category);
      if (!list || !list.length) {
        continue;
      }

      let index = -1;
      for (let i = 0; i < list.length; i += 1) {
        const candidate = list[i];
        const creatorId = String(candidate.creatorId || "");
        const count = Number(creatorCounts.get(creatorId) || 0);
        if (allowOverflow || count < 2) {
          index = i;
          break;
        }
      }

      if (index >= 0) {
        const [entry] = list.splice(index, 1);
        const creatorId = String(entry.creatorId || "");
        creatorCounts.set(creatorId, Number(creatorCounts.get(creatorId) || 0) + 1);
        return entry;
      }
    }

    return null;
  };

  while (selected.length < limit) {
    const candidate = pickNext(false);
    if (!candidate) {
      break;
    }
    selected.push(candidate);
  }

  for (const list of grouped.values()) {
    overflow.push(...list);
  }

  overflow.sort((left, right) => {
    const scoreDelta = Number(right.score || 0) - Number(left.score || 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
  });

  const combined = [...selected];
  while (combined.length < limit && overflow.length) {
    combined.push(overflow.shift());
  }

  return combined.slice(0, limit);
};

const ensureCreatorTitle = (creatorProfile, fallback = "Creator") =>
  creatorProfile?.displayName ||
  creatorProfile?.fullName ||
  creatorProfile?.userId?.name ||
  fallback;

const normalizeSummaryTrack = ({ track, viewerState, viewerId, req }) => {
  const creatorProfile = track.creatorId || {};
  const meta = getCreatorProfileMeta(creatorProfile);
  const itemId = String(track._id || "");
  const isPodcast = toCleanString(track.kind).toLowerCase() === "podcast";
  const price = Number(track.price || 0);
  const fullSource = toCleanString(track.audioUrl || track.fullAudioUrl || "");
  const previewSource =
    toCleanString(track.previewUrl) ||
    toCleanString(track.previewSampleUrl) ||
    (price <= 0 ? fullSource : "");
  const canAccessFull =
    price <= 0 ||
    viewerState.entitlementKeys.has(`track:${itemId}`) ||
    viewerState.subscribedCreatorIds.has(meta.creatorId);
  const signedPreview = previewSource
    ? buildSignedPreviewUrl({
        req,
        sourceUrl: previewSource,
        itemType: isPodcast ? "podcast" : "track",
        itemId,
        viewerId,
      })
    : "";

  return {
    id: itemId,
    contentId: itemId,
    feedItemType: isPodcast ? "podcast" : "track",
    itemType: isPodcast ? "podcast" : "track",
    mediaType: track.mediaType === "video" || track.videoUrl ? "video" : "audio",
    creatorId: meta.creatorId,
    creatorUserId: meta.creatorUserId,
    creatorName: ensureCreatorTitle(creatorProfile, meta.creatorName),
    creatorUsername: meta.creatorUsername,
    creatorAvatar: meta.creatorAvatar,
    creatorBanner: meta.creatorBanner,
    creatorCategory: isPodcast ? "podcasts" : "music",
    creatorTypeLabels: meta.creatorTypes.length ? meta.creatorTypes : [isPodcast ? "Podcasts" : "Music"],
    title: toCleanString(track.title || "Untitled release"),
    summary:
      toCleanString(track.description) ||
      toCleanString(track.genre) ||
      toCleanString(track.podcastSeries) ||
      "Fresh creator content on Tengacion.",
    coverImage:
      toCleanString(track.coverImageUrl || track.coverUrl) ||
      meta.creatorBanner ||
      meta.creatorAvatar,
    previewUrl: signedPreview,
    previewAudioUrl: signedPreview,
    audioUrl: canAccessFull
      ? buildSignedPreviewUrl({
          req,
          sourceUrl: fullSource || previewSource,
          itemType: isPodcast ? "podcast" : "track",
          itemId,
          viewerId,
        })
      : "",
    durationSec: Number(track.durationSec || 0),
    previewStartSec: Number(track.previewStartSec || 0),
    previewLimitSec: Number(track.previewLimitSec || 30),
    price,
    currency: toCleanString(track.currency || "NGN") || "NGN",
    priceLabel: formatCurrency(price),
    createdAt: track.createdAt || track.updatedAt || null,
    updatedAt: track.updatedAt || track.createdAt || null,
    timestampLabel: formatRelativeTime(track.createdAt || track.updatedAt || null),
    summaryLabel: isPodcast ? "Podcast" : "Music",
    creatorRoute: buildCreatorRoute(meta.creatorId),
    subscribeRoute: buildSubscribeRoute(meta.creatorId),
    purchaseItemType: isPodcast ? "podcast" : "track",
    purchaseItemId: itemId,
    canPreview: Boolean(previewSource || fullSource),
    canBuy:
      price > 0 &&
      !viewerState.entitlementKeys.has(`track:${itemId}`) &&
      !viewerState.subscribedCreatorIds.has(meta.creatorId),
    canFollow: Boolean(meta.creatorId),
    canSubscribe: Number(meta.subscriptionPrice || 0) > 0,
    viewerFollowing: viewerState.followingUserIds.has(meta.creatorUserId),
    viewerSubscribed: viewerState.subscribedCreatorIds.has(meta.creatorId),
    buyLabel: price > 0 ? "Buy" : "Open",
    followLabel: viewerState.followingUserIds.has(meta.creatorUserId) ? "Following" : "Follow",
    subscribeLabel: viewerState.subscribedCreatorIds.has(meta.creatorId)
      ? "Subscribed"
      : "Subscribe",
    priceValue: price,
    popularity:
      Number(track.playsCount || 0) +
      Number(track.purchaseCount || 0) * 4 +
      Number(meta.followerCount || 0) / 4,
  };
};

const normalizeSummaryAlbum = ({ album, viewerState, viewerId, req }) => {
  const creatorProfile = album.creatorId || {};
  const meta = getCreatorProfileMeta(creatorProfile);
  const itemId = String(album._id || "");
  const price = Number(album.price || 0);
  const firstTrack = Array.isArray(album.tracks) ? album.tracks[0] || null : null;
  const previewSource =
    toCleanString(firstTrack?.previewUrl) ||
    (price <= 0 ? toCleanString(firstTrack?.trackUrl) : "");
  const canAccessFull =
    price <= 0 ||
    viewerState.entitlementKeys.has(`album:${itemId}`) ||
    viewerState.subscribedCreatorIds.has(meta.creatorId);
  const signedPreview = previewSource
    ? buildSignedPreviewUrl({
        req,
        sourceUrl: previewSource,
        itemType: "album",
        itemId,
        viewerId,
      })
    : "";

  return {
    id: itemId,
    contentId: itemId,
    feedItemType: "album",
    itemType: "album",
    mediaType: "audio",
    creatorId: meta.creatorId,
    creatorUserId: meta.creatorUserId,
    creatorName: ensureCreatorTitle(creatorProfile, meta.creatorName),
    creatorUsername: meta.creatorUsername,
    creatorAvatar: meta.creatorAvatar,
    creatorBanner: meta.creatorBanner,
    creatorCategory: "music",
    creatorTypeLabels: meta.creatorTypes.length ? meta.creatorTypes : ["Music"],
    title: toCleanString(album.title || "Untitled album"),
    summary:
      toCleanString(album.description) ||
      toCleanString(firstTrack?.title) ||
      "A premium album release on Tengacion.",
    coverImage: toCleanString(album.coverUrl) || meta.creatorBanner || meta.creatorAvatar,
    previewUrl: signedPreview,
    previewAudioUrl: signedPreview,
    audioUrl: canAccessFull
      ? buildSignedPreviewUrl({
          req,
          sourceUrl: toCleanString(firstTrack?.trackUrl || previewSource),
          itemType: "album",
          itemId,
          viewerId,
        })
      : "",
    durationSec: Number(firstTrack?.duration || 0),
    previewStartSec: 0,
    previewLimitSec: 30,
    price,
    currency: toCleanString(album.currency || "NGN") || "NGN",
    priceLabel: formatCurrency(price),
    createdAt: album.createdAt || album.updatedAt || null,
    updatedAt: album.updatedAt || album.createdAt || null,
    timestampLabel: formatRelativeTime(album.createdAt || album.updatedAt || null),
    summaryLabel: "Music",
    creatorRoute: buildCreatorRoute(meta.creatorId),
    subscribeRoute: buildSubscribeRoute(meta.creatorId),
    purchaseItemType: "album",
    purchaseItemId: itemId,
    canPreview: Boolean(previewSource || firstTrack?.trackUrl),
    canBuy:
      price > 0 &&
      !viewerState.entitlementKeys.has(`album:${itemId}`) &&
      !viewerState.subscribedCreatorIds.has(meta.creatorId),
    canFollow: Boolean(meta.creatorId),
    canSubscribe: Number(meta.subscriptionPrice || 0) > 0,
    viewerFollowing: viewerState.followingUserIds.has(meta.creatorUserId),
    viewerSubscribed: viewerState.subscribedCreatorIds.has(meta.creatorId),
    buyLabel: price > 0 ? "Buy" : "Open",
    followLabel: viewerState.followingUserIds.has(meta.creatorUserId) ? "Following" : "Follow",
    subscribeLabel: viewerState.subscribedCreatorIds.has(meta.creatorId)
      ? "Subscribed"
      : "Subscribe",
    priceValue: price,
    popularity:
      Number(album.playCount || 0) +
      Number(album.purchaseCount || 0) * 4 +
      Number(meta.followerCount || 0) / 4,
  };
};

const normalizeSummaryBook = ({ book, viewerState, viewerId, req }) => {
  const creatorProfile = book.creatorId || {};
  const meta = getCreatorProfileMeta(creatorProfile);
  const itemId = String(book._id || "");
  const price = Number(book.price || 0);
  const previewSource =
    toCleanString(book.previewUrl) ||
    (book.isFreePreview ? toCleanString(book.contentUrl || book.fileUrl) : "");
  const canAccessFull =
    price <= 0 ||
    viewerState.entitlementKeys.has(`book:${itemId}`) ||
    viewerState.subscribedCreatorIds.has(meta.creatorId);

  return {
    id: itemId,
    contentId: itemId,
    feedItemType: "book",
    itemType: "book",
    mediaType: "document",
    creatorId: meta.creatorId,
    creatorUserId: meta.creatorUserId,
    creatorName: ensureCreatorTitle(creatorProfile, meta.creatorName),
    creatorUsername: meta.creatorUsername,
    creatorAvatar: meta.creatorAvatar,
    creatorBanner: meta.creatorBanner,
    creatorCategory: "books",
    creatorTypeLabels: meta.creatorTypes.length ? meta.creatorTypes : ["Books"],
    title: toCleanString(book.title || "Untitled book"),
    summary:
      toCleanString(book.description) ||
      toCleanString(book.previewExcerptText) ||
      toCleanString(book.subtitle) ||
      "A premium book release on Tengacion.",
    coverImage: toCleanString(book.coverImageUrl || book.coverUrl) || meta.creatorBanner || meta.creatorAvatar,
    previewUrl: previewSource
      ? buildSignedPreviewUrl({
          req,
          sourceUrl: previewSource,
          itemType: "book",
          itemId,
          viewerId,
        })
      : "",
    previewAudioUrl: "",
    audioUrl: canAccessFull
      ? buildSignedPreviewUrl({
          req,
          sourceUrl: toCleanString(book.contentUrl || book.fileUrl),
          itemType: "book",
          itemId,
          viewerId,
        })
      : "",
    previewExcerptText: toCleanString(book.previewExcerptText || ""),
    durationSec: 0,
    previewStartSec: 0,
    previewLimitSec: 0,
    price,
    currency: toCleanString(book.currency || "NGN") || "NGN",
    priceLabel: formatCurrency(price),
    createdAt: book.createdAt || book.updatedAt || null,
    updatedAt: book.updatedAt || book.createdAt || null,
    timestampLabel: formatRelativeTime(book.createdAt || book.updatedAt || null),
    summaryLabel: "Book",
    creatorRoute: buildCreatorRoute(meta.creatorId),
    subscribeRoute: buildSubscribeRoute(meta.creatorId),
    purchaseItemType: "book",
    purchaseItemId: itemId,
    canPreview: Boolean(previewSource || book.previewExcerptText),
    canBuy:
      price > 0 &&
      !viewerState.entitlementKeys.has(`book:${itemId}`) &&
      !viewerState.subscribedCreatorIds.has(meta.creatorId),
    canFollow: Boolean(meta.creatorId),
    canSubscribe: Number(meta.subscriptionPrice || 0) > 0,
    viewerFollowing: viewerState.followingUserIds.has(meta.creatorUserId),
    viewerSubscribed: viewerState.subscribedCreatorIds.has(meta.creatorId),
    buyLabel: price > 0 ? "Buy" : "Open",
    followLabel: viewerState.followingUserIds.has(meta.creatorUserId) ? "Following" : "Follow",
    subscribeLabel: viewerState.subscribedCreatorIds.has(meta.creatorId)
      ? "Subscribed"
      : "Subscribe",
    priceValue: price,
    popularity:
      Number(book.downloadCount || 0) +
      Number(book.purchaseCount || 0) * 4 +
      Number(meta.followerCount || 0) / 4,
  };
};

const fetchTrackRecords = async (match) =>
  Track.find(match)
    .sort({ createdAt: -1, updatedAt: -1 })
    .limit(160)
    .populate({
      path: "creatorId",
      select:
        "displayName fullName tagline bio heroBannerUrl coverImageUrl creatorTypes subscriptionPrice userId",
      populate: {
        path: "userId",
        select: "name username avatar followers followersCount isVerified emailVerified",
      },
    })
    .lean();

const fetchAlbumRecords = async () =>
  Album.find(ACTIVE_ALBUM_FILTER)
    .sort({ createdAt: -1, updatedAt: -1 })
    .limit(120)
    .populate({
      path: "creatorId",
      select:
        "displayName fullName tagline bio heroBannerUrl coverImageUrl creatorTypes subscriptionPrice userId",
      populate: {
        path: "userId",
        select: "name username avatar followers followersCount isVerified emailVerified",
      },
    })
    .lean();

const fetchBookRecords = async () =>
  Book.find(ACTIVE_BOOK_FILTER)
    .sort({ createdAt: -1, updatedAt: -1 })
    .limit(120)
    .populate({
      path: "creatorId",
      select:
        "displayName fullName tagline bio heroBannerUrl coverImageUrl creatorTypes subscriptionPrice userId",
      populate: {
        path: "userId",
        select: "name username avatar followers followersCount isVerified emailVerified",
      },
    })
    .lean();

const buildSummaryFeedCandidates = async ({ req, viewerId, category = "all" }) => {
  const normalizedCategory = normalizeCategory(category);
  const viewerState = await buildViewerState(viewerId);
  const fetches = [];

  if (CATEGORY_ALIASES[normalizedCategory].includes("music")) {
    fetches.push(fetchTrackRecords({ ...ACTIVE_TRACK_FILTER, kind: "music" }));
    fetches.push(fetchAlbumRecords());
  }
  if (CATEGORY_ALIASES[normalizedCategory].includes("books")) {
    fetches.push(fetchBookRecords());
  }
  if (CATEGORY_ALIASES[normalizedCategory].includes("podcasts")) {
    fetches.push(fetchTrackRecords({ ...ACTIVE_TRACK_FILTER, kind: "podcast" }));
  }

  const resolved = await Promise.all(fetches);
  const items = [];

  resolved.forEach((records, index) => {
    const isPodcastLane =
      normalizedCategory === "podcasts" || (CATEGORY_ALIASES[normalizedCategory].includes("podcasts") && fetches[index]?.kind === "podcast");

    records.forEach((record) => {
      if (!record?.creatorId) {
        return;
      }
      if (record._id && String(record.kind || "").toLowerCase() === "podcast") {
        items.push(normalizeSummaryTrack({ track: record, viewerState, viewerId, req }));
        return;
      }
      if (record._id && record.tracks) {
        items.push(normalizeSummaryAlbum({ album: record, viewerState, viewerId, req }));
        return;
      }
      if (record._id && record.previewExcerptText !== undefined) {
        items.push(normalizeSummaryBook({ book: record, viewerState, viewerId, req }));
        return;
      }
      if (isPodcastLane) {
        items.push(normalizeSummaryTrack({ track: record, viewerState, viewerId, req }));
      } else {
        items.push(normalizeSummaryTrack({ track: record, viewerState, viewerId, req }));
      }
    });
  });

  const deduped = new Map();
  for (const item of items) {
    const key = `${item.itemType}:${item.id}`;
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }

  return {
    viewerState,
    items: Array.from(deduped.values()),
  };
};

const buildCreatorDiscoveryDirectory = async ({
  viewerId,
  category = "all",
  search = "",
  sort = "popular",
  page = 1,
  limit = 12,
}) => {
  const normalizedCategory = normalizeCategory(category);
  const normalizedSort = normalizeSort(sort);
  const pageNumber = parsePage(page, 1);
  const pageSize = parseLimit(limit, 12);
  const offset = (pageNumber - 1) * pageSize;
  const searchNeedle = toCleanString(search).replace(/^@+/, "");
  const searchRegex = searchNeedle ? new RegExp(escapeRegExp(searchNeedle), "i") : null;
  const creatorTypes = CATEGORY_ALIASES[normalizedCategory]
    .flatMap((key) => DISCOVERY_TYPE_ALIASES[key] || [])
    .filter(Boolean);

  const viewerState = await buildViewerState(viewerId);

  const basePipeline = [
    {
      $match: {
        isCreator: true,
        ...(creatorTypes.length ? { creatorTypes: { $in: creatorTypes } } : {}),
      },
    },
    {
      $lookup: {
        from: User.collection.name,
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: {
        path: "$user",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        followerCount: {
          $size: {
            $ifNull: ["$user.followers", []],
          },
        },
        username: "$user.username",
        avatar: "$user.avatar",
        userName: "$user.name",
      },
    },
  ];

  if (searchRegex) {
    basePipeline.push({
      $match: {
        $or: [
          { displayName: searchRegex },
          { fullName: searchRegex },
          { tagline: searchRegex },
          { bio: searchRegex },
          { genres: searchRegex },
          { "musicProfile.primaryGenre": searchRegex },
          { "booksProfile.primaryGenre": searchRegex },
          { "podcastsProfile.themeOrTopic": searchRegex },
          { "podcastsProfile.podcastName": searchRegex },
          { "user.name": searchRegex },
          { "user.username": searchRegex },
        ],
      },
    });
  }

  const countPipeline = [...basePipeline, { $count: "total" }];
  const totalResult = await CreatorProfile.aggregate(countPipeline);
  const total = Number(totalResult?.[0]?.total || 0);

  const pipeline = [...basePipeline];
  if (normalizedSort === "alphabetical") {
    pipeline.push({ $sort: { displayName: 1, createdAt: -1 } });
  } else if (normalizedSort === "newest") {
    pipeline.push({ $sort: { createdAt: -1, followerCount: -1, displayName: 1 } });
  } else {
    pipeline.push({ $sort: { followerCount: -1, createdAt: -1, displayName: 1 } });
  }

  pipeline.push({ $skip: offset }, { $limit: pageSize }, { $project: { user: 0 } });

  const creators = await CreatorProfile.aggregate(pipeline);
  const creatorIds = creators.map((entry) => String(entry._id || ""));
  const objectIds = creatorIds.map((id) => toObjectId(id)).filter(Boolean);

  const [trackStats, podcastStats, bookStats, albumStats] = await Promise.all([
    Track.aggregate([
      {
        $match: {
          ...ACTIVE_TRACK_FILTER,
          kind: { $in: ["music", null] },
          creatorId: { $in: objectIds },
        },
      },
      {
        $group: {
          _id: "$creatorId",
          count: { $sum: 1 },
          latestAt: { $max: "$createdAt" },
          playsCount: { $sum: { $ifNull: ["$playsCount", 0] } },
          purchaseCount: { $sum: { $ifNull: ["$purchaseCount", 0] } },
        },
      },
    ]),
    Track.aggregate([
      {
        $match: {
          ...ACTIVE_TRACK_FILTER,
          kind: "podcast",
          creatorId: { $in: objectIds },
        },
      },
      {
        $group: {
          _id: "$creatorId",
          count: { $sum: 1 },
          latestAt: { $max: "$createdAt" },
          playsCount: { $sum: { $ifNull: ["$playsCount", 0] } },
          purchaseCount: { $sum: { $ifNull: ["$purchaseCount", 0] } },
        },
      },
    ]),
    Book.aggregate([
      {
        $match: {
          ...ACTIVE_BOOK_FILTER,
          creatorId: { $in: objectIds },
        },
      },
      {
        $group: {
          _id: "$creatorId",
          count: { $sum: 1 },
          latestAt: { $max: "$createdAt" },
          downloadCount: { $sum: { $ifNull: ["$downloadCount", 0] } },
          purchaseCount: { $sum: { $ifNull: ["$purchaseCount", 0] } },
        },
      },
    ]),
    Album.aggregate([
      {
        $match: {
          ...ACTIVE_ALBUM_FILTER,
          creatorId: { $in: objectIds },
        },
      },
      {
        $group: {
          _id: "$creatorId",
          count: { $sum: 1 },
          latestAt: { $max: "$createdAt" },
          playCount: { $sum: { $ifNull: ["$playCount", 0] } },
          purchaseCount: { $sum: { $ifNull: ["$purchaseCount", 0] } },
        },
      },
    ]),
  ]);

  const aggregateByCreator = new Map();
  const latestByCreator = new Map();

  const pushStats = (rows = [], type = "music") => {
    rows.forEach((row) => {
      const key = String(row?._id || "");
      if (!key) {
        return;
      }
      const current = aggregateByCreator.get(key) || {
        musicCount: 0,
        podcastCount: 0,
        bookCount: 0,
        totalCount: 0,
        popularity: 0,
      };
      const count = Number(row.count || 0);
      current.totalCount += count;
      if (type === "music") {
        current.musicCount += count;
        current.popularity += Number(row.playsCount || 0) + Number(row.purchaseCount || 0) * 4;
      } else if (type === "podcast") {
        current.podcastCount += count;
        current.popularity += Number(row.playsCount || 0) + Number(row.purchaseCount || 0) * 4;
      } else if (type === "book") {
        current.bookCount += count;
        current.popularity += Number(row.downloadCount || 0) + Number(row.purchaseCount || 0) * 4;
      } else if (type === "album") {
        current.musicCount += count;
        current.popularity += Number(row.playCount || 0) + Number(row.purchaseCount || 0) * 4;
      }
      aggregateByCreator.set(key, current);

      const nextLatest = row.latestAt || null;
      const existingLatest = latestByCreator.get(key);
      if (
        nextLatest &&
        (!existingLatest || new Date(nextLatest).getTime() > new Date(existingLatest).getTime())
      ) {
        latestByCreator.set(key, nextLatest);
      }
    });
  };

  pushStats(trackStats, "music");
  pushStats(podcastStats, "podcast");
  pushStats(bookStats, "book");
  pushStats(albumStats, "album");

  const items = creators.map((entry) => {
    const key = String(entry._id || "");
    const stats = aggregateByCreator.get(key) || {
      musicCount: 0,
      podcastCount: 0,
      bookCount: 0,
      totalCount: 0,
      popularity: 0,
    };
    const creatorTypesList = getCreatorTypeLabels(entry.creatorTypes || []);
    const primaryCategory =
      normalizedCategory === "books"
        ? "Books"
        : normalizedCategory === "podcasts"
          ? "Podcasts"
          : normalizedCategory === "music"
            ? "Music"
            : (creatorTypesList[0] || (stats.musicCount ? "Music" : stats.bookCount ? "Books" : "Podcasts"));
    const userId = String(entry.userId || "");
    const creatorRoute = buildCreatorRoute(key);
    const subscribeRoute = buildSubscribeRoute(key);
    const following = viewerState.followingUserIds.has(userId);
    const subscribed = viewerState.subscribedCreatorIds.has(key);

    return {
      id: key,
      creatorId: key,
      userId,
      name: entry.displayName || entry.fullName || entry.userName || "Creator",
      username: entry.username || "",
      avatar: entry.avatar || "",
      banner: entry.heroBannerUrl || entry.coverImageUrl || "",
      category: primaryCategory,
      categoryLabels: creatorTypesList.length ? creatorTypesList : [primaryCategory],
      bio: entry.tagline || entry.bio || "A creator on Tengacion.",
      followerCount: Number(entry.followerCount || 0),
      contentCount: Number(stats.totalCount || 0),
      contentCounts: {
        music: Number(stats.musicCount || 0),
        books: Number(stats.bookCount || 0),
        podcasts: Number(stats.podcastCount || 0),
      },
      popularity: Number(stats.popularity || 0) + Number(entry.followerCount || 0) / 2,
      route: creatorRoute,
      creatorRoute,
      subscribeRoute,
      following,
      subscribed,
      canSubscribe: Number(entry.subscriptionPrice || 0) > 0,
      subscriptionPrice: Number(entry.subscriptionPrice || 0),
      tagline: entry.tagline || "",
      latestContentAt:
        latestByCreator.get(key) || entry.updatedAt || entry.createdAt || null,
      createdAt: entry.createdAt || null,
      updatedAt: entry.updatedAt || null,
    };
  });

  if (normalizedSort === "popular") {
    items.sort((left, right) => {
      const followerDelta = Number(right.followerCount || 0) - Number(left.followerCount || 0);
      if (followerDelta !== 0) {
        return followerDelta;
      }
      const popDelta = Number(right.popularity || 0) - Number(left.popularity || 0);
      if (popDelta !== 0) {
        return popDelta;
      }
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
  } else if (normalizedSort === "newest") {
    items.sort((left, right) => {
      const rightTime = new Date(right.latestContentAt || right.updatedAt || right.createdAt || 0).getTime();
      const leftTime = new Date(left.latestContentAt || left.updatedAt || left.createdAt || 0).getTime();
      const delta = rightTime - leftTime;
      if (delta !== 0) {
        return delta;
      }
      return Number(right.followerCount || 0) - Number(left.followerCount || 0);
    });
  } else {
    items.sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
  }

  return {
    page: pageNumber,
    limit: pageSize,
    total,
    hasMore: offset + pageSize < total,
    items,
  };
};

const buildCreatorSummaryFeed = async ({
  req,
  viewerId,
  category = "all",
  page = 1,
  limit = 12,
  mode = "mixed",
}) => {
  const normalizedCategory = normalizeCategory(category);
  const normalizedMode = normalizeMode(mode);
  const pageNumber = parsePage(page, 1);
  const pageSize = parseLimit(limit, 12);
  const offset = (pageNumber - 1) * pageSize;
  const fetchSize = Math.min(120, Math.max(pageSize * 4, pageSize * (pageNumber + 1)));

  const { viewerState, items } = await buildSummaryFeedCandidates({
    req,
    viewerId,
    category: normalizedCategory,
  });

  const ranked = rankAndMixFeedItems({
    items,
    mode: normalizedMode,
    limit: fetchSize,
  });

  const pageItems = ranked.slice(offset, offset + pageSize).map((item) => ({
    ...item,
    viewerSubscribed: Boolean(viewerState.subscribedCreatorIds.has(item.creatorId)),
    viewerFollowing: Boolean(viewerState.followingUserIds.has(item.creatorUserId)),
    viewerHasAccess: Boolean(
      viewerState.entitlementKeys.has(`${item.purchaseItemType}:${item.purchaseItemId}`) ||
        viewerState.subscribedCreatorIds.has(item.creatorId) ||
        Number(item.price || 0) <= 0
    ),
    creatorRoute: item.creatorRoute || buildCreatorRoute(item.creatorId),
    subscribeRoute: item.subscribeRoute || buildSubscribeRoute(item.creatorId),
  }));

  return {
    page: pageNumber,
    limit: pageSize,
    mode: normalizedMode,
    category: normalizedCategory,
    total: ranked.length,
    hasMore: offset + pageSize < ranked.length,
    refreshedAt: new Date().toISOString(),
    items: pageItems,
  };
};

module.exports = {
  buildCreatorDiscoveryDirectory,
  buildCreatorSummaryFeed,
  normalizeCategory,
  normalizeMode,
  normalizeSort,
};
