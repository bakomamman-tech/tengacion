const mongoose = require("mongoose");
const DailyAnalytics = require("../models/DailyAnalytics");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const User = require("../models/User");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const Album = require("../models/Album");
const Book = require("../models/Book");
const Video = require("../models/Video");
const Purchase = require("../models/Purchase");
const Entitlement = require("../models/Entitlement");
const PaymentWebhookEvent = require("../models/PaymentWebhookEvent");
const Report = require("../models/Report");
const Message = require("../models/Message");
const Post = require("../models/Post");
const {
  buildExpiryDate,
  analyticsEventRetentionDays,
  sanitizePlainObject,
} = require("../config/storage");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ALERT_THRESHOLDS = {
  failedPayments: 5,
  uploadFailures: 3,
  loginWarnings: 5,
  unresolvedReports: 10,
};

const ENTITLEMENT_ITEM_TYPES = ["track", "book", "album", "video"];
const COMMERCE_OPS_EVENT_TYPES = [
  "purchase_record_created",
  "purchase_checkout_initialized",
  "purchase_checkout_failed",
  "purchase_verification_pending",
  "purchase_verification_failed",
  "purchase_verification_succeeded",
  "purchase_webhook_received",
  "purchase_webhook_duplicate",
  "purchase_webhook_pending",
  "purchase_webhook_failed",
  "purchase_webhook_settled",
  "purchase_access_granted",
  "purchase_entitlement_granted",
  "purchase_success",
  "purchase_failed",
  "creator_onboarding_step_completed",
];
const CREATOR_ONBOARDING_STEP_ORDER = [
  "account_created",
  "creator_lane_selected",
  "profile_ready",
  "first_upload_started",
  "first_upload_completed",
  "payment_readiness_started",
];

const formatDateKey = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const roundRate = (value = 0) =>
  Number.isFinite(Number(value)) ? Number(Number(value).toFixed(4)) : 0;

const toCounterMap = (rows = []) =>
  rows.reduce((acc, row) => {
    const key = String(row?._id || "").trim();
    if (!key || key === "null" || key === "undefined") {
      return acc;
    }
    acc[key] = Number(row?.count || 0);
    return acc;
  }, {});

const parseDateKey = (dateKey) => new Date(`${dateKey}T00:00:00.000Z`);

const startOfUtcDay = (date = new Date()) => parseDateKey(formatDateKey(date));

const endOfUtcDay = (date = new Date()) => new Date(startOfUtcDay(date).getTime() + ONE_DAY_MS - 1);

const buildDateRange = ({ range = "30d", startDate, endDate } = {}) => {
  const now = new Date();
  const normalizedRange = String(range || "30d").trim().toLowerCase();

  if (normalizedRange === "custom") {
    const start = startDate ? startOfUtcDay(new Date(startDate)) : startOfUtcDay(now);
    const end = endDate ? endOfUtcDay(new Date(endDate)) : endOfUtcDay(now);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new Error("Invalid custom date range");
    }
    return { range: "custom", start, end, startKey: formatDateKey(start), endKey: formatDateKey(end) };
  }

  const presetDays = {
    today: 1,
    "7d": 7,
    "30d": 30,
    "90d": 90,
    year: 365,
    this_year: 365,
  };

  if (!(normalizedRange in presetDays)) {
    throw new Error("Invalid range");
  }

  const end = endOfUtcDay(now);
  const days = presetDays[normalizedRange];
  const start = normalizedRange === "year" || normalizedRange === "this_year"
    ? new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0))
    : new Date(startOfUtcDay(now).getTime() - (days - 1) * ONE_DAY_MS);

  return {
    range: normalizedRange,
    start,
    end,
    startKey: formatDateKey(start),
    endKey: formatDateKey(end),
  };
};

const normalizeInterval = (interval = "daily") => {
  const normalized = String(interval || "daily").trim().toLowerCase();
  return ["daily", "weekly", "monthly"].includes(normalized) ? normalized : "daily";
};

const incrementDailyMetric = async (field, amount = 1, date = new Date()) => {
  if (!field) return null;
  return DailyAnalytics.findOneAndUpdate(
    { date: formatDateKey(date) },
    { $inc: { [field]: Number(amount) || 1 } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );
};

const aggregateEntitlementAudit = async ({ start, end } = {}) => {
  const rows = await Purchase.aggregate([
    {
      $match: {
        status: "paid",
        itemType: { $in: ENTITLEMENT_ITEM_TYPES },
        paidAt: { $gte: start, $lte: end },
      },
    },
    {
      $lookup: {
        from: Entitlement.collection.name,
        let: {
          buyerId: "$userId",
          itemType: "$itemType",
          itemId: "$itemId",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$buyerId", "$$buyerId"] },
                  { $eq: ["$itemType", "$$itemType"] },
                  { $eq: ["$itemId", "$$itemId"] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "entitlementRecords",
      },
    },
    {
      $group: {
        _id: null,
        eligiblePurchases: { $sum: 1 },
        missingEntitlements: {
          $sum: {
            $cond: [{ $gt: [{ $size: "$entitlementRecords" }, 0] }, 0, 1],
          },
        },
      },
    },
  ]).catch(() => []);

  return {
    eligiblePurchases: Number(rows[0]?.eligiblePurchases || 0),
    missingEntitlements: Number(rows[0]?.missingEntitlements || 0),
  };
};

const touchUserActivity = async ({ userId, login = false, seenAt = new Date() } = {}) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return null;
  const update = {
    $set: {
      lastSeenAt: seenAt,
      ...(login ? { lastLogin: seenAt, lastLoginAt: seenAt } : {}),
    },
  };
  return User.findByIdAndUpdate(userId, update, { returnDocument: "after" }).catch(() => null);
};

const logAnalyticsEvent = async ({
  type,
  userId = null,
  actorRole = "",
  targetId = null,
  targetType = "",
  contentType = "",
  metadata = {},
  createdAt = new Date(),
} = {}) => {
  if (!type) return null;

  const payload = {
    type: String(type).trim().slice(0, 80),
    userId: mongoose.Types.ObjectId.isValid(userId) ? userId : null,
    actorRole: String(actorRole || "").trim().toLowerCase().slice(0, 40),
    targetId: targetId || null,
    targetType: String(targetType || "").trim().toLowerCase().slice(0, 40),
    contentType: String(contentType || "").trim().toLowerCase().slice(0, 40),
    metadata: metadata && typeof metadata === "object"
      ? sanitizePlainObject(metadata, {
          maxDepth: 2,
          maxKeys: 16,
          maxStringLength: 400,
          maxArrayLength: 8,
        })
      : {},
    createdAt,
    updatedAt: createdAt,
    expiresAt: buildExpiryDate({
      createdAt,
      retentionDays: analyticsEventRetentionDays,
    }),
  };

  const event = await AnalyticsEvent.create(payload).catch(() => null);
  if (!event) return null;

  const metricMap = {
    user_registered: "newUsers",
    user_login: "totalLogins",
    post_created: "postsCount",
    song_uploaded: "songsUploaded",
    album_uploaded: "albumsUploaded",
    book_uploaded: "booksUploaded",
    podcast_uploaded: "podcastsUploaded",
    video_uploaded: "videosUploaded",
    friend_request_sent: "friendRequestsSent",
    friend_request_accepted: "friendRequestsAccepted",
    message_sent: "messagesSent",
    stream_started: "streams",
    stream_completed: "streams",
    download_completed: "downloads",
    purchase_record_created: "purchaseAttempts",
    purchase_checkout_initialized: "checkoutInitialized",
    purchase_checkout_failed: "checkoutFailures",
    purchase_success: "successfulPurchases",
    purchase_failed: "failedPurchases",
    purchase_webhook_received: "webhookEventsReceived",
    purchase_webhook_duplicate: "webhookDuplicateDeliveries",
    purchase_webhook_failed: "webhookEventsFailed",
    purchase_webhook_settled: "webhookEventsProcessed",
    purchase_entitlement_granted: "entitlementGrants",
    creator_onboarding_step_completed: "creatorOnboardingStepCompletions",
    content_reported: "reportsCount",
    upload_failed: "uploadFailuresCount",
    login_warning: "loginWarnings",
  };

  const metric = metricMap[payload.type];
  if (metric) {
    const amount = payload.type === "purchase_success"
      ? 1
      : payload.type === "purchase_failed"
        ? 1
        : 1;
    await incrementDailyMetric(metric, amount, createdAt).catch(() => null);
  }
  if (payload.type === "purchase_success") {
    await incrementDailyMetric("revenueAmount", Number(payload.metadata?.amount || 0), createdAt).catch(() => null);
  }

  return event;
};

const ACTIVE_EVENT_TYPES = [
  "user_login",
  "user_active",
  "post_created",
  "song_uploaded",
  "album_uploaded",
  "book_uploaded",
  "podcast_uploaded",
  "video_uploaded",
  "message_sent",
  "stream_started",
  "stream_completed",
  "download_completed",
  "purchase_success",
  "friend_request_sent",
  "friend_request_accepted",
];

const aggregatePostSnapshot = async ({ start, end } = {}) => {
  const rows = await Post.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $project: {
        likesCount: {
          $max: [
            { $size: { $ifNull: ["$likes", []] } },
            { $ifNull: ["$reactionsCount", 0] },
          ],
        },
        commentsCount: {
          $max: [
            { $size: { $ifNull: ["$comments", []] } },
            { $ifNull: ["$commentsCount", 0] },
          ],
        },
        sharesCount: { $ifNull: ["$shareCount", 0] },
      },
    },
    {
      $group: {
        _id: null,
        postsCount: { $sum: 1 },
        likesCount: { $sum: "$likesCount" },
        commentsCount: { $sum: "$commentsCount" },
        sharesCount: { $sum: "$sharesCount" },
      },
    },
  ]).catch(() => []);

  return {
    postsCount: Number(rows[0]?.postsCount || 0),
    likesCount: Number(rows[0]?.likesCount || 0),
    commentsCount: Number(rows[0]?.commentsCount || 0),
    sharesCount: Number(rows[0]?.sharesCount || 0),
  };
};

const computeDailySummary = async ({ date = new Date() } = {}) => {
  const dateKey = formatDateKey(date);
  const start = startOfUtcDay(date);
  const end = endOfUtcDay(date);
  const monthAgo = new Date(end.getTime() - 29 * ONE_DAY_MS);

  const [
    newUsers,
    creatorAccounts,
    totalLogins,
    activeUsersRows,
    songsUploaded,
    podcastsUploaded,
    albumsUploaded,
    booksUploaded,
    videosUploaded,
    postSummary,
    messagesSent,
    reportsCount,
    purchaseSummary,
    failedPurchases,
    purchaseAttempts,
    checkoutInitialized,
    checkoutFailures,
    webhookEventsReceived,
    webhookStatusRows,
    webhookDuplicateRows,
    entitlementGrants,
    entitlementAudit,
    streams,
    downloads,
    friendRequestsSent,
    friendRequestsAccepted,
    uploadFailures,
    loginWarnings,
    dau,
    mau,
  ] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    CreatorProfile.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    AnalyticsEvent.countDocuments({ type: "user_login", createdAt: { $gte: start, $lte: end } }),
    AnalyticsEvent.aggregate([
      { $match: { type: { $in: ACTIVE_EVENT_TYPES }, createdAt: { $gte: start, $lte: end }, userId: { $ne: null } } },
      { $group: { _id: "$userId" } },
      { $count: "count" },
    ]),
    Track.countDocuments({ kind: { $ne: "podcast" }, createdAt: { $gte: start, $lte: end }, archivedAt: null }),
    Track.countDocuments({ kind: "podcast", createdAt: { $gte: start, $lte: end }, archivedAt: null }),
    Album.countDocuments({ createdAt: { $gte: start, $lte: end }, archivedAt: null }),
    Book.countDocuments({ createdAt: { $gte: start, $lte: end }, archivedAt: null }),
    Video.countDocuments({ time: { $gte: start, $lte: end }, archivedAt: null }),
    aggregatePostSnapshot({ start, end }),
    Message.countDocuments({ createdAt: { $gte: start, $lte: end } }).catch(() => 0),
    Report.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Purchase.aggregate([
      { $match: { status: "paid", paidAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$amount" } } },
    ]),
    Purchase.countDocuments({ status: "failed", updatedAt: { $gte: start, $lte: end } }),
    Purchase.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    AnalyticsEvent.countDocuments({ type: "purchase_checkout_initialized", createdAt: { $gte: start, $lte: end } }),
    AnalyticsEvent.countDocuments({ type: "purchase_checkout_failed", createdAt: { $gte: start, $lte: end } }),
    PaymentWebhookEvent.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    PaymentWebhookEvent.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).catch(() => []),
    PaymentWebhookEvent.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, count: { $sum: "$duplicateCount" } } },
    ]).catch(() => []),
    AnalyticsEvent.countDocuments({ type: "purchase_entitlement_granted", createdAt: { $gte: start, $lte: end } }),
    aggregateEntitlementAudit({ start, end }),
    AnalyticsEvent.countDocuments({ type: { $in: ["stream_started", "stream_completed"] }, createdAt: { $gte: start, $lte: end } }),
    AnalyticsEvent.countDocuments({ type: "download_completed", createdAt: { $gte: start, $lte: end } }),
    AnalyticsEvent.countDocuments({ type: "friend_request_sent", createdAt: { $gte: start, $lte: end } }),
    AnalyticsEvent.countDocuments({ type: "friend_request_accepted", createdAt: { $gte: start, $lte: end } }),
    AnalyticsEvent.countDocuments({ type: "upload_failed", createdAt: { $gte: start, $lte: end } }),
    AnalyticsEvent.countDocuments({ type: "login_warning", createdAt: { $gte: start, $lte: end } }),
    User.countDocuments({ $or: [{ lastLogin: { $gte: start, $lte: end } }, { lastLoginAt: { $gte: start, $lte: end } }] }),
    User.countDocuments({ $or: [{ lastLogin: { $gte: monthAgo, $lte: end } }, { lastLoginAt: { $gte: monthAgo, $lte: end } }] }),
  ]);

  const purchaseRow = purchaseSummary[0] || {};
  const webhookStatusCounts = toCounterMap(webhookStatusRows);
  const postInteractionsCount =
    Number(postSummary.likesCount || 0) +
    Number(postSummary.commentsCount || 0) +
    Number(postSummary.sharesCount || 0);

  return DailyAnalytics.findOneAndUpdate(
    { date: dateKey },
    {
      $set: {
        dau: Number(dau) || 0,
        mau: Number(mau) || 0,
        newUsers: Number(newUsers) || 0,
        activeUsers: Number(activeUsersRows[0]?.count || 0),
        totalLogins: Number(totalLogins) || 0,
        creatorAccounts: Number(creatorAccounts) || 0,
        songsUploaded: Number(songsUploaded) || 0,
        albumsUploaded: Number(albumsUploaded) || 0,
        booksUploaded: Number(booksUploaded) || 0,
        podcastsUploaded: Number(podcastsUploaded) || 0,
        videosUploaded: Number(videosUploaded) || 0,
        postsCount: Number(postSummary.postsCount) || 0,
        commentsCount: Number(postSummary.commentsCount) || 0,
        postLikesCount: Number(postSummary.likesCount) || 0,
        postSharesCount: Number(postSummary.sharesCount) || 0,
        postInteractionsCount,
        messagesSent: Number(messagesSent) || 0,
        downloads: Number(downloads) || 0,
        streams: Number(streams) || 0,
        friendRequestsSent: Number(friendRequestsSent) || 0,
        friendRequestsAccepted: Number(friendRequestsAccepted) || 0,
        purchaseAttempts: Number(purchaseAttempts) || 0,
        checkoutInitialized: Number(checkoutInitialized) || 0,
        checkoutFailures: Number(checkoutFailures) || 0,
        successfulPurchases: Number(purchaseRow.count || 0),
        failedPurchases: Number(failedPurchases) || 0,
        revenueAmount: Number(purchaseRow.revenue || 0),
        webhookEventsReceived: Number(webhookEventsReceived) || 0,
        webhookEventsProcessed: Number(webhookStatusCounts.processed || 0),
        webhookEventsSkipped: Number(webhookStatusCounts.skipped || 0),
        webhookEventsFailed: Number(webhookStatusCounts.failed || 0),
        webhookDuplicateDeliveries: Number(webhookDuplicateRows[0]?.count || 0),
        entitlementGrants: Number(entitlementGrants) || 0,
        entitlementGrantFailures: Number(entitlementAudit?.missingEntitlements || 0),
        reportsCount: Number(reportsCount) || 0,
        uploadFailuresCount: Number(uploadFailures) || 0,
        loginWarnings: Number(loginWarnings) || 0,
      },
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );
};

const recomputeUserStats = async ({ date = new Date() } = {}) => computeDailySummary({ date });

const inFlightDailySummaries = new Map();

const queueDailySummary = ({ date, force = false } = {}) => {
  const key = formatDateKey(date);
  if (!force && inFlightDailySummaries.has(key)) {
    return inFlightDailySummaries.get(key);
  }

  const job = computeDailySummary({ date }).finally(() => {
    inFlightDailySummaries.delete(key);
  });

  inFlightDailySummaries.set(key, job);
  return job;
};

const ensureDailySummaries = async ({ start, end, force = false } = {}) => {
  const normalizedStart = startOfUtcDay(start || new Date());
  const normalizedEnd = startOfUtcDay(end || new Date());

  let existingKeys = new Set();
  if (!force) {
    const existingRows = await DailyAnalytics.find({
      date: { $gte: formatDateKey(normalizedStart), $lte: formatDateKey(normalizedEnd) },
    })
      .select("date -_id")
      .lean();
    existingKeys = new Set(existingRows.map((row) => row.date));
  }

  const work = [];
  for (
    let cursor = normalizedStart;
    cursor <= normalizedEnd;
    cursor = new Date(cursor.getTime() + ONE_DAY_MS)
  ) {
    const key = formatDateKey(cursor);
    if (!force && existingKeys.has(key)) {
      continue;
    }
    work.push(queueDailySummary({ date: cursor, force }));
  }

  return Promise.all(work);
};

const groupSeries = (rows, interval = "daily") => {
  const normalized = normalizeInterval(interval);
  if (normalized === "daily") return rows;

  const grouped = new Map();
  for (const row of rows) {
    const date = parseDateKey(row.date);
    let key = row.date;
    if (normalized === "weekly") {
      const day = date.getUTCDay() || 7;
      const weekStart = new Date(date.getTime() - (day - 1) * ONE_DAY_MS);
      key = formatDateKey(weekStart);
    }
    if (normalized === "monthly") {
      key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    const existing = grouped.get(key) || { date: key };
    for (const [field, value] of Object.entries(row)) {
      if (field === "_id" || field === "date" || field === "createdAt" || field === "updatedAt" || field === "__v") continue;
      existing[field] = (Number(existing[field]) || 0) + (Number(value) || 0);
    }
    grouped.set(key, existing);
  }
  return Array.from(grouped.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

const fetchDailyRows = async ({ start, end, interval = "daily" } = {}) => {
  await ensureDailySummaries({ start, end });
  const docs = await DailyAnalytics.find({
    date: { $gte: formatDateKey(start), $lte: formatDateKey(end) },
  })
    .sort({ date: 1 })
    .lean();
  return groupSeries(docs, interval);
};

const buildOverview = async ({ range, startDate, endDate, category = "all", interval = "daily" } = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const [series, totalUsers, totalCreatorAccounts, totalSongs, totalAlbums, totalVideos, totalPodcasts, totalBooks, totalPosts, monthlyRevenue] = await Promise.all([
    fetchDailyRows({ start: dates.start, end: dates.end, interval }),
    User.countDocuments({ isDeleted: { $ne: true } }),
    CreatorProfile.countDocuments({ isCreator: true }),
    Track.countDocuments({ kind: { $ne: "podcast" }, archivedAt: null }),
    Album.countDocuments({ archivedAt: null }),
    Video.countDocuments({ archivedAt: null }),
    Track.countDocuments({ kind: "podcast", archivedAt: null }),
    Book.countDocuments({ archivedAt: null }),
    Post.countDocuments({}).catch(() => 0),
    Purchase.aggregate([
      { $match: { status: "paid", paidAt: { $gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)), $lte: new Date() } } },
      { $group: { _id: null, revenue: { $sum: "$amount" } } },
    ]),
  ]);

  const latest = series[series.length - 1] || {};
  return {
    filters: { range: dates.range, startDate: dates.start, endDate: dates.end, category: String(category || "all"), interval: normalizeInterval(interval) },
    summary: {
      totalUsers,
      newUsersToday: Number(latest.newUsers || 0),
      activeUsersToday: Number(latest.activeUsers || latest.dau || 0),
      totalCreatorAccounts,
      totalSongs,
      totalAlbums,
      totalVideos,
      totalPodcasts,
      totalBooks,
      totalPosts,
      revenueThisMonth: Number(monthlyRevenue[0]?.revenue || 0),
      downloadsToday: Number(latest.downloads || 0),
      streamsToday: Number(latest.streams || 0),
    },
    series,
  };
};

const buildUserGrowth = async ({ range, startDate, endDate, interval = "daily" } = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const series = await fetchDailyRows({ start: dates.start, end: dates.end, interval });
  return {
    interval: normalizeInterval(interval),
    series: series.map((row) => ({ date: row.date, newUsers: Number(row.newUsers || 0), activeUsers: Number(row.activeUsers || row.dau || 0), totalLogins: Number(row.totalLogins || 0) })),
  };
};

const buildContentUploads = async ({ range, startDate, endDate, interval = "daily", category = "all" } = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const series = await fetchDailyRows({ start: dates.start, end: dates.end, interval });
  return {
    interval: normalizeInterval(interval),
    category: String(category || "all"),
    series: series.map((row) => ({
      date: row.date,
      songs: Number(row.songsUploaded || 0),
      albums: Number(row.albumsUploaded || 0),
      books: Number(row.booksUploaded || 0),
      podcasts: Number(row.podcastsUploaded || 0),
      videos: Number(row.videosUploaded || 0),
    })),
  };
};

const buildRevenueAnalytics = async ({ range, startDate, endDate, interval = "daily" } = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const series = await fetchDailyRows({ start: dates.start, end: dates.end, interval });
  return {
    interval: normalizeInterval(interval),
    series: series.map((row) => ({
      date: row.date,
      revenue: Number(row.revenueAmount || 0),
      purchaseAttempts: Number(row.purchaseAttempts || 0),
      checkoutInitialized: Number(row.checkoutInitialized || 0),
      checkoutFailures: Number(row.checkoutFailures || 0),
      successfulPurchases: Number(row.successfulPurchases || 0),
      failedPurchases: Number(row.failedPurchases || 0),
      webhookEventsReceived: Number(row.webhookEventsReceived || 0),
      webhookEventsProcessed: Number(row.webhookEventsProcessed || 0),
      webhookEventsSkipped: Number(row.webhookEventsSkipped || 0),
      webhookEventsFailed: Number(row.webhookEventsFailed || 0),
      webhookDuplicateDeliveries: Number(row.webhookDuplicateDeliveries || 0),
      entitlementGrants: Number(row.entitlementGrants || 0),
      entitlementGrantFailures: Number(row.entitlementGrantFailures || 0),
    })),
  };
};

const buildCommerceSeriesSkeleton = ({ start, end } = {}) => {
  const rows = new Map();
  for (
    let cursor = startOfUtcDay(start || new Date());
    cursor <= startOfUtcDay(end || new Date());
    cursor = new Date(cursor.getTime() + ONE_DAY_MS)
  ) {
    const date = formatDateKey(cursor);
    rows.set(date, {
      date,
      purchaseAttempts: 0,
      checkoutInitialized: 0,
      checkoutFailures: 0,
      successfulPurchases: 0,
      failedPurchases: 0,
      webhookReceived: 0,
      webhookProcessed: 0,
      webhookSkipped: 0,
      webhookFailures: 0,
      webhookReplays: 0,
      entitlementGrants: 0,
      entitlementGrantFailures: 0,
      onboardingStepCompletions: 0,
    });
  }
  return rows;
};

const addSeriesCount = (seriesMap, date, field, count = 0) => {
  if (!date || !field) return;
  const row = seriesMap.get(date);
  if (!row) return;
  row[field] = Number(row[field] || 0) + Number(count || 0);
};

const setSeriesMax = (seriesMap, date, field, count = 0) => {
  if (!date || !field) return;
  const row = seriesMap.get(date);
  if (!row) return;
  row[field] = Math.max(Number(row[field] || 0), Number(count || 0));
};

const buildCommerceOperationsAnalytics = async ({
  range,
  startDate,
  endDate,
  interval = "daily",
} = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const normalizedInterval = normalizeInterval(interval);

  const [
    eventCountRows,
    eventSeriesRows,
    purchaseCreatedRows,
    paidPurchaseRows,
    failedPurchaseRows,
    webhookStatusRows,
    webhookProviderRows,
    webhookSeriesRows,
    webhookDuplicateRows,
    entitlementAudit,
    onboardingStepRows,
  ] = await Promise.all([
    AnalyticsEvent.aggregate([
      {
        $match: {
          type: { $in: COMMERCE_OPS_EVENT_TYPES },
          createdAt: { $gte: dates.start, $lte: dates.end },
        },
      },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]).catch(() => []),
    AnalyticsEvent.aggregate([
      {
        $match: {
          type: { $in: COMMERCE_OPS_EVENT_TYPES },
          createdAt: { $gte: dates.start, $lte: dates.end },
        },
      },
      {
        $project: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          type: "$type",
          contentType: "$contentType",
        },
      },
      {
        $group: {
          _id: { date: "$date", type: "$type", contentType: "$contentType" },
          count: { $sum: 1 },
        },
      },
    ]).catch(() => []),
    Purchase.aggregate([
      { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
      {
        $project: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        },
      },
      { $group: { _id: "$date", count: { $sum: 1 } } },
    ]).catch(() => []),
    Purchase.aggregate([
      { $match: { status: "paid", paidAt: { $gte: dates.start, $lte: dates.end } } },
      {
        $project: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
        },
      },
      { $group: { _id: "$date", count: { $sum: 1 } } },
    ]).catch(() => []),
    Purchase.aggregate([
      { $match: { status: "failed", updatedAt: { $gte: dates.start, $lte: dates.end } } },
      {
        $project: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
        },
      },
      { $group: { _id: "$date", count: { $sum: 1 } } },
    ]).catch(() => []),
    PaymentWebhookEvent.aggregate([
      { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).catch(() => []),
    PaymentWebhookEvent.aggregate([
      { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
      { $group: { _id: "$provider", count: { $sum: 1 } } },
    ]).catch(() => []),
    PaymentWebhookEvent.aggregate([
      { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
      {
        $project: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          status: "$status",
          duplicateCount: "$duplicateCount",
        },
      },
      {
        $group: {
          _id: { date: "$date", status: "$status" },
          count: { $sum: 1 },
          duplicates: { $sum: "$duplicateCount" },
        },
      },
    ]).catch(() => []),
    PaymentWebhookEvent.aggregate([
      { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
      { $group: { _id: null, count: { $sum: "$duplicateCount" } } },
    ]).catch(() => []),
    aggregateEntitlementAudit({ start: dates.start, end: dates.end }),
    AnalyticsEvent.aggregate([
      {
        $match: {
          type: "creator_onboarding_step_completed",
          createdAt: { $gte: dates.start, $lte: dates.end },
        },
      },
      { $group: { _id: "$contentType", count: { $sum: 1 } } },
    ]).catch(() => []),
  ]);

  const eventCounts = toCounterMap(eventCountRows);
  const webhookStatusCounts = toCounterMap(webhookStatusRows);
  const webhookProviderCounts = toCounterMap(webhookProviderRows);
  const onboardingStepCounts = toCounterMap(onboardingStepRows);
  const purchaseAttemptsFromRecords = purchaseCreatedRows.reduce(
    (total, row) => total + Number(row?.count || 0),
    0
  );
  const paidPurchasesFromRecords = paidPurchaseRows.reduce(
    (total, row) => total + Number(row?.count || 0),
    0
  );
  const failedPurchasesFromRecords = failedPurchaseRows.reduce(
    (total, row) => total + Number(row?.count || 0),
    0
  );

  const seriesMap = buildCommerceSeriesSkeleton({ start: dates.start, end: dates.end });

  for (const row of eventSeriesRows) {
    const type = String(row?._id?.type || "");
    const date = String(row?._id?.date || "");
    const count = Number(row?.count || 0);
    if (type === "purchase_record_created") addSeriesCount(seriesMap, date, "purchaseAttempts", count);
    if (type === "purchase_checkout_initialized") addSeriesCount(seriesMap, date, "checkoutInitialized", count);
    if (type === "purchase_checkout_failed") addSeriesCount(seriesMap, date, "checkoutFailures", count);
    if (type === "purchase_success") addSeriesCount(seriesMap, date, "successfulPurchases", count);
    if (type === "purchase_failed") addSeriesCount(seriesMap, date, "failedPurchases", count);
    if (type === "purchase_webhook_received") addSeriesCount(seriesMap, date, "webhookReceived", count);
    if (type === "purchase_webhook_settled") addSeriesCount(seriesMap, date, "webhookProcessed", count);
    if (type === "purchase_webhook_pending") addSeriesCount(seriesMap, date, "webhookSkipped", count);
    if (type === "purchase_webhook_failed") addSeriesCount(seriesMap, date, "webhookFailures", count);
    if (type === "purchase_webhook_duplicate") addSeriesCount(seriesMap, date, "webhookReplays", count);
    if (type === "purchase_entitlement_granted") addSeriesCount(seriesMap, date, "entitlementGrants", count);
    if (type === "creator_onboarding_step_completed") addSeriesCount(seriesMap, date, "onboardingStepCompletions", count);
  }

  for (const row of purchaseCreatedRows) {
    setSeriesMax(seriesMap, String(row?._id || ""), "purchaseAttempts", row?.count || 0);
  }
  for (const row of paidPurchaseRows) {
    setSeriesMax(seriesMap, String(row?._id || ""), "successfulPurchases", row?.count || 0);
  }
  for (const row of failedPurchaseRows) {
    setSeriesMax(seriesMap, String(row?._id || ""), "failedPurchases", row?.count || 0);
  }
  const webhookTotalsByDate = new Map();
  for (const row of webhookSeriesRows) {
    const date = String(row?._id?.date || "");
    const status = String(row?._id?.status || "");
    const count = Number(row?.count || 0);
    webhookTotalsByDate.set(date, Number(webhookTotalsByDate.get(date) || 0) + count);
    if (status === "processed") addSeriesCount(seriesMap, date, "webhookProcessed", count);
    if (status === "skipped") addSeriesCount(seriesMap, date, "webhookSkipped", count);
    if (status === "failed") addSeriesCount(seriesMap, date, "webhookFailures", count);
    if (Number(row?.duplicates || 0) > 0) addSeriesCount(seriesMap, date, "webhookReplays", row.duplicates);
  }
  for (const [date, count] of webhookTotalsByDate.entries()) {
    setSeriesMax(seriesMap, date, "webhookReceived", count);
  }

  const purchaseAttempts = Math.max(
    purchaseAttemptsFromRecords,
    Number(eventCounts.purchase_record_created || 0),
    Number(eventCounts.purchase_checkout_initialized || 0) +
      Number(eventCounts.purchase_checkout_failed || 0)
  );
  const checkoutInitialized = Number(eventCounts.purchase_checkout_initialized || 0);
  const checkoutFailures = Number(eventCounts.purchase_checkout_failed || 0);
  const successfulPurchases = Math.max(
    paidPurchasesFromRecords,
    Number(eventCounts.purchase_success || 0),
    Number(eventCounts.purchase_verification_succeeded || 0)
  );
  const failedPurchases = Math.max(
    failedPurchasesFromRecords,
    Number(eventCounts.purchase_failed || 0),
    Number(eventCounts.purchase_verification_failed || 0),
    checkoutFailures,
    Number(eventCounts.purchase_webhook_failed || 0)
  );
  const webhookReceived = Math.max(
    Object.values(webhookStatusCounts).reduce((total, value) => total + Number(value || 0), 0),
    Number(eventCounts.purchase_webhook_received || 0)
  );
  const webhookFailures = Math.max(
    Number(webhookStatusCounts.failed || 0),
    Number(eventCounts.purchase_webhook_failed || 0)
  );
  const webhookReplays = Math.max(
    Number(webhookDuplicateRows[0]?.count || 0),
    Number(eventCounts.purchase_webhook_duplicate || 0)
  );
  const entitlementEligiblePurchases = Number(entitlementAudit?.eligiblePurchases || 0);
  const entitlementGrantFailures = Number(entitlementAudit?.missingEntitlements || 0);
  const entitlementGrants = Number(eventCounts.purchase_entitlement_granted || 0);
  const onboardingStepCompletions = Number(eventCounts.creator_onboarding_step_completed || 0);
  const onboardingStarts = Number(onboardingStepCounts.account_created || 0);
  const profileReady = Number(onboardingStepCounts.profile_ready || 0);
  const firstUploadStarted = Number(onboardingStepCounts.first_upload_started || 0);
  const firstUploadCompleted = Number(onboardingStepCounts.first_upload_completed || 0);

  const purchaseFailureRate = roundRate(
    purchaseAttempts > 0 ? failedPurchases / purchaseAttempts : 0
  );
  const purchaseSuccessRate = roundRate(
    purchaseAttempts > 0 ? successfulPurchases / purchaseAttempts : 0
  );
  const entitlementContinuityRate = roundRate(
    entitlementEligiblePurchases > 0
      ? (entitlementEligiblePurchases - entitlementGrantFailures) / entitlementEligiblePurchases
      : 0
  );
  const firstUploadCompletionRate = roundRate(
    firstUploadStarted > 0 ? firstUploadCompleted / firstUploadStarted : 0
  );

  const actions = [];
  if (purchaseAttempts >= 3 && purchaseFailureRate >= 0.25) {
    actions.push({
      key: "purchase_failure_rate",
      severity: purchaseFailureRate >= 0.5 ? "high" : "medium",
      title: "Audit failed checkout and verification events",
      actionPath: "/admin/transactions",
    });
  }
  if (webhookFailures > 0 || webhookReplays >= 3) {
    actions.push({
      key: "webhook_outcomes",
      severity: webhookFailures > 0 ? "high" : "medium",
      title: "Review webhook failures and replay diagnostics",
      actionPath: "/admin/transactions",
    });
  }
  if (entitlementGrantFailures > 0) {
    actions.push({
      key: "entitlement_continuity",
      severity: "high",
      title: "Reconcile paid purchases missing entitlement records",
      actionPath: "/admin/transactions?attention=stuck",
    });
  }
  if (onboardingStarts > 0 && firstUploadStarted === 0) {
    actions.push({
      key: "creator_activation",
      severity: "medium",
      title: "Investigate creators who register but do not start first upload",
      actionPath: "/admin/analytics",
    });
  }

  return {
    filters: {
      range: dates.range,
      startDate: dates.start,
      endDate: dates.end,
      interval: normalizedInterval,
    },
    summary: {
      purchaseAttempts,
      checkoutInitialized,
      checkoutFailures,
      successfulPurchases,
      failedPurchases,
      purchaseSuccessRate,
      purchaseFailureRate,
      webhookReceived,
      webhookProcessed: Number(webhookStatusCounts.processed || 0),
      webhookSkipped: Number(webhookStatusCounts.skipped || 0),
      webhookFailures,
      webhookReplays,
      entitlementEligiblePurchases,
      entitlementGrants,
      entitlementGrantFailures,
      entitlementContinuityRate,
      onboardingStepCompletions,
      onboardingStarts,
      profileReady,
      firstUploadStarted,
      firstUploadCompleted,
      firstUploadCompletionRate,
    },
    webhooks: {
      statusCounts: {
        received: Number(webhookStatusCounts.received || 0),
        processed: Number(webhookStatusCounts.processed || 0),
        skipped: Number(webhookStatusCounts.skipped || 0),
        failed: Number(webhookStatusCounts.failed || 0),
      },
      providerCounts: {
        paystack: Number(webhookProviderCounts.paystack || 0),
        stripe: Number(webhookProviderCounts.stripe || 0),
      },
    },
    onboarding: {
      steps: CREATOR_ONBOARDING_STEP_ORDER.map((key) => ({
        key,
        count: Number(onboardingStepCounts[key] || 0),
      })),
    },
    series: groupSeries(
      Array.from(seriesMap.values()).sort((left, right) => left.date.localeCompare(right.date)),
      normalizedInterval
    ),
    actions,
  };
};

const buildEngagementAnalytics = async ({ range, startDate, endDate, interval = "daily" } = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const series = await fetchDailyRows({ start: dates.start, end: dates.end, interval });
  return {
    interval: normalizeInterval(interval),
    series: series.map((row) => ({
      date: row.date,
      postsCount: Number(row.postsCount || 0),
      likes: Number(row.postLikesCount || 0),
      comments: Number(row.commentsCount || 0),
      shares: Number(row.postSharesCount || 0),
      postInteractions: Number(row.postInteractionsCount || 0),
      downloads: Number(row.downloads || 0),
      streams: Number(row.streams || 0),
      messagesSent: Number(row.messagesSent || 0),
      friendRequestsSent: Number(row.friendRequestsSent || 0),
      friendRequestsAccepted: Number(row.friendRequestsAccepted || 0),
    })),
  };
};

const buildMessagesOverview = async ({ range, startDate, endDate, interval = "daily" } = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const [series, totalMessages, unreadMessages, readMessages, activeSendersRows, conversationRows] =
    await Promise.all([
      fetchDailyRows({ start: dates.start, end: dates.end, interval }),
      Message.countDocuments({ createdAt: { $gte: dates.start, $lte: dates.end } }),
      Message.countDocuments({
        createdAt: { $gte: dates.start, $lte: dates.end },
        status: { $in: ["sent", "delivered"] },
      }),
      Message.countDocuments({
        createdAt: { $gte: dates.start, $lte: dates.end },
        status: "read",
      }),
      Message.aggregate([
        { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
        { $group: { _id: "$senderId" } },
        { $count: "count" },
      ]),
      Message.aggregate([
        { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$conversationId",
            messagesCount: { $sum: 1 },
            lastMessageAt: { $first: "$createdAt" },
            lastPreview: { $first: "$text" },
            lastSenderName: { $first: "$senderName" },
            senders: { $addToSet: "$senderId" },
            receivers: { $addToSet: "$receiverId" },
          },
        },
        { $sort: { lastMessageAt: -1 } },
        { $limit: 8 },
      ]),
    ]);

  const participantIds = Array.from(
    new Set(
      conversationRows
        .flatMap((row) => [...(row.senders || []), ...(row.receivers || [])])
        .map((entry) => String(entry || ""))
        .filter(Boolean)
    )
  );

  const users = participantIds.length
    ? await User.find({ _id: { $in: participantIds } }).select("name").lean()
    : [];
  const userNameMap = new Map(users.map((row) => [String(row._id), row.name || "Unknown user"]));

  const recentConversations = conversationRows.map((row) => {
    const participants = Array.from(
      new Set([...(row.senders || []), ...(row.receivers || [])].map((entry) => String(entry || "")).filter(Boolean))
    );

    return {
      conversationId: row._id,
      messagesCount: Number(row.messagesCount || 0),
      lastMessageAt: row.lastMessageAt || null,
      lastSenderName: row.lastSenderName || "",
      lastPreview: String(row.lastPreview || "").trim() || "Attachment or shared content",
      participantNames: participants
        .map((entry) => userNameMap.get(entry))
        .filter(Boolean)
        .slice(0, 3),
    };
  });

  const conversations = conversationRows.length
    ? await Message.distinct("conversationId", { createdAt: { $gte: dates.start, $lte: dates.end } }).then((rows) => rows.length)
    : 0;

  return {
    filters: {
      range: dates.range,
      startDate: dates.start,
      endDate: dates.end,
      interval: normalizeInterval(interval),
    },
    summary: {
      totalMessages: Number(totalMessages || 0),
      conversations: Number(conversations || 0),
      activeSenders: Number(activeSendersRows[0]?.count || 0),
      unreadMessages: Number(unreadMessages || 0),
      readMessages: Number(readMessages || 0),
      averagePerConversation: conversations
        ? Number((Number(totalMessages || 0) / Number(conversations || 1)).toFixed(1))
        : 0,
    },
    series: series.map((row) => ({
      date: row.date,
      messagesSent: Number(row.messagesSent || 0),
    })),
    recentConversations,
  };
};

const buildTopCreators = async ({ range, startDate, endDate, mode = "revenue", limit = 10 } = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const normalizedMode = ["revenue", "streams", "downloads"].includes(String(mode || "revenue")) ? String(mode) : "revenue";

  const purchaseRows = await Purchase.aggregate([
    { $match: { status: "paid", paidAt: { $gte: dates.start, $lte: dates.end }, creatorId: { $ne: null } } },
    { $group: { _id: "$creatorId", revenue: { $sum: "$amount" }, purchases: { $sum: 1 } } },
  ]);
  const revenueMap = new Map(purchaseRows.map((row) => [String(row._id), { revenue: Number(row.revenue || 0), purchases: Number(row.purchases || 0) }]));

  const [tracks, albums, books, videos, profiles] = await Promise.all([
    Track.find({ archivedAt: null }).select("creatorId playsCount playCount purchaseCount").lean(),
    Album.find({ archivedAt: null }).select("creatorId playCount purchaseCount").lean(),
    Book.find({ archivedAt: null }).select("creatorId downloadCount purchaseCount").lean(),
    Video.find({ archivedAt: null }).select("creatorProfileId viewsCount").lean(),
    CreatorProfile.find({ isCreator: true }).populate("userId", "username avatar").lean(),
  ]);

  const aggregate = new Map();
  const ensure = (id) => {
    const key = String(id || "");
    if (!key) return null;
    if (!aggregate.has(key)) aggregate.set(key, { creatorId: key, totalRevenue: 0, totalStreams: 0, totalDownloads: 0, uploadsCount: 0, purchases: 0 });
    return aggregate.get(key);
  };

  for (const row of tracks) {
    const entry = ensure(row.creatorId);
    if (!entry) continue;
    entry.totalStreams += Number(row.playsCount || row.playCount || 0);
    entry.uploadsCount += 1;
  }
  for (const row of albums) {
    const entry = ensure(row.creatorId);
    if (!entry) continue;
    entry.totalStreams += Number(row.playCount || 0);
    entry.uploadsCount += 1;
  }
  for (const row of books) {
    const entry = ensure(row.creatorId);
    if (!entry) continue;
    entry.totalDownloads += Number(row.downloadCount || 0);
    entry.uploadsCount += 1;
  }
  for (const row of videos) {
    const entry = ensure(row.creatorProfileId);
    if (!entry) continue;
    entry.totalStreams += Number(row.viewsCount || 0);
    entry.uploadsCount += 1;
  }
  for (const [creatorId, revenue] of revenueMap.entries()) {
    const entry = ensure(creatorId);
    if (!entry) continue;
    entry.totalRevenue = revenue.revenue;
    entry.purchases = revenue.purchases;
  }

  const profileMap = new Map(profiles.map((row) => [String(row._id), row]));
  const sortKey = normalizedMode === "streams" ? "totalStreams" : normalizedMode === "downloads" ? "totalDownloads" : "totalRevenue";
  const items = Array.from(aggregate.values())
    .map((row) => {
      const profile = profileMap.get(row.creatorId);
      return {
        creatorId: row.creatorId,
        displayName: profile?.displayName || "Unknown Creator",
        username: profile?.userId?.username || "",
        avatar: profile?.userId?.avatar?.url || profile?.userId?.avatar || "",
        totalRevenue: Number(row.totalRevenue || 0),
        totalStreams: Number(row.totalStreams || 0),
        totalDownloads: Number(row.totalDownloads || 0),
        uploadsCount: Number(row.uploadsCount || 0),
        purchases: Number(row.purchases || 0),
      };
    })
    .sort((a, b) => Number(b[sortKey] || 0) - Number(a[sortKey] || 0))
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 10)));

  return { mode: normalizedMode, items };
};

const buildTopContent = async ({ category = "all", limit = 10 } = {}) => {
  const normalizedCategory = String(category || "all").trim().toLowerCase();
  const items = [];

  const pushRows = (rows, mapper) => {
    for (const row of rows) items.push(mapper(row));
  };

  if (["all", "music", "tracks"].includes(normalizedCategory)) {
    const rows = await Track.find({ archivedAt: null, kind: { $ne: "podcast" } }).sort({ playsCount: -1, purchaseCount: -1, createdAt: -1 }).limit(limit).lean();
    pushRows(rows, (row) => ({ id: String(row._id), type: "track", title: row.title || "Untitled Track", metricValue: Number(row.playsCount || row.playCount || 0), purchases: Number(row.purchaseCount || 0), price: Number(row.price || 0) }));
  }
  if (["all", "albums"].includes(normalizedCategory)) {
    const rows = await Album.find({ archivedAt: null }).sort({ playCount: -1, purchaseCount: -1, createdAt: -1 }).limit(limit).lean();
    pushRows(rows, (row) => ({ id: String(row._id), type: "album", title: row.title || "Untitled Album", metricValue: Number(row.playCount || 0), purchases: Number(row.purchaseCount || 0), price: Number(row.price || 0) }));
  }
  if (["all", "books"].includes(normalizedCategory)) {
    const rows = await Book.find({ archivedAt: null }).sort({ downloadCount: -1, purchaseCount: -1, createdAt: -1 }).limit(limit).lean();
    pushRows(rows, (row) => ({ id: String(row._id), type: "book", title: row.title || "Untitled Book", metricValue: Number(row.downloadCount || 0), purchases: Number(row.purchaseCount || 0), price: Number(row.price || 0) }));
  }
  if (["all", "podcasts"].includes(normalizedCategory)) {
    const rows = await Track.find({ archivedAt: null, kind: "podcast" }).sort({ playsCount: -1, createdAt: -1 }).limit(limit).lean();
    pushRows(rows, (row) => ({ id: String(row._id), type: "podcast", title: row.title || "Untitled Podcast", metricValue: Number(row.playsCount || row.playCount || 0), purchases: Number(row.purchaseCount || 0), price: Number(row.price || 0) }));
  }
  if (["all", "videos"].includes(normalizedCategory)) {
    const rows = await Video.find({ archivedAt: null }).sort({ viewsCount: -1, time: -1 }).limit(limit).lean();
    pushRows(rows, (row) => ({ id: String(row._id), type: "video", title: row.caption || "Untitled Video", metricValue: Number(row.viewsCount || 0), purchases: 0, price: Number(row.price || 0) }));
  }

  return {
    category: normalizedCategory,
    items: items.sort((a, b) => Number(b.metricValue || 0) - Number(a.metricValue || 0)).slice(0, Math.max(1, Math.min(50, Number(limit) || 10))),
  };
};

const buildRecentActivity = async ({ range, startDate, endDate, page = 1, limit = 20 } = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;
  const [rows, total] = await Promise.all([
    AnalyticsEvent.find({ createdAt: { $gte: dates.start, $lte: dates.end } }).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    AnalyticsEvent.countDocuments({ createdAt: { $gte: dates.start, $lte: dates.end } }),
  ]);
  return { page: safePage, limit: safeLimit, total, items: rows };
};

const buildSystemAlerts = async ({ range, startDate, endDate } = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const [failedPayments, uploadFailures, loginWarnings, unresolvedReports, repeatFailedUploads] = await Promise.all([
    Purchase.countDocuments({ status: "failed", updatedAt: { $gte: dates.start, $lte: dates.end } }),
    AnalyticsEvent.countDocuments({ type: "upload_failed", createdAt: { $gte: dates.start, $lte: dates.end } }),
    AnalyticsEvent.countDocuments({ type: "login_warning", createdAt: { $gte: dates.start, $lte: dates.end } }),
    Report.countDocuments({ status: { $in: ["open", "reviewing"] } }),
    AnalyticsEvent.aggregate([
      { $match: { type: "upload_failed", createdAt: { $gte: dates.start, $lte: dates.end }, userId: { $ne: null } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $match: { count: { $gte: 3 } } },
      { $count: "count" },
    ]),
  ]);

  const alerts = [];
  if (failedPayments > DEFAULT_ALERT_THRESHOLDS.failedPayments) alerts.push({ key: "failed_payments", severity: "high", title: "Failed payments spike", value: failedPayments, actionPath: "/admin/transactions" });
  if (uploadFailures > DEFAULT_ALERT_THRESHOLDS.uploadFailures) alerts.push({ key: "upload_failures", severity: "medium", title: "Upload failures elevated", value: uploadFailures, actionPath: "/admin/content" });
  if (loginWarnings > DEFAULT_ALERT_THRESHOLDS.loginWarnings) alerts.push({ key: "login_warnings", severity: "high", title: "Suspicious login activity", value: loginWarnings, actionPath: "/admin/analytics" });
  if (unresolvedReports > 0) {
    const hasBacklog = unresolvedReports > DEFAULT_ALERT_THRESHOLDS.unresolvedReports;
    alerts.push({
      key: hasBacklog ? "unresolved_reports_backlog" : "open_reports",
      severity: hasBacklog ? "medium" : "low",
      title: hasBacklog ? "Unresolved reports backlog" : "Open reports awaiting review",
      value: unresolvedReports,
      actionPath: "/admin/reports",
    });
  }
  if (Number(repeatFailedUploads[0]?.count || 0) > 0) alerts.push({ key: "repeat_upload_failures", severity: "medium", title: "Creators with repeated failed uploads", value: Number(repeatFailedUploads[0]?.count || 0), actionPath: "/admin/content" });

  return {
    thresholds: DEFAULT_ALERT_THRESHOLDS,
    metrics: { failedPayments, uploadFailures, loginWarnings, unresolvedReports, repeatFailedUploads: Number(repeatFailedUploads[0]?.count || 0) },
    alerts,
  };
};

const buildReportsSummary = async ({ range, startDate, endDate, interval = "daily" } = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const series = await fetchDailyRows({ start: dates.start, end: dates.end, interval });
  const [open, reviewing, actioned, dismissed] = await Promise.all([
    Report.countDocuments({ status: "open" }),
    Report.countDocuments({ status: "reviewing" }),
    Report.countDocuments({ status: "actioned" }),
    Report.countDocuments({ status: "dismissed" }),
  ]);

  return {
    summary: { open, reviewing, actioned, dismissed },
    series: series.map((row) => ({ date: row.date, reportsFiled: Number(row.reportsCount || 0) })),
  };
};

const backfillDailyAnalytics = async ({ startDate, endDate } = {}) => {
  const dates = buildDateRange({ range: "custom", startDate, endDate });
  return ensureDailySummaries({ start: dates.start, end: dates.end, force: true });
};

module.exports = {
  buildDateRange,
  normalizeInterval,
  formatDateKey,
  incrementDailyMetric,
  touchUserActivity,
  logAnalyticsEvent,
  computeDailySummary,
  recomputeUserStats,
  ensureDailySummaries,
  fetchDailyRows,
  buildOverview,
  buildUserGrowth,
  buildContentUploads,
  buildRevenueAnalytics,
  buildCommerceOperationsAnalytics,
  buildEngagementAnalytics,
  buildMessagesOverview,
  buildTopCreators,
  buildTopContent,
  buildRecentActivity,
  buildSystemAlerts,
  buildReportsSummary,
  backfillDailyAnalytics,
};
