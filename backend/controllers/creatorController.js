const asyncHandler = require("../middleware/asyncHandler");
const Album = require("../models/Album");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const Track = require("../models/Track");
const User = require("../models/User");
const Video = require("../models/Video");
const { buildCreatorActivationProgress } = require("../services/creatorActivationService");
const {
  buildCreatorDashboardConsole,
} = require("../services/creatorDashboardConsoleService");
const {
  buildCreatorDiscoveryContentInsightsForUser,
  buildCreatorDiscoveryInsights,
  buildCreatorDiscoveryInsightsForUser,
} = require("../services/creatorDiscoveryInsightsService");
const {
  logCreatorProfileOnboardingTransitions,
} = require("../services/creatorOnboardingAnalyticsService");
const {
  buildCreatorSubscriptionAnalytics,
  buildCreatorSubscriptionAnalyticsForUser,
} = require("../services/creatorSubscriptionAnalyticsService");
const {
  createCreatorPayoutRequest,
  listCreatorPayoutRequests,
} = require("../services/creatorPayoutRequestService");
const {
  createCreatorWithdrawal,
  listCreatorWithdrawals,
} = require("../services/withdrawalService");
const { buildPayoutReadiness } = require("../services/payoutReadinessService");
const { buildCreatorWalletSnapshot } = require("../services/walletService");
const {
  computePurchaseRevenueShare,
} = require("../services/creatorRevenueSharePolicy");
const {
  normalizeBooksProfile,
  calculateCreatorProfileCompletionScore,
  isCreatorRegistrationCompleted,
  normalizeGenres,
  normalizeMusicProfile,
  normalizePodcastsProfile,
  normalizeCreatorTypes,
  normalizeSocialHandles,
  normalizeSubscriptionBenefits,
  trimCreatorText,
} = require("../services/creatorProfileService");

const CREATOR_NO_STORE_HEADER = "no-store, no-cache, must-revalidate, proxy-revalidate";

const applyNoStore = (res) => {
  res.set("Cache-Control", CREATOR_NO_STORE_HEADER);
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
};

const resolveSocialUrl = (value = "", fallbackPrefix = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  if (/^https?:\/\//i.test(normalized) || /^spotify:/i.test(normalized)) {
    return normalized;
  }
  if (/^(www\.|open\.spotify\.com|spotify\.com|youtube\.com|www\.youtube\.com|m\.youtube\.com|youtu\.be)/i.test(normalized)) {
    return `https://${normalized}`;
  }
  return `${fallbackPrefix}${normalized}`;
};

const buildSocialLinks = (socialHandles = {}) => {
  const handles = normalizeSocialHandles(socialHandles);
  return [
    handles.facebook ? { label: "facebook", url: resolveSocialUrl(handles.facebook, "https://facebook.com/") } : null,
    handles.instagram
      ? { label: "instagram", url: resolveSocialUrl(handles.instagram, "https://instagram.com/") }
      : null,
    handles.linkedin
      ? { label: "linkedin", url: resolveSocialUrl(handles.linkedin, "https://linkedin.com/in/") }
      : null,
    handles.x ? { label: "x", url: resolveSocialUrl(handles.x, "https://x.com/") } : null,
    handles.threads
      ? { label: "threads", url: resolveSocialUrl(handles.threads, "https://www.threads.net/@") }
      : null,
    handles.spotify
      ? { label: "spotify", url: resolveSocialUrl(handles.spotify, "https://open.spotify.com/artist/") }
      : null,
    handles.youtube
      ? { label: "youtube", url: resolveSocialUrl(handles.youtube, "https://www.youtube.com/@") }
      : null,
  ].filter(Boolean);
};

const clampMoney = (value) =>
  Math.max(0, Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100);
const clampSubscriptionAmount = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Number(fallback || 0));
  }
  return Math.max(0, Math.round((parsed + Number.EPSILON) * 100) / 100);
};

const hasOwn = (object = {}, key = "") => Object.prototype.hasOwnProperty.call(object || {}, key);

const serializeCreatorProfile = ({
  profile,
  user,
  creatorTypes = [],
  contentCounts = {},
}) => {
  const completionScore = Number(profile?.profileCompletionScore)
    || calculateCreatorProfileCompletionScore(profile || {});

  return {
    _id: profile?._id?.toString?.() || "",
    userId: user?._id?.toString?.() || profile?.userId?.toString?.() || "",
    fullName: profile?.fullName || profile?.displayName || user?.name || "",
    displayName: profile?.displayName || profile?.fullName || user?.name || "",
    phoneNumber: profile?.phoneNumber || user?.phone || "",
    accountNumber: profile?.accountNumber || "",
    bankName: profile?.bankName || "",
    bankCode: profile?.bankCode || "",
    accountName: profile?.accountName || "",
    payoutRecipientVerifiedAt: profile?.payoutRecipientVerifiedAt || null,
    country: profile?.country || user?.country || "",
    countryOfResidence: profile?.countryOfResidence || profile?.country || user?.country || "",
    socialHandles: normalizeSocialHandles(profile?.socialHandles),
    musicProfile: normalizeMusicProfile(profile?.musicProfile),
    booksProfile: normalizeBooksProfile(profile?.booksProfile),
    podcastsProfile: normalizePodcastsProfile(profile?.podcastsProfile),
    creatorTypes,
    acceptedTerms: Boolean(profile?.acceptedTerms),
    acceptedCopyrightDeclaration: Boolean(profile?.acceptedCopyrightDeclaration),
    onboardingCompleted: Boolean(isCreatorRegistrationCompleted(profile)),
    completed: Boolean(isCreatorRegistrationCompleted(profile)),
    profileCompletionScore: completionScore,
    status: profile?.status || "active",
    bio: profile?.bio || "",
    tagline: profile?.tagline || "",
    heroBannerUrl: profile?.heroBannerUrl || profile?.coverImageUrl || "",
    coverImageUrl: profile?.coverImageUrl || "",
    paymentModeDefault: profile?.paymentModeDefault || "NG",
    subscriptionPrice: Number(profile?.subscriptionPrice ?? 2000) || 2000,
    subscriptionPriceGlobal: Number(profile?.subscriptionPriceGlobal || 0),
    subscriptionDescription: profile?.subscriptionDescription || "",
    subscriptionBenefits: normalizeSubscriptionBenefits(profile?.subscriptionBenefits),
    genres: normalizeGenres(profile?.genres),
    links: buildSocialLinks(profile?.socialHandles),
    contentCounts,
    user: user
      ? {
          _id: user._id?.toString?.() || "",
          name: user.name || "",
          username: user.username || "",
          email: user.email || "",
          avatar: typeof user.avatar === "string" ? user.avatar : user.avatar?.url || "",
          isVerified: Boolean(user.isVerified || user.emailVerified),
          followersCount: Array.isArray(user.followers) ? user.followers.length : 0,
        }
      : null,
    createdAt: profile?.createdAt || null,
    updatedAt: profile?.updatedAt || null,
  };
};

const serializeTrackItem = (track, earnings = 0) => ({
  _id: track._id.toString(),
  title: track.title || "",
  description: track.description || "",
  price: Number(track.price || 0),
  genre: track.genre || "",
  artistName: track.artistName || "",
  releaseType: track.releaseType || "single",
  explicitContent: Boolean(track.explicitContent),
  featuringArtists: Array.isArray(track.featuringArtists) ? track.featuringArtists : [],
  producerCredits: Array.isArray(track.producerCredits) ? track.producerCredits : [],
  songwriterCredits: Array.isArray(track.songwriterCredits) ? track.songwriterCredits : [],
  releaseDate: track.releaseDate || null,
  lyrics: track.lyrics || "",
  audioFormat: track.audioFormat || "",
  mediaType: track.mediaType || (track.videoUrl ? "video" : "audio"),
  videoFormat: track.videoFormat || "",
  audioUrl: track.audioUrl || track.fullAudioUrl || "",
  coverImageUrl: track.coverImageUrl || track.coverUrl || "",
  videoUrl: track.videoUrl || "",
  previewUrl: track.previewUrl || "",
  previewStartSec: Number(track.previewStartSec || 0),
  previewLimitSec: Number(track.previewLimitSec || 30),
  kind: track.kind || "music",
  creatorCategory: track.creatorCategory || (track.kind === "podcast" ? "podcasts" : "music"),
  contentType: track.contentType || (track.kind === "podcast" ? "podcast_episode" : "track"),
  publishedStatus: track.publishedStatus || (track.isPublished ? "published" : "draft"),
  copyrightScanStatus: track.copyrightScanStatus || "pending_scan",
  verificationNotes: track.verificationNotes || "",
  reviewRequired: Boolean(track.reviewRequired),
  playsCount: Number(track.playsCount || track.playCount || 0),
  purchaseCount: Number(track.purchaseCount || 0),
  seasonNumber: Number(track.seasonNumber || 0),
  episodeNumber: Number(track.episodeNumber || 0),
  podcastSeries: track.podcastSeries || "",
  podcastCategory: track.podcastCategory || "",
  episodeType: track.episodeType || "free",
  guestNames: Array.isArray(track.guestNames) ? track.guestNames : [],
  showNotes: track.showNotes || "",
  transcriptUrl: track.transcriptUrl || "",
  episodeTags: Array.isArray(track.episodeTags) ? track.episodeTags : [],
  earnings,
  createdAt: track.createdAt,
  updatedAt: track.updatedAt,
});

const serializeBookItem = (book, earnings = 0) => ({
  _id: book._id.toString(),
  title: book.title || "",
  authorName: book.authorName || "",
  subtitle: book.subtitle || "",
  description: book.description || "",
  price: Number(book.price || 0),
  genre: book.genre || "",
  language: book.language || "",
  pageCount: Number(book.pageCount || 0),
  chapterCount: Number(book.chapterCount || 0),
  isbn: book.isbn || "",
  edition: book.edition || "",
  audience: book.audience || "",
  readingAge: book.readingAge || "",
  tableOfContents: book.tableOfContents || "",
  tags: Array.isArray(book.tags) ? book.tags : [],
  coverImageUrl: book.coverImageUrl || book.coverUrl || "",
  previewUrl: book.previewUrl || "",
  fileFormat: book.fileFormat || "",
  previewExcerptText: book.previewExcerptText || "",
  copyrightDeclared: Boolean(book.copyrightDeclared),
  creatorCategory: "books",
  contentType: book.contentType || "ebook",
  publishedStatus: book.publishedStatus || (book.isPublished ? "published" : "draft"),
  copyrightScanStatus: book.copyrightScanStatus || "pending_scan",
  verificationNotes: book.verificationNotes || "",
  reviewRequired: Boolean(book.reviewRequired),
  purchaseCount: Number(book.purchaseCount || 0),
  earnings,
  createdAt: book.createdAt,
  updatedAt: book.updatedAt,
});

const serializeAlbumItem = (album, earnings = 0) => ({
  _id: album._id.toString(),
  title: album.title || "",
  description: album.description || "",
  price: Number(album.price || 0),
  coverUrl: album.coverUrl || "",
  totalTracks: Number(album.totalTracks || album.tracks?.length || 0),
  releaseType: album.releaseType || album.contentType || "album",
  creatorCategory: "music",
  contentType: album.contentType || album.releaseType || "album",
  publishedStatus: album.publishedStatus || (album.isPublished ? "published" : "draft"),
  copyrightScanStatus: album.copyrightScanStatus || "pending_scan",
  verificationNotes: album.verificationNotes || "",
  reviewRequired: Boolean(album.reviewRequired),
  playCount: Number(album.playCount || 0),
  purchaseCount: Number(album.purchaseCount || 0),
  earnings,
  createdAt: album.createdAt,
  updatedAt: album.updatedAt,
});

const serializeVideoItem = (video, earnings = 0) => ({
  _id: video._id.toString(),
  title: video.caption || "Music video",
  description: video.description || video.caption || "",
  price: Number(video.price || 0),
  coverImageUrl: video.coverImageUrl || "",
  videoUrl: video.videoUrl || "",
  previewClipUrl: video.previewClipUrl || "",
  durationSec: Number(video.durationSec || 0),
  videoFormat: video.videoFormat || "",
  creatorCategory: video.creatorCategory || "music",
  contentType: video.contentType || "music_video",
  publishedStatus: video.publishedStatus || (video.isPublished ? "published" : "draft"),
  copyrightScanStatus: video.copyrightScanStatus || "pending_scan",
  verificationNotes: video.verificationNotes || "",
  reviewRequired: Boolean(video.reviewRequired),
  viewsCount: Number(video.viewsCount || 0),
  earnings,
  createdAt: video.createdAt || video.time || null,
  updatedAt: video.updatedAt || video.time || null,
});

const getCreatorContent = async (profile, userId) => {
  const creatorId = profile._id;
  const [musicTracks, podcastTracks, books, albums, videos] = await Promise.all([
    Track.find({ creatorId, archivedAt: null, kind: { $in: ["music", null] } }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
    Track.find({ creatorId, archivedAt: null, kind: "podcast" }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
    Book.find({ creatorId, archivedAt: null }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
    Album.find({ creatorId, archivedAt: null }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
    Video.find({
      archivedAt: null,
      $or: [{ creatorProfileId: creatorId }, { userId: String(userId || "") }],
    })
      .sort({ updatedAt: -1, createdAt: -1, time: -1 })
      .lean(),
  ]);

  return { musicTracks, podcastTracks, books, albums, videos };
};

const inferCreatorTypesFromContent = (content = {}) =>
  normalizeCreatorTypes([
    content?.musicTracks?.length || content?.albums?.length || content?.videos?.length ? "music" : "",
    content?.books?.length ? "bookPublishing" : "",
    content?.podcastTracks?.length ? "podcast" : "",
  ]);

const resolveCreatorTypes = ({ profile, content }) => {
  const storedTypes = normalizeCreatorTypes(profile?.creatorTypes);
  if (storedTypes.length) {
    return storedTypes;
  }
  return inferCreatorTypesFromContent(content);
};

const buildRecentActivity = ({
  musicTracks = [],
  podcastTracks = [],
  books = [],
  albums = [],
  videos = [],
  purchases = [],
}) => {
  const uploadActivity = [
    ...musicTracks.map((entry) => ({
      id: `track-${entry._id}`,
      kind: "upload",
      category: "music",
      title: entry.title || "Track",
      description: `Track ${entry.publishedStatus || "published"}`,
      timestamp: entry.updatedAt || entry.createdAt,
      status: entry.publishedStatus || "published",
    })),
    ...podcastTracks.map((entry) => ({
      id: `podcast-${entry._id}`,
      kind: "upload",
      category: "podcasts",
      title: entry.title || "Episode",
      description: `Podcast episode ${entry.publishedStatus || "published"}`,
      timestamp: entry.updatedAt || entry.createdAt,
      status: entry.publishedStatus || "published",
    })),
    ...books.map((entry) => ({
      id: `book-${entry._id}`,
      kind: "upload",
      category: "books",
      title: entry.title || "Book",
      description: `Book ${entry.publishedStatus || "published"}`,
      timestamp: entry.updatedAt || entry.createdAt,
      status: entry.publishedStatus || "published",
    })),
    ...albums.map((entry) => ({
      id: `album-${entry._id}`,
      kind: "upload",
      category: "music",
      title: entry.title || "Album",
      description: `${(entry.releaseType || "album").toUpperCase()} ${entry.publishedStatus || "published"}`,
      timestamp: entry.updatedAt || entry.createdAt,
      status: entry.publishedStatus || "published",
    })),
    ...videos.map((entry) => ({
      id: `video-${entry._id}`,
      kind: "upload",
      category: "music",
      title: entry.caption || "Music video",
      description: `Music video ${entry.publishedStatus || "published"}`,
      timestamp: entry.updatedAt || entry.createdAt || entry.time,
      status: entry.publishedStatus || "published",
    })),
  ];

  const salesActivity = purchases.map((entry) => ({
    id: `sale-${entry._id}`,
    kind: "sale",
    category:
      entry.itemType === "book"
        ? "books"
        : entry.itemType === "subscription"
          ? "subscriptions"
          : "music",
    title: "New purchase",
    description: `${entry.itemType} sale completed`,
    timestamp: entry.paidAt || entry.updatedAt || entry.createdAt,
    status: entry.status || "paid",
    amount: clampMoney(entry.amount),
  }));

  return [...uploadActivity, ...salesActivity]
    .filter((entry) => entry.timestamp)
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
    .slice(0, 8);
};

const validateRegistrationPayload = (body = {}) => {
  const errors = [];
  const fullName = String(body?.fullName || "").trim();
  const phoneNumber = String(body?.phoneNumber || "").trim();
  const accountNumber = String(body?.accountNumber || "").trim();
  const bankName = String(body?.bankName || "").trim();
  const bankCode = String(body?.bankCode || "").trim();
  const accountName = String(body?.accountName || "").trim();
  const country = String(body?.country || "").trim();
  const countryOfResidence = String(body?.countryOfResidence || "").trim();
  const creatorTypes = normalizeCreatorTypes(body?.creatorTypes);
  const acceptedTerms = Boolean(body?.acceptedTerms);
  const acceptedCopyrightDeclaration = Boolean(body?.acceptedCopyrightDeclaration);

  if (!fullName) errors.push("Full Name is required");
  if (!phoneNumber) errors.push("Phone Number is required");
  if (!accountNumber) errors.push("Bank Account Number is required");
  if (!bankName) errors.push("Bank Name is required");
  if (!bankCode) errors.push("Bank Code is required");
  if (!accountName) errors.push("Bank Account Name is required");
  if (!country) errors.push("Country is required");
  if (!countryOfResidence) errors.push("Country of Residence is required");
  if (!creatorTypes.length) errors.push("Select at least one creator category");
  if (!acceptedTerms) errors.push("You must accept the Terms and Conditions");
  if (!acceptedCopyrightDeclaration) {
    errors.push("You must confirm that you have the rights to publish your content");
  }

  return {
    errors,
    fullName,
    phoneNumber,
    accountNumber,
    bankName,
    bankCode,
    accountName,
    country,
    countryOfResidence,
    creatorTypes,
  };
};

const getProfileBundle = async (userId) => {
  const profile = await CreatorProfile.findOne({ userId }).lean();
  const user = await User.findById(userId)
    .select("name username email avatar phone country isVerified emailVerified followers")
    .lean();
  return { profile, user };
};

const getDashboardPayload = async ({ profile, user }) => {
  const content = await getCreatorContent(profile, user?._id || profile.userId);
  const creatorTypes = resolveCreatorTypes({ profile, content });
  const purchases = await Purchase.find({
    creatorId: profile._id,
    status: "paid",
    itemType: { $in: ["track", "book", "album", "video", "subscription"] },
  })
    .select(
      "userId itemType itemId amount currency status provider providerRef accessExpiresAt cancelAtPeriodEnd canceledAt refundedAt paidAt createdAt updatedAt revenueCategory revenueSharePolicy creatorShareRate platformShareRate processingFeeAmount taxAmount"
    )
    .populate("userId", "name username avatar")
    .sort({ paidAt: -1, createdAt: -1, _id: -1 })
    .lean();

  const walletSnapshot = await buildCreatorWalletSnapshot({
    creatorId: profile._id,
  });
  const earningsByKey = walletSnapshot.itemEarningsMap || new Map();

  const musicTracks = content.musicTracks.map((entry) =>
    serializeTrackItem(entry, earningsByKey.get(`track:${entry._id}`) || 0)
  );
  const podcastTracks = content.podcastTracks.map((entry) =>
    serializeTrackItem(entry, earningsByKey.get(`track:${entry._id}`) || 0)
  );
  const books = content.books.map((entry) =>
    serializeBookItem(entry, earningsByKey.get(`book:${entry._id}`) || 0)
  );
  const albums = content.albums.map((entry) =>
    serializeAlbumItem(entry, earningsByKey.get(`album:${entry._id}`) || 0)
  );
  const videos = content.videos.map((entry) =>
    serializeVideoItem(entry, earningsByKey.get(`video:${entry._id}`) || 0)
  );

  const summary = {
    grossRevenue: clampMoney(walletSnapshot.summary?.grossRevenue),
    processingFees: clampMoney(walletSnapshot.summary?.processingFees),
    taxes: clampMoney(walletSnapshot.summary?.taxes),
    netRevenue: Number(walletSnapshot.summary?.netRevenue || 0),
    totalEarnings: Number(walletSnapshot.summary?.totalEarnings || 0),
    platformRevenue: Number(walletSnapshot.summary?.platformRevenue || 0),
    availableBalance: Number(walletSnapshot.summary?.availableBalance || 0),
    spendableBalance: clampMoney(walletSnapshot.summary?.spendableBalance),
    recoverableBalance: Number(walletSnapshot.summary?.recoverableBalance || 0),
    debtBalance: clampMoney(walletSnapshot.summary?.debtBalance),
    pendingBalance: Number(walletSnapshot.summary?.pendingBalance || 0),
    withdrawn: clampMoney(walletSnapshot.summary?.withdrawn),
    walletBacked: Boolean(walletSnapshot.walletBacked),
  };
  const subscriptionPurchases = purchases.filter(
    (entry) => String(entry?.itemType || "").trim().toLowerCase() === "subscription"
  );
  const subscriptionWalletBucket = (walletSnapshot.breakdown || []).find(
    (entry) => entry.key === "subscriptions" || entry.key === "subscription"
  );
  const subscriptionEarnings = subscriptionWalletBucket
    ? Number(subscriptionWalletBucket.creatorEarnings || 0)
    : subscriptionPurchases.reduce(
        (sum, entry) =>
          sum + clampMoney(computePurchaseRevenueShare(entry).creatorAmount),
        0
      );
  const laneCounts = {
    music: {
      uploads: musicTracks.filter((entry) => entry.publishedStatus !== "draft").length
        + albums.filter((entry) => entry.publishedStatus !== "draft").length
        + videos.filter((entry) => entry.publishedStatus !== "draft").length,
      drafts: musicTracks.filter((entry) => entry.publishedStatus === "draft").length
        + albums.filter((entry) => entry.publishedStatus === "draft").length
        + videos.filter((entry) => entry.publishedStatus === "draft").length,
      earnings: musicTracks.reduce((sum, entry) => sum + Number(entry.earnings || 0), 0)
        + albums.reduce((sum, entry) => sum + Number(entry.earnings || 0), 0)
        + videos.reduce((sum, entry) => sum + Number(entry.earnings || 0), 0),
      underReview: musicTracks.filter((entry) => entry.publishedStatus === "under_review").length
        + albums.filter((entry) => entry.publishedStatus === "under_review").length
        + videos.filter((entry) => entry.publishedStatus === "under_review").length,
    },
    bookPublishing: {
      uploads: books.filter((entry) => entry.publishedStatus !== "draft").length,
      drafts: books.filter((entry) => entry.publishedStatus === "draft").length,
      earnings: books.reduce((sum, entry) => sum + Number(entry.earnings || 0), 0),
      underReview: books.filter((entry) => entry.publishedStatus === "under_review").length,
    },
    podcast: {
      uploads: podcastTracks.filter((entry) => entry.publishedStatus !== "draft").length,
      drafts: podcastTracks.filter((entry) => entry.publishedStatus === "draft").length,
      earnings: podcastTracks.reduce((sum, entry) => sum + Number(entry.earnings || 0), 0),
      underReview: podcastTracks.filter((entry) => entry.publishedStatus === "under_review").length,
    },
    subscriptions: {
      uploads: 0,
      drafts: 0,
      earnings: subscriptionEarnings,
      underReview: 0,
      active: subscriptionPurchases.length,
    },
  };
  const contentCounts = {
    ...laneCounts,
    books: laneCounts.bookPublishing,
    podcasts: laneCounts.podcast,
  };

  const creatorProfile = serializeCreatorProfile({
    profile,
    user,
    creatorTypes,
    contentCounts: {
      musicUploads: laneCounts.music.uploads,
      musicDrafts: laneCounts.music.drafts,
      bookPublishingUploads: laneCounts.bookPublishing.uploads,
      podcastUploads: laneCounts.podcast.uploads,
      bookUploads: laneCounts.bookPublishing.uploads,
    },
  });

  const verificationOverview = [...musicTracks, ...podcastTracks, ...books, ...albums, ...videos].reduce(
    (acc, entry) => {
      const key = entry.copyrightScanStatus || "pending_scan";
      acc[key] = Number(acc[key] || 0) + 1;
      return acc;
    },
    { pending_scan: 0, passed: 0, flagged: 0, blocked: 0 }
  );

  const { itemEarningsMap: _walletItemEarningsMap, ...walletPayload } = walletSnapshot;
  const payoutReadiness = buildPayoutReadiness(profile);
  const activation = buildCreatorActivationProgress({
    profile,
    user,
    creatorTypes,
    content,
    payoutReadiness,
  });
  const dashboardContent = {
    musicTracks,
    podcastTracks,
    books,
    albums,
    videos,
  };
  const operatingConsole = buildCreatorDashboardConsole({
    activation,
    content: dashboardContent,
    payoutReadiness,
    profile,
    purchases,
  });
  const discoveryInsights = await buildCreatorDiscoveryInsights({
    profile,
    range: "30d",
  });
  const subscriptionAnalytics = await buildCreatorSubscriptionAnalytics({
    profile,
    range: "30d",
  });

  return {
    creatorProfile,
    summary,
    wallet: {
      ...walletPayload,
      payoutReadiness,
    },
    activation,
    operatingConsole,
    discoveryInsights,
    subscriptionAnalytics,
    categories: contentCounts,
    content: {
      music: {
        tracks: musicTracks,
        albums,
        videos,
        analytics: {
          totalStreams: musicTracks.reduce((sum, entry) => sum + Number(entry.playsCount || 0), 0)
            + albums.reduce((sum, entry) => sum + Number(entry.playCount || 0), 0)
            + videos.reduce((sum, entry) => sum + Number(entry.viewsCount || 0), 0),
          activeReleases: musicTracks.filter((entry) => entry.publishedStatus === "published").length
            + albums.filter((entry) => entry.publishedStatus === "published").length
            + videos.filter((entry) => entry.publishedStatus === "published").length,
        },
      },
      books: {
        items: books,
        analytics: {
          totalDownloads: books.reduce((sum, entry) => sum + Number(entry.purchaseCount || 0), 0),
          activeBooks: books.filter((entry) => entry.publishedStatus === "published").length,
        },
      },
      podcasts: {
        episodes: podcastTracks,
        analytics: {
          totalEpisodes: podcastTracks.length,
          activeEpisodes: podcastTracks.filter((entry) => entry.publishedStatus === "published").length,
          totalStreams: podcastTracks.reduce((sum, entry) => sum + Number(entry.playsCount || 0), 0),
        },
      },
    },
    verificationOverview,
    recentActivity: buildRecentActivity({
      musicTracks: content.musicTracks,
      podcastTracks: content.podcastTracks,
      books: content.books,
      albums: content.albums,
      videos: content.videos,
      purchases,
    }),
    support: {
      helpCenterUrl: "/help-support",
      copyrightPolicyUrl: "/copyright-policy",
      termsUrl: "/terms",
    },
  };
};

exports.getCreatorAccess = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const { profile, user } = await getProfileBundle(req.user.id);
  if (!profile) {
    return res.json({
      isCreatorRegistered: false,
      onboardingCompleted: false,
      creatorTypes: [],
      creatorProfile: null,
    });
  }

  const content = await getCreatorContent(profile, user?._id || req.user.id);
  const creatorTypes = resolveCreatorTypes({ profile, content });
  const creatorProfile = serializeCreatorProfile({
    profile,
    user,
    creatorTypes,
    contentCounts: {
      musicUploads: content.musicTracks.length + content.albums.length + content.videos.length,
      bookUploads: content.books.length,
      podcastUploads: content.podcastTracks.length,
    },
  });

  return res.json({
    isCreatorRegistered: true,
    onboardingCompleted: Boolean(isCreatorRegistrationCompleted(profile)),
    creatorTypes,
    creatorProfile,
  });
});

exports.getCreatorProfile = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const { profile, user } = await getProfileBundle(req.user.id);
  if (!profile) {
    return res.status(404).json({ error: "Creator profile not found" });
  }

  const content = await getCreatorContent(profile, user?._id || req.user.id);
  const creatorTypes = resolveCreatorTypes({ profile, content });
  return res.json(
    serializeCreatorProfile({
      profile,
      user,
      creatorTypes,
      contentCounts: {
        musicUploads: content.musicTracks.length + content.albums.length + content.videos.length,
        bookUploads: content.books.length,
        podcastUploads: content.podcastTracks.length,
      },
    })
  );
});

exports.registerCreator = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const {
    errors,
    fullName,
    phoneNumber,
    accountNumber,
    bankName,
    bankCode,
    accountName,
    country,
    countryOfResidence,
    creatorTypes,
  } =
    validateRegistrationPayload(req.body);

  if (errors.length) {
    return res.status(400).json({ error: errors[0], details: errors });
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const socialHandles = normalizeSocialHandles(req.body?.socialHandles);
  const displayName = trimCreatorText(req.body?.displayName || fullName, 120) || fullName;
  const coverImageUrl = trimCreatorText(req.body?.coverImageUrl || "", 500);
  const acceptedTerms = Boolean(req.body?.acceptedTerms);
  const acceptedCopyrightDeclaration = Boolean(req.body?.acceptedCopyrightDeclaration);
  const musicProfile = normalizeMusicProfile(req.body?.musicProfile);
  const booksProfile = normalizeBooksProfile(req.body?.booksProfile);
  const podcastsProfile = normalizePodcastsProfile(req.body?.podcastsProfile);
  const subscriptionPrice = clampSubscriptionAmount(req.body?.subscriptionPrice, 2000) || 2000;
  const subscriptionPriceGlobal = clampSubscriptionAmount(req.body?.subscriptionPriceGlobal, 0);
  const subscriptionDescription = trimCreatorText(req.body?.subscriptionDescription || "", 360);
  const subscriptionBenefits = normalizeSubscriptionBenefits(req.body?.subscriptionBenefits);
  const existingProfile = await CreatorProfile.findOne({ userId: req.user.id }).lean();

  const profile = await CreatorProfile.findOneAndUpdate(
    { userId: req.user.id },
    {
      $set: {
        displayName,
        fullName,
        phoneNumber,
        accountNumber,
        bankName,
        bankCode,
        accountName,
        country,
        countryOfResidence,
        socialHandles,
        musicProfile,
        booksProfile,
        podcastsProfile,
        creatorTypes,
        coverImageUrl,
        subscriptionPrice,
        subscriptionPriceGlobal,
        subscriptionDescription,
        subscriptionBenefits,
        acceptedTerms,
        acceptedCopyrightDeclaration,
        onboardingCompleted: true,
        onboardingComplete: true,
        profileCompletionScore: 100,
        status: "active",
        isCreator: true,
        links: buildSocialLinks(socialHandles),
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    }
  ).lean();

  await User.findByIdAndUpdate(req.user.id, {
    $set: {
      isArtist: true,
      phone: phoneNumber || user.phone || "",
      country: country || user.country || "",
    },
  }).catch(() => null);
  await logCreatorProfileOnboardingTransitions({
    userId: req.user.id,
    profileId: profile._id,
    beforeProfile: existingProfile,
    afterProfile: profile,
    source: existingProfile ? "creator_registration_update" : "creator_registration",
  });

  return res.status(201).json({
    success: true,
    creatorProfile: serializeCreatorProfile({
      profile,
      user: {
        ...user.toObject(),
        phone: phoneNumber || user.phone || "",
        country: country || user.country || "",
      },
      creatorTypes,
    }),
  });
});

exports.updateCreatorProfile = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const existing = await CreatorProfile.findOne({ userId: req.user.id }).lean();
  if (!existing) {
    return res.status(404).json({ error: "Creator profile not found" });
  }

  const nextHandles = normalizeSocialHandles(req.body?.socialHandles || existing.socialHandles || {});
  const nextCreatorTypes = normalizeCreatorTypes(req.body?.creatorTypes || existing.creatorTypes || []);
  const nextDisplayName = trimCreatorText(
    req.body?.displayName || existing.displayName || req.body?.fullName || existing.fullName || "",
    120
  );
  const nextCoverImageUrl = trimCreatorText(req.body?.coverImageUrl || existing.coverImageUrl || "", 500);
  const nextGenres = normalizeGenres(req.body?.genres || existing.genres || []);
  const nextMusicProfile = normalizeMusicProfile(req.body?.musicProfile || existing.musicProfile || {});
  const nextBooksProfile = normalizeBooksProfile(req.body?.booksProfile || existing.booksProfile || {});
  const nextPodcastsProfile = normalizePodcastsProfile(
    req.body?.podcastsProfile || existing.podcastsProfile || {}
  );
  const subscriptionPrice = hasOwn(req.body, "subscriptionPrice")
    ? clampSubscriptionAmount(req.body?.subscriptionPrice, existing.subscriptionPrice ?? 2000)
    : clampSubscriptionAmount(existing.subscriptionPrice ?? 2000, 2000);
  const subscriptionPriceGlobal = hasOwn(req.body, "subscriptionPriceGlobal")
    ? clampSubscriptionAmount(req.body?.subscriptionPriceGlobal, existing.subscriptionPriceGlobal || 0)
    : clampSubscriptionAmount(existing.subscriptionPriceGlobal || 0, 0);
  const subscriptionDescription = hasOwn(req.body, "subscriptionDescription")
    ? trimCreatorText(req.body?.subscriptionDescription, 360)
    : trimCreatorText(existing.subscriptionDescription || "", 360);
  const subscriptionBenefits = hasOwn(req.body, "subscriptionBenefits")
    ? normalizeSubscriptionBenefits(req.body?.subscriptionBenefits)
    : normalizeSubscriptionBenefits(existing.subscriptionBenefits || []);

  if (!String(req.body?.fullName || existing.fullName || existing.displayName || "").trim()) {
    return res.status(400).json({ error: "Full Name is required" });
  }
  if (!nextDisplayName) {
    return res.status(400).json({ error: "Artist stage name is required" });
  }
  if (!nextCreatorTypes.length) {
    return res.status(400).json({ error: "Select at least one creator category" });
  }

  const acceptedTerms = existing.acceptedTerms || Boolean(req.body?.acceptedTerms);
  const acceptedCopyrightDeclaration =
    existing.acceptedCopyrightDeclaration || Boolean(req.body?.acceptedCopyrightDeclaration);

  const profile = await CreatorProfile.findOneAndUpdate(
    { userId: req.user.id },
    {
      $set: {
        displayName: nextDisplayName,
        fullName: String(req.body?.fullName || existing.fullName || existing.displayName || "").trim(),
        phoneNumber: String(req.body?.phoneNumber || existing.phoneNumber || "").trim(),
        accountNumber: String(req.body?.accountNumber || existing.accountNumber || "").trim(),
        bankName: String(req.body?.bankName || existing.bankName || "").trim(),
        bankCode: String(req.body?.bankCode || existing.bankCode || "").trim(),
        accountName: String(req.body?.accountName || existing.accountName || "").trim(),
        country: String(req.body?.country || existing.country || "").trim(),
        countryOfResidence: String(
          req.body?.countryOfResidence || existing.countryOfResidence || existing.country || ""
        ).trim(),
        socialHandles: nextHandles,
        musicProfile: nextMusicProfile,
        booksProfile: nextBooksProfile,
        podcastsProfile: nextPodcastsProfile,
        creatorTypes: nextCreatorTypes,
        coverImageUrl: nextCoverImageUrl,
        tagline: trimCreatorText(req.body?.tagline || existing.tagline || "", 200),
        bio: trimCreatorText(req.body?.bio || existing.bio || "", 2000),
        genres: nextGenres,
        subscriptionPrice: subscriptionPrice || 2000,
        subscriptionPriceGlobal,
        subscriptionDescription,
        subscriptionBenefits,
        acceptedTerms,
        acceptedCopyrightDeclaration,
        onboardingCompleted: acceptedTerms && acceptedCopyrightDeclaration && nextCreatorTypes.length > 0,
        onboardingComplete: acceptedTerms && acceptedCopyrightDeclaration && nextCreatorTypes.length > 0,
        links: buildSocialLinks(nextHandles),
      },
    },
    { returnDocument: "after" }
  ).lean();

  const user = await User.findById(req.user.id)
    .select("name username email avatar phone country isVerified emailVerified followers")
    .lean();
  await logCreatorProfileOnboardingTransitions({
    userId: req.user.id,
    profileId: profile._id,
    beforeProfile: existing,
    afterProfile: profile,
    source: "creator_profile_update",
  });

  return res.json({
    success: true,
    creatorProfile: serializeCreatorProfile({
      profile,
      user,
      creatorTypes: nextCreatorTypes,
    }),
  });
});

exports.getCreatorContentSummary = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const { profile, user } = await getProfileBundle(req.user.id);
  if (!profile) {
    return res.status(404).json({ error: "Creator profile not found" });
  }
  if (!isCreatorRegistrationCompleted(profile)) {
    return res.status(403).json({ error: "Complete creator registration to access the dashboard" });
  }

  const payload = await getDashboardPayload({ profile, user });
  return res.json({
    creatorProfile: payload.creatorProfile,
    summary: payload.summary,
    wallet: payload.wallet,
    activation: payload.activation,
    operatingConsole: payload.operatingConsole,
    discoveryInsights: payload.discoveryInsights,
    subscriptionAnalytics: payload.subscriptionAnalytics,
    categories: payload.categories,
    verificationOverview: payload.verificationOverview,
    recentActivity: payload.recentActivity,
    support: payload.support,
  });
});

exports.getCreatorDiscoveryInsights = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const insights = await buildCreatorDiscoveryInsightsForUser({
    userId: req.user.id,
    range: req.query?.range || "30d",
    startDate: req.query?.startDate,
    endDate: req.query?.endDate,
  });

  return res.json(insights);
});

exports.getCreatorDiscoveryContentInsights = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const insights = await buildCreatorDiscoveryContentInsightsForUser({
    userId: req.user.id,
    itemType: req.params?.itemType,
    itemId: req.params?.itemId,
    range: req.query?.range || "30d",
    startDate: req.query?.startDate,
    endDate: req.query?.endDate,
  });

  return res.json(insights);
});

exports.getCreatorSubscriptionAnalytics = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const analytics = await buildCreatorSubscriptionAnalyticsForUser({
    userId: req.user.id,
    range: req.query?.range || "30d",
    startDate: req.query?.startDate,
    endDate: req.query?.endDate,
  });

  return res.json(analytics);
});

exports.getCreatorPayoutRequests = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const payload = await listCreatorPayoutRequests({
    userId: req.user.id,
    page: req.query?.page || 1,
    limit: req.query?.limit || 20,
  });

  return res.json(payload);
});

exports.createCreatorPayoutRequest = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const payload = await createCreatorPayoutRequest({
    userId: req.user.id,
    amount: req.body?.amount,
    currency: req.body?.currency || "NGN",
    creatorNote: req.body?.creatorNote || req.body?.note || "",
  });

  return res.status(201).json({
    success: true,
    ...payload,
  });
});

exports.getCreatorWithdrawals = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const payload = await listCreatorWithdrawals({
    userId: req.user.id,
    page: req.query?.page || 1,
    limit: req.query?.limit || 20,
  });

  return res.json(payload);
});

exports.createCreatorWithdrawal = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const payload = await createCreatorWithdrawal({
    userId: req.user.id,
    amount: req.body?.amount,
    currency: req.body?.currency || "NGN",
  });

  return res.status(201).json({
    success: true,
    ...payload,
  });
});

exports.getCreatorPrivateContent = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const { profile, user } = await getProfileBundle(req.user.id);
  if (!profile) {
    return res.status(404).json({ error: "Creator profile not found" });
  }
  if (!isCreatorRegistrationCompleted(profile)) {
    return res.status(403).json({ error: "Complete creator registration to access the dashboard" });
  }

  const payload = await getDashboardPayload({ profile, user });
  return res.json({
    creatorProfile: payload.creatorProfile,
    content: payload.content,
    categories: payload.categories,
  });
});

exports.updatePodcastSeries = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const existing = await CreatorProfile.findOne({ userId: req.user.id });
  if (!existing) {
    return res.status(404).json({ error: "Creator profile not found" });
  }

  existing.podcastsProfile = normalizePodcastsProfile({
    ...(existing.podcastsProfile?.toObject?.() || existing.podcastsProfile || {}),
    ...(req.body || {}),
  });

  await existing.save();

  const user = await User.findById(req.user.id)
    .select("name username email avatar phone country isVerified emailVerified followers")
    .lean();

  return res.json({
    success: true,
    podcastsProfile: normalizePodcastsProfile(existing.podcastsProfile),
    creatorProfile: serializeCreatorProfile({
      profile: existing.toObject(),
      user,
      creatorTypes: normalizeCreatorTypes(existing.creatorTypes),
    }),
  });
});

exports.getCreatorDashboard = asyncHandler(async (req, res) => {
  applyNoStore(res);
  const { profile, user } = await getProfileBundle(req.user.id);
  if (!profile) {
    return res.status(404).json({ error: "Creator profile not found" });
  }
  if (!isCreatorRegistrationCompleted(profile)) {
    return res.status(403).json({ error: "Complete creator registration to access the dashboard" });
  }

  const payload = await getDashboardPayload({ profile, user });
  return res.json(payload);
});
