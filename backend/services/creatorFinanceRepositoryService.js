const Purchase = require("../models/Purchase");
const WalletEntry = require("../models/WalletEntry");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const Book = require("../models/Book");
const Album = require("../models/Album");
const Video = require("../models/Video");
const { buildDateRange } = require("./analyticsService");

const PLATFORM_SHARE_PERCENT = 60;
const CREATOR_SHARE_PERCENT = 40;
const MAX_RECENT_ENTRIES = 20;
const MAX_TOP_CREATORS = 8;

const CATEGORY_META = {
  music: {
    key: "music",
    label: "Music Downloads & Stream Access",
  },
  podcasts: {
    key: "podcasts",
    label: "Podcast Streaming Earnings",
  },
  albums: {
    key: "albums",
    label: "Album Sales",
  },
  books: {
    key: "books",
    label: "Book Downloads",
  },
  videos: {
    key: "videos",
    label: "Video Unlocks",
  },
  subscriptions: {
    key: "subscriptions",
    label: "Creator Memberships",
  },
  other: {
    key: "other",
    label: "Other Creator Earnings",
  },
};

const toId = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value._id) {
    return value._id.toString();
  }
  return value.toString();
};

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const computePlatformShare = (amount) =>
  roundMoney((Number(amount || 0) * PLATFORM_SHARE_PERCENT) / 100);

const createCategoryBucket = (meta) => ({
  key: meta.key,
  label: meta.label,
  grossRevenue: 0,
  repositoryAmount: 0,
  creatorAmount: 0,
  transactions: 0,
});

const resolveTrackCategory = (track) =>
  String(track?.kind || "music").trim().toLowerCase() === "podcast" ? "podcasts" : "music";

const resolveCategoryKey = ({ purchase, tracksById }) => {
  const itemType = String(purchase?.itemType || "").trim().toLowerCase();
  if (itemType === "track") {
    return resolveTrackCategory(tracksById.get(toId(purchase?.itemId)));
  }
  if (itemType === "book") {
    return "books";
  }
  if (itemType === "album") {
    return "albums";
  }
  if (itemType === "video") {
    return "videos";
  }
  if (itemType === "subscription") {
    return "subscriptions";
  }
  return "other";
};

const resolveItemTitle = ({ purchase, tracksById, booksById, albumsById, videosById }) => {
  const itemId = toId(purchase?.itemId);
  const itemType = String(purchase?.itemType || "").trim().toLowerCase();
  if (!itemId) {
    return "Creator item";
  }
  if (itemType === "track") {
    return tracksById.get(itemId)?.title || "Audio item";
  }
  if (itemType === "book") {
    return booksById.get(itemId)?.title || "Book";
  }
  if (itemType === "album") {
    return albumsById.get(itemId)?.title || "Album";
  }
  if (itemType === "video") {
    return videosById.get(itemId)?.title || "Video";
  }
  if (itemType === "subscription") {
    return "Creator subscription";
  }
  return "Creator item";
};

const resolveCreatorDisplayName = (profile) =>
  profile?.displayName ||
  profile?.userId?.name ||
  profile?.userId?.username ||
  "Unknown Creator";

const loadLookupMaps = async (purchases = []) => {
  const creatorIds = new Set();
  const trackIds = new Set();
  const bookIds = new Set();
  const albumIds = new Set();
  const videoIds = new Set();

  purchases.forEach((purchase) => {
    const creatorId = toId(purchase?.creatorId);
    const itemId = toId(purchase?.itemId);
    const itemType = String(purchase?.itemType || "").trim().toLowerCase();

    if (creatorId) {
      creatorIds.add(creatorId);
    }

    if (!itemId) {
      return;
    }

    if (itemType === "track") {
      trackIds.add(itemId);
    } else if (itemType === "book") {
      bookIds.add(itemId);
    } else if (itemType === "album") {
      albumIds.add(itemId);
    } else if (itemType === "video") {
      videoIds.add(itemId);
    }
  });

  const [creatorProfiles, tracks, books, albums, videos] = await Promise.all([
    creatorIds.size
      ? CreatorProfile.find({ _id: { $in: Array.from(creatorIds) } })
          .select("_id displayName userId")
          .populate("userId", "name username")
          .lean()
      : Promise.resolve([]),
    trackIds.size
      ? Track.find({ _id: { $in: Array.from(trackIds) } }).select("_id title kind").lean()
      : Promise.resolve([]),
    bookIds.size
      ? Book.find({ _id: { $in: Array.from(bookIds) } }).select("_id title").lean()
      : Promise.resolve([]),
    albumIds.size
      ? Album.find({ _id: { $in: Array.from(albumIds) } }).select("_id title").lean()
      : Promise.resolve([]),
    videoIds.size
      ? Video.find({ _id: { $in: Array.from(videoIds) } }).select("_id caption").lean()
      : Promise.resolve([]),
  ]);

  return {
    creatorsById: new Map(
      creatorProfiles.map((row) => [
        toId(row?._id),
        {
          creatorId: toId(row?._id),
          displayName: resolveCreatorDisplayName(row),
          username: row?.userId?.username || "",
        },
      ])
    ),
    tracksById: new Map(
      tracks.map((row) => [
        toId(row?._id),
        {
          title: row?.title || "Audio item",
          kind: row?.kind || "music",
        },
      ])
    ),
    booksById: new Map(
      books.map((row) => [
        toId(row?._id),
        {
          title: row?.title || "Book",
        },
      ])
    ),
    albumsById: new Map(
      albums.map((row) => [
        toId(row?._id),
        {
          title: row?.title || "Album",
        },
      ])
    ),
    videosById: new Map(
      videos.map((row) => [
        toId(row?._id),
        {
          title: row?.caption || "Video",
        },
      ])
    ),
  };
};

const createEmptyResponse = (dates) => ({
  filters: {
    range: dates.range,
    startDate: dates.start.toISOString(),
    endDate: dates.end.toISOString(),
  },
  repository: {
    name: "Earnings From Creators",
    currency: "NGN",
    grossRevenue: 0,
    repositoryAmount: 0,
    creatorAmount: 0,
    paidTransactions: 0,
    activeCreators: 0,
    platformSharePercent: PLATFORM_SHARE_PERCENT,
    creatorSharePercent: CREATOR_SHARE_PERCENT,
    purpose:
      "This repository holds Tengacion's 60% share of paid creator earnings for platform operations and worldwide office expansion.",
    accountingNote:
      "Only paid creator transactions are included. Free streams and downloads remain outside the repository until monetized.",
  },
  breakdown: {
    items: [],
  },
  topCreators: [],
  recentEntries: [],
});

const loadWalletRepositoryRows = async (dates) => {
  const entries = await WalletEntry.find({
    ownerType: "platform",
    entryType: "platform_fee",
    sourceType: "purchase",
    effectiveAt: { $gte: dates.start, $lte: dates.end },
  })
    .sort({ effectiveAt: -1, createdAt: -1 })
    .select("amount grossAmount currency sourceRef effectiveAt createdAt metadata")
    .lean();

  return entries.map((entry) => ({
    _id: toId(entry?.metadata?.purchaseId || entry?._id),
    creatorId: toId(entry?.metadata?.creatorId),
    itemType: String(entry?.metadata?.itemType || "").trim().toLowerCase(),
    itemId: toId(entry?.metadata?.itemId),
    amount: roundMoney(entry?.grossAmount),
    grossAmount: roundMoney(entry?.grossAmount),
    repositoryAmount: roundMoney(entry?.amount),
    creatorAmount: roundMoney(entry?.metadata?.creatorAmount),
    currency: entry?.currency || "NGN",
    provider: entry?.metadata?.provider || "paystack",
    providerRef: entry?.sourceRef || entry?.metadata?.providerRef || "",
    paidAt: entry?.effectiveAt || null,
    createdAt: entry?.createdAt || entry?.effectiveAt || null,
  }));
};

const loadPurchaseRepositoryRows = async (dates) => {
  const purchases = await Purchase.find({
    status: "paid",
    creatorId: { $ne: null },
    paidAt: { $gte: dates.start, $lte: dates.end },
  })
    .sort({ paidAt: -1, createdAt: -1 })
    .select(
      "_id creatorId itemType itemId amount currency provider providerRef paidAt createdAt"
    )
    .lean();

  return purchases.map((purchase) => {
    const grossAmount = roundMoney(purchase?.amount);
    const repositoryAmount = computePlatformShare(grossAmount);
    return {
      ...purchase,
      grossAmount,
      repositoryAmount,
      creatorAmount: roundMoney(grossAmount - repositoryAmount),
    };
  });
};

const buildCreatorFinanceRepository = async ({
  range = "30d",
  startDate = "",
  endDate = "",
} = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  let repositoryRows = await loadWalletRepositoryRows(dates);
  if (!repositoryRows.length) {
    repositoryRows = await loadPurchaseRepositoryRows(dates);
  }

  if (!repositoryRows.length) {
    return createEmptyResponse(dates);
  }

  const { creatorsById, tracksById, booksById, albumsById, videosById } =
    await loadLookupMaps(repositoryRows);

  const breakdownMap = new Map(
    Object.values(CATEGORY_META).map((meta) => [meta.key, createCategoryBucket(meta)])
  );
  const creatorsAggregate = new Map();
  const recentEntries = [];

  let grossRevenue = 0;
  let repositoryAmount = 0;
  let creatorAmount = 0;
  let paidTransactions = 0;

  repositoryRows.forEach((purchase) => {
    const amount = roundMoney(purchase?.grossAmount || purchase?.amount);
    if (amount <= 0) {
      return;
    }

    const creatorId = toId(purchase?.creatorId);
    const creator =
      creatorsById.get(creatorId) || {
        creatorId,
        displayName: "Unknown Creator",
        username: "",
      };
    const categoryKey = resolveCategoryKey({ purchase, tracksById });
    const categoryMeta = CATEGORY_META[categoryKey] || CATEGORY_META.other;
    const itemTitle = resolveItemTitle({
      purchase,
      tracksById,
      booksById,
      albumsById,
      videosById,
    });
    const platformAllocation = roundMoney(purchase?.repositoryAmount || computePlatformShare(amount));
    const creatorAllocation = roundMoney(purchase?.creatorAmount || (amount - platformAllocation));

    paidTransactions += 1;
    grossRevenue += amount;
    repositoryAmount += platformAllocation;
    creatorAmount += creatorAllocation;

    const bucket = breakdownMap.get(categoryMeta.key);
    if (bucket) {
      bucket.grossRevenue += amount;
      bucket.repositoryAmount += platformAllocation;
      bucket.creatorAmount += creatorAllocation;
      bucket.transactions += 1;
    }

    const creatorRow = creatorsAggregate.get(creatorId) || {
      creatorId,
      displayName: creator.displayName,
      username: creator.username,
      grossRevenue: 0,
      repositoryAmount: 0,
      creatorAmount: 0,
      transactions: 0,
    };
    creatorRow.grossRevenue += amount;
    creatorRow.repositoryAmount += platformAllocation;
    creatorRow.creatorAmount += creatorAllocation;
    creatorRow.transactions += 1;
    creatorsAggregate.set(creatorId, creatorRow);

    if (recentEntries.length < MAX_RECENT_ENTRIES) {
      recentEntries.push({
        id: toId(purchase?._id),
        creatorId,
        creatorDisplayName: creator.displayName,
        creatorUsername: creator.username,
        itemType: purchase?.itemType || "",
        itemTitle,
        sourceKey: categoryMeta.key,
        sourceLabel: categoryMeta.label,
        grossAmount: amount,
        repositoryAmount: platformAllocation,
        creatorAmount: creatorAllocation,
        currency: purchase?.currency || "NGN",
        provider: purchase?.provider || "",
        providerRef: purchase?.providerRef || "",
        paidAt: purchase?.paidAt || purchase?.createdAt || null,
      });
    }
  });

  const breakdownItems = Array.from(breakdownMap.values())
    .filter((entry) => entry.transactions > 0)
    .map((entry) => ({
      ...entry,
      grossRevenue: roundMoney(entry.grossRevenue),
      repositoryAmount: roundMoney(entry.repositoryAmount),
      creatorAmount: roundMoney(entry.creatorAmount),
    }))
    .sort((a, b) => Number(b.repositoryAmount || 0) - Number(a.repositoryAmount || 0));

  const topCreators = Array.from(creatorsAggregate.values())
    .map((entry) => ({
      ...entry,
      grossRevenue: roundMoney(entry.grossRevenue),
      repositoryAmount: roundMoney(entry.repositoryAmount),
      creatorAmount: roundMoney(entry.creatorAmount),
    }))
    .sort((a, b) => Number(b.repositoryAmount || 0) - Number(a.repositoryAmount || 0))
    .slice(0, MAX_TOP_CREATORS);

  return {
    filters: {
      range: dates.range,
      startDate: dates.start.toISOString(),
      endDate: dates.end.toISOString(),
    },
    repository: {
      name: "Earnings From Creators",
      currency: "NGN",
      grossRevenue: roundMoney(grossRevenue),
      repositoryAmount: roundMoney(repositoryAmount),
      creatorAmount: roundMoney(creatorAmount),
      paidTransactions,
      activeCreators: creatorsAggregate.size,
      platformSharePercent: PLATFORM_SHARE_PERCENT,
      creatorSharePercent: CREATOR_SHARE_PERCENT,
      purpose:
        "This repository holds Tengacion's 60% share of paid creator earnings for platform operations and worldwide office expansion.",
      accountingNote:
        "Only paid creator transactions are included. Free streams and downloads remain outside the repository until monetized.",
    },
    breakdown: {
      items: breakdownItems,
    },
    topCreators,
    recentEntries,
  };
};

module.exports = {
  PLATFORM_SHARE_PERCENT,
  CREATOR_SHARE_PERCENT,
  buildCreatorFinanceRepository,
};
