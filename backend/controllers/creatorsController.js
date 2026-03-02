const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const Book = require("../models/Book");
const Album = require("../models/Album");
const Video = require("../models/Video");
const Purchase = require("../models/Purchase");
const User = require("../models/User");
const PlayerProgress = require("../models/PlayerProgress");
const { hasEntitlement } = require("../services/entitlementService");
const { buildSignedMediaUrl } = require("../services/mediaSigner");

const toCreatorPayload = (profile, extras = {}) => ({
  _id: profile._id.toString(),
  userId: profile.userId?._id ? profile.userId._id.toString() : profile.userId?.toString(),
  displayName: profile.displayName || "",
  bio: profile.bio || "",
  coverImageUrl: profile.coverImageUrl || "",
  links: Array.isArray(profile.links) ? profile.links : [],
  isCreator: Boolean(profile.isCreator),
  onboardingComplete: Boolean(profile.onboardingComplete),
  heroBannerUrl: profile.heroBannerUrl || profile.coverImageUrl || "",
  tagline: profile.tagline || "",
  genres: Array.isArray(profile.genres) ? profile.genres : [],
  paymentModeDefault: profile.paymentModeDefault || "NG",
  user:
    profile.userId && typeof profile.userId === "object"
      ? {
          _id: profile.userId._id?.toString() || "",
          name: profile.userId.name || "",
          username: profile.userId.username || "",
          avatar:
            typeof profile.userId.avatar === "string"
              ? profile.userId.avatar
              : profile.userId.avatar?.url || "",
          isVerified: Boolean(profile.userId.isVerified || profile.userId.emailVerified),
          followersCount: Array.isArray(profile.userId.followers) ? profile.userId.followers.length : 0,
        }
      : null,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
  ...extras,
});

const countCreatorContent = async ({ creatorId, userId }) => {
  const [songsCount, podcastsCount, comedyTrackCount, booksCount, albumsCount, comedyVideoCount] = await Promise.all([
    Track.countDocuments({ creatorId, kind: { $in: ["music", null] } }),
    Track.countDocuments({ creatorId, kind: "podcast" }),
    Track.countDocuments({ creatorId, kind: "comedy" }),
    Book.countDocuments({ creatorId }),
    Album.countDocuments({ creatorId, status: "published" }),
    Video.countDocuments({ userId: String(userId || "") }),
  ]);

  const comedyCount = comedyTrackCount + comedyVideoCount;
  const totalContentCount = songsCount + podcastsCount + booksCount + albumsCount + comedyCount;
  return {
    songsCount,
    podcastsCount,
    booksCount,
    albumsCount,
    comedyCount,
    totalContentCount,
    creatorReady: totalContentCount > 0,
  };
};

const mapTrackForHub = async ({ track, req, userId }) => {
  const canPlayFull = Number(track.price) <= 0 || (userId
    ? await hasEntitlement({ userId, itemType: "track", itemId: track._id })
    : false);
  const streamSource = canPlayFull ? track.audioUrl : track.previewUrl || track.audioUrl;
  return {
    id: track._id.toString(),
    title: track.title || "",
    coverUrl: track.coverImageUrl || "",
    durationSec: Number(track.durationSec) || 0,
    playsCount: Number(track.playsCount || 0),
    priceNGN: Number(track.price) || 0,
    priceUSD: Number(track.priceGlobal || 0),
    isFree: Number(track.price) <= 0,
    canStream: Boolean(streamSource),
    canDownload: canPlayFull,
    previewUrl: track.previewUrl || "",
    streamUrl: streamSource
      ? buildSignedMediaUrl({
          sourceUrl: streamSource,
          itemType: "track",
          itemId: track._id.toString(),
          userId: userId || "",
          req,
          expiresInSec: 10 * 60,
        })
      : "",
    kind: track.kind || "music",
    playCount: Number(track.playCount || track.playsCount || 0),
    purchaseCount: Number(track.purchaseCount || 0),
  };
};

const mapBookForHub = async ({ book, req, userId }) => {
  const entitled = Number(book.price) <= 0 || (userId
    ? await hasEntitlement({ userId, itemType: "book", itemId: book._id })
    : false);
  return {
    id: book._id.toString(),
    title: book.title || "",
    coverUrl: book.coverImageUrl || "",
    authorName: "",
    priceNGN: Number(book.price) || 0,
    priceUSD: Number(book.priceGlobal || 0),
    isFreePreview: Boolean(book.isFreePreview),
    previewPdfUrl: entitled
      ? (book.contentUrl || book.fileUrl || "")
      : (book.previewUrl || (book.isFreePreview ? (book.contentUrl || book.fileUrl || "") : "")),
    purchaseRequired: Number(book.price) > 0,
    canAccessFull: entitled,
    previewUrl: book.previewUrl || "",
    downloadUrl: entitled && (book.contentUrl || book.fileUrl)
      ? buildSignedMediaUrl({
          sourceUrl: book.contentUrl || book.fileUrl,
          itemType: "book",
          itemId: book._id.toString(),
          userId: userId || "",
          req,
          allowDownload: true,
          expiresInSec: 10 * 60,
        })
      : "",
  };
};

const mapAlbumForHub = async ({ album, req, userId }) => {
  const canPlayFull = Number(album.price) <= 0 || (userId
    ? await hasEntitlement({ userId, itemType: "album", itemId: album._id })
    : false);

  const tracks = (Array.isArray(album.tracks) ? album.tracks : [])
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((track, index) => {
      const fullUrl = String(track.trackUrl || "");
      const previewUrl = String(track.previewUrl || "");
      const sourceUrl = canPlayFull ? fullUrl : previewUrl;
      return {
        title: track.title || `Track ${index + 1}`,
        order: Number(track.order || index + 1),
        duration: Number(track.duration || 0),
        streamUrl: sourceUrl
          ? buildSignedMediaUrl({
              sourceUrl,
              itemType: "album",
              itemId: album._id.toString(),
              userId: userId || "",
              req,
              expiresInSec: 10 * 60,
            })
          : "",
      };
    });

  return {
    id: album._id.toString(),
    title: album.title || "",
    coverUrl: album.coverUrl || "",
    description: album.description || "",
    priceNGN: Number(album.price) || 0,
    priceUSD: Number(album.priceGlobal || 0),
    isFree: Number(album.price) <= 0,
    totalTracks: Number(album.totalTracks || tracks.length || 0),
    canStream: tracks.some((track) => Boolean(track.streamUrl)),
    canDownload: canPlayFull,
    canPlayFull,
    playCount: Number(album.playCount || 0),
    purchaseCount: Number(album.purchaseCount || 0),
    tracks,
    itemType: "album",
  };
};

exports.getMyCreatorProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const profile = await CreatorProfile.findOne({ userId }).populate(
    "userId",
    "name username avatar followers isVerified emailVerified"
  );

  if (!profile) {
    return res.status(404).json({ error: "Creator profile not found" });
  }

  const counts = await countCreatorContent({ creatorId: profile._id, userId });
  const creatorReady = Boolean(profile.onboardingComplete) && counts.totalContentCount > 0;

  return res.json(
    toCreatorPayload(profile, {
      contentCounts: counts,
      creatorReady,
    })
  );
});

exports.upsertMyCreatorProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const displayName = String(req.body?.displayName || "").trim();
  const bio = String(req.body?.bio || "").trim();
  const coverImageUrl = String(req.body?.coverImageUrl || "").trim();
  const heroBannerUrl = String(req.body?.heroBannerUrl || "").trim();
  const tagline = String(req.body?.tagline || "").trim();
  const onboardingComplete = Boolean(req.body?.onboardingComplete);
  const paymentModeDefault = ["NG", "GLOBAL"].includes(String(req.body?.paymentModeDefault || "").toUpperCase())
    ? String(req.body.paymentModeDefault).toUpperCase()
    : "NG";
  const genres = Array.isArray(req.body?.genres)
    ? req.body.genres.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 12)
    : [];
  const links = Array.isArray(req.body?.links)
    ? req.body.links
        .map((entry) => ({
          label: String(entry?.label || "").trim(),
          url: String(entry?.url || "").trim(),
        }))
        .filter((entry) => entry.url)
        .slice(0, 10)
    : [];

  if (!displayName) {
    return res.status(400).json({ error: "displayName is required" });
  }

  const profile = await CreatorProfile.findOneAndUpdate(
    { userId },
    {
      $set: {
        displayName,
        bio: bio.slice(0, 2000),
        coverImageUrl,
        heroBannerUrl,
        tagline: tagline.slice(0, 200),
        genres,
        links,
        onboardingComplete,
        paymentModeDefault,
        isCreator: true,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).populate("userId", "name username avatar followers isVerified emailVerified");

  const counts = await countCreatorContent({ creatorId: profile._id, userId });
  const creatorReady = Boolean(profile.onboardingComplete) && counts.totalContentCount > 0;

  return res.status(201).json(
    toCreatorPayload(profile, {
      contentCounts: counts,
      creatorReady,
    })
  );
});

exports.getCreatorById = asyncHandler(async (req, res) => {
  const { creatorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return res.status(400).json({ error: "Invalid creator id" });
  }

  const profile = await CreatorProfile.findById(creatorId).populate(
    "userId",
    "name username avatar followers isVerified emailVerified"
  );
  if (!profile) {
    return res.status(404).json({ error: "Creator not found" });
  }

  const counts = await countCreatorContent({ creatorId, userId: profile.userId?._id });
  const creatorReady = Boolean(profile.onboardingComplete) && counts.totalContentCount > 0;

  return res.json(
    toCreatorPayload(profile, {
      contentCounts: counts,
      creatorReady,
    })
  );
});

exports.getCreatorTracks = asyncHandler(async (req, res) => {
  const { creatorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return res.status(400).json({ error: "Invalid creator id" });
  }

  const kind = String(req.query?.kind || "").toLowerCase();
  const query = { creatorId };
  if (["music", "podcast", "comedy"].includes(kind)) {
    query.kind = kind;
  }

  const tracks = await Track.find(query).sort({ createdAt: -1 }).lean();
  return res.json(
    tracks.map((track) => ({
      _id: track._id.toString(),
      creatorId: track.creatorId?.toString() || "",
      title: track.title || "",
      description: track.description || "",
      price: Number(track.price) || 0,
      priceGlobal: Number(track.priceGlobal) || 0,
      previewUrl: track.previewUrl || "",
      audioUrl: track.audioUrl || "",
      coverImageUrl: track.coverImageUrl || "",
      durationSec: Number(track.durationSec) || 0,
      kind: track.kind || "music",
      playsCount: Number(track.playsCount || 0),
      likesCount: Number(track.likesCount || 0),
      createdAt: track.createdAt,
    }))
  );
});

exports.getCreatorBooks = asyncHandler(async (req, res) => {
  const { creatorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return res.status(400).json({ error: "Invalid creator id" });
  }

  const books = await Book.find({ creatorId }).sort({ createdAt: -1 }).lean();
  return res.json(
    books.map((book) => ({
      _id: book._id.toString(),
      creatorId: book.creatorId?.toString() || "",
      title: book.title || "",
      description: book.description || "",
      price: Number(book.price) || 0,
      priceGlobal: Number(book.priceGlobal || 0),
      coverImageUrl: book.coverImageUrl || "",
      contentUrl: book.contentUrl || "",
      isFreePreview: Boolean(book.isFreePreview),
      createdAt: book.createdAt,
    }))
  );
});

exports.getCreatorAlbums = asyncHandler(async (req, res) => {
  const { creatorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return res.status(400).json({ error: "Invalid creator id" });
  }

  const albums = await Album.find({ creatorId, status: "published" }).sort({ createdAt: -1 }).lean();
  return res.json(
    albums.map((album) => ({
      _id: album._id.toString(),
      creatorId: album.creatorId?.toString?.() || "",
      title: album.title || "",
      description: album.description || "",
      price: Number(album.price) || 0,
      coverUrl: album.coverUrl || "",
      totalTracks: Number(album.totalTracks || album.tracks?.length || 0),
      status: album.status || "published",
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
    }))
  );
});

exports.getCreatorHub = asyncHandler(async (req, res) => {
  const { creatorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return res.status(400).json({ error: "Invalid creator id" });
  }

  const viewerId = req.user?.id || "";
  const profile = await CreatorProfile.findById(creatorId).populate(
    "userId",
    "name username avatar followers isVerified emailVerified bio country"
  );
  if (!profile) {
    return res.status(404).json({ error: "Creator not found" });
  }

  const [musicTracksRaw, podcastTracksRaw, comedyTracksRaw, booksRaw, albumsRaw, comedyVideosRaw, continueRows] = await Promise.all([
    Track.find({ creatorId, kind: { $in: ["music", null] } }).sort({ playsCount: -1, createdAt: -1 }).limit(30).lean(),
    Track.find({ creatorId, kind: "podcast" }).sort({ createdAt: -1 }).limit(20).lean(),
    Track.find({ creatorId, kind: "comedy" }).sort({ createdAt: -1 }).limit(20).lean(),
    Book.find({ creatorId }).sort({ createdAt: -1 }).limit(20).lean(),
    Album.find({ creatorId, status: "published" }).sort({ createdAt: -1 }).limit(20).lean(),
    Video.find({ $or: [{ creatorProfileId: creatorId }, { userId: String(profile.userId?._id || "") }] })
      .sort({ time: -1, createdAt: -1 })
      .limit(20)
      .lean(),
    viewerId
      ? PlayerProgress.find({ userId: viewerId, creatorId }).sort({ playedAt: -1 }).limit(12).lean()
      : [],
  ]);

  const musicTracks = await Promise.all(
    musicTracksRaw.map((track) => mapTrackForHub({ track, req, userId: viewerId }))
  );
  const podcastTracks = await Promise.all(
    podcastTracksRaw.map((track) => mapTrackForHub({ track, req, userId: viewerId }))
  );
  const comedyTracks = await Promise.all(
    comedyTracksRaw.map((track) => mapTrackForHub({ track, req, userId: viewerId }))
  );
  const books = await Promise.all(booksRaw.map((book) => mapBookForHub({ book, req, userId: viewerId })));
  const albums = await Promise.all(albumsRaw.map((album) => mapAlbumForHub({ album, req, userId: viewerId })));

  const comedyVideos = await Promise.all(
    comedyVideosRaw.map(async (video) => {
      const entitled = Number(video.price || 0) <= 0 || (viewerId
        ? await hasEntitlement({ userId: viewerId, itemType: "video", itemId: video._id })
        : false);
      const sourceUrl = video.videoUrl || "";
      return {
        id: video._id.toString(),
        title: video.caption || "Comedy video",
        coverUrl: video.coverImageUrl || "",
        durationSec: Number(video.durationSec || 0),
        viewsCount: Number(video.viewsCount || 0),
        isFree: Number(video.price || 0) <= 0,
        priceNGN: Number(video.price || 0),
        priceUSD: Number(video.priceGlobal || 0),
        streamUrl: sourceUrl
          ? buildSignedMediaUrl({
              sourceUrl: entitled ? sourceUrl : sourceUrl,
              itemType: "video",
              itemId: video._id.toString(),
              userId: viewerId || "",
              req,
              expiresInSec: 10 * 60,
            })
          : "",
      };
    })
  );

  const continueListening = await Promise.all(
    (continueRows || []).map(async (row) => {
      if (!mongoose.Types.ObjectId.isValid(row.itemId)) return null;
      const track = await Track.findById(row.itemId).lean();
      if (!track) return null;
      return {
        type: row.itemType === "podcast" ? "podcast" : "song",
        itemId: row.itemId.toString(),
        title: track.title || "",
        coverUrl: track.coverImageUrl || "",
        creatorName: profile.displayName || "",
        progressSec: Number(row.positionSec || 0),
        durationSec: Number(row.durationSec || track.durationSec || 0),
      };
    })
  );

  const creatorUser = profile.userId || {};
  const followersCount = Array.isArray(creatorUser.followers) ? creatorUser.followers.length : 0;
  const monthlyListeners = musicTracks.reduce((sum, item) => sum + Number(item.playsCount || 0), 0);
  const totalPlays = musicTracks.reduce((sum, item) => sum + Number(item.playsCount || 0), 0)
    + albums.reduce((sum, item) => sum + Number(item.playCount || 0), 0);
  const paidPurchases = await Purchase.find({
    creatorId,
    status: "paid",
    itemType: { $in: ["track", "book", "album"] },
  }).select("amount").lean();
  const totalSales = paidPurchases.length;
  const revenueNGN = paidPurchases.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return res.json({
    creator: {
      id: profile._id.toString(),
      userId: creatorUser._id?.toString() || "",
      displayName: profile.displayName || "",
      username: creatorUser.username || "",
      avatarUrl: typeof creatorUser.avatar === "string" ? creatorUser.avatar : creatorUser.avatar?.url || "",
      bannerUrl: profile.heroBannerUrl || profile.coverImageUrl || "",
      tagline: profile.tagline || "",
      verified: Boolean(creatorUser.isVerified || creatorUser.emailVerified),
      followersCount,
      monthlyListeners,
      bio: profile.bio || "",
      location: creatorUser.country || "",
      creatorReady: Boolean(profile.onboardingComplete) && (musicTracks.length + podcastTracks.length + comedyTracks.length + books.length + albums.length + comedyVideos.length > 0),
      albumsCount: albums.length,
    },
    tracks: musicTracks,
    albums,
    books,
    podcasts: podcastTracks,
    comedy: [...comedyTracks, ...comedyVideos],
    stats: {
      totalPlays,
      totalSales,
      followerCount: followersCount,
      revenueNGN,
    },
    sections: {
      continueListening: continueListening.filter(Boolean),
      topTracks: musicTracks.slice(0, 12),
      latestPodcasts: podcastTracks.slice(0, 10),
      latestComedy: [...comedyTracks, ...comedyVideos].slice(0, 10),
      ebooks: books.slice(0, 10),
      latestAlbums: albums.slice(0, 10),
      allMusic: musicTracks,
      allPodcasts: podcastTracks,
      allComedy: [...comedyTracks, ...comedyVideos],
      allBooks: books,
      allAlbums: albums,
    },
    commerce: {
      currencyMode: profile.paymentModeDefault || "NG",
      supportedPaymentOptions: {
        NG: ["Paystack Card", "Bank Transfer", "USSD", "Verve", "Flutterwave"],
        GLOBAL: ["Card", "Apple Pay", "Google Pay", "Stripe", "PayPal"],
      },
    },
  });
});

exports.getCreatorDashboard = asyncHandler(async (req, res) => {
  const profile = await CreatorProfile.findOne({ userId: req.user.id }).lean();
  if (!profile?._id) {
    return res.status(404).json({ error: "Creator profile not found" });
  }

  const creatorId = profile._id;
  const [tracksCount, albumsCount, booksCount, salesRows] = await Promise.all([
    Track.countDocuments({ creatorId, kind: { $in: ["music", null] } }),
    Album.countDocuments({ creatorId, status: "published" }),
    Book.countDocuments({ creatorId }),
    Purchase.find({
      creatorId,
      status: "paid",
      itemType: { $in: ["track", "album", "book"] },
    }).select("amount").lean(),
  ]);

  const totalSales = salesRows.length;
  const revenueNGN = salesRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return res.json({
    creatorId: creatorId.toString(),
    tracksCount,
    albumsCount,
    booksCount,
    totalSales,
    revenueNGN,
  });
});

exports.toggleFollowCreator = asyncHandler(async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { creatorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return res.status(400).json({ error: "Invalid creator id" });
  }

  const profile = await CreatorProfile.findById(creatorId).select("userId").lean();
  if (!profile?.userId) {
    return res.status(404).json({ error: "Creator not found" });
  }

  const [me, creatorUser] = await Promise.all([
    User.findById(req.user.id).select("following"),
    User.findById(profile.userId).select("followers"),
  ]);
  if (!me || !creatorUser) {
    return res.status(404).json({ error: "User not found" });
  }

  const creatorUserId = creatorUser._id.toString();
  const meId = me._id.toString();
  const isFollowing = (me.following || []).some((id) => id.toString() === creatorUserId);

  if (isFollowing) {
    me.following.pull(creatorUserId);
    creatorUser.followers.pull(meId);
  } else {
    me.following.addToSet(creatorUserId);
    creatorUser.followers.addToSet(meId);
  }

  await Promise.all([me.save(), creatorUser.save()]);

  return res.json({
    success: true,
    following: !isFollowing,
    followersCount: Array.isArray(creatorUser.followers) ? creatorUser.followers.length : 0,
  });
});
