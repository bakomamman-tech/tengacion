const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const User = require("../models/User");
const Track = require("../models/Track");
const Book = require("../models/Book");
const Album = require("../models/Album");
const Video = require("../models/Video");
const Entitlement = require("../models/Entitlement");
const Purchase = require("../models/Purchase");
const CreatorProfile = require("../models/CreatorProfile");
const PlayerProgress = require("../models/PlayerProgress");
const { buildAlbumArchiveUrl } = require("../services/albumArchiveService");
const { hasEntitlement } = require("../services/entitlementService");
const { resolvePurchasableItem } = require("../services/catalogService");
const { buildSignedMediaUrl } = require("../services/mediaSigner");
const {
  createProviderReference,
  initializeTransaction,
} = require("../services/paymentProviders/paystack");
const { logAnalyticsEvent, touchUserActivity } = require("../services/analyticsService");

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

const resolveSourceUrl = (item) => {
  if (!item || !item.payload) {
    return "";
  }
  if (item.itemType === "track") {
    return String(item.payload.audioUrl || "");
  }
  if (item.itemType === "book") {
    return String(item.payload.contentUrl || "");
  }
  if (item.itemType === "album") {
    const tracks = Array.isArray(item.payload.tracks) ? item.payload.tracks : [];
    return String(tracks[0]?.trackUrl || "");
  }
  if (item.itemType === "video") {
    return String(item.payload.videoUrl || "");
  }
  return "";
};

const resolvePreviewSourceUrl = (item) => {
  if (!item || !item.payload) return "";
  if (item.itemType === "track") {
    return String(item.payload.previewUrl || (Number(item.payload.price || 0) <= 0 ? item.payload.audioUrl || "" : ""));
  }
  if (item.itemType === "album") {
    const firstTrack = Array.isArray(item.payload.tracks) ? item.payload.tracks[0] : null;
    return String(firstTrack?.previewUrl || (Number(item.payload.price || 0) <= 0 ? firstTrack?.trackUrl || "" : ""));
  }
  if (item.itemType === "book") {
    return String(item.payload.previewUrl || (item.payload.isFreePreview ? item.payload.contentUrl || item.payload.fileUrl || "" : ""));
  }
  if (item.itemType === "video") {
    return String(item.payload.previewClipUrl || (Number(item.payload.price || 0) <= 0 ? item.payload.videoUrl || "" : ""));
  }
  return "";
};

const checkOwnerAccess = async ({ userId, item }) => {
  if (!userId || !item?.payload) {
    return false;
  }

  if (item.itemType === "track" || item.itemType === "book" || item.itemType === "album") {
    const creator = await CreatorProfile.findById(item.payload.creatorId).select("userId").lean();
    return String(creator?.userId || "") === String(userId);
  }

  if (item.itemType === "video") {
    const directOwner = String(item.payload.userId || "");
    if (directOwner && directOwner === String(userId)) {
      return true;
    }
    if (item.payload.creatorProfileId) {
      const creator = await CreatorProfile.findById(item.payload.creatorProfileId).select("userId").lean();
      return String(creator?.userId || "") === String(userId);
    }
  }

  return false;
};

exports.savePlayerProgress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const itemType = String(req.body?.itemType || "").trim().toLowerCase();
  const itemId = String(req.body?.itemId || "").trim();
  const creatorIdBody = String(req.body?.creatorId || "").trim();
  const positionSec = Math.max(0, Number(req.body?.positionSec || 0));
  const durationSec = Math.max(0, Number(req.body?.durationSec || 0));

  if (!["song", "podcast"].includes(itemType)) {
    return res.status(400).json({ error: "itemType must be song or podcast" });
  }

  if (!isValidId(itemId)) {
    return res.status(400).json({ error: "itemId must be a valid id" });
  }

  const track = await Track.findById(itemId).select("creatorId kind durationSec").lean();
  if (!track) {
    return res.status(404).json({ error: "Item not found" });
  }

  if (itemType === "podcast" && track.kind !== "podcast") {
    return res.status(400).json({ error: "Item type mismatch for podcast progress" });
  }

  const creatorId = isValidId(creatorIdBody)
    ? creatorIdBody
    : track.creatorId?.toString();

  if (!creatorId || !isValidId(creatorId)) {
    return res.status(400).json({ error: "creatorId is required" });
  }

  const progress = await PlayerProgress.findOneAndUpdate(
    { userId, itemType, itemId },
    {
      $set: {
        creatorId,
        positionSec,
        durationSec: durationSec || Number(track.durationSec || 0),
        playedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return res.status(201).json({
    success: true,
    progress: {
      id: progress._id.toString(),
      itemType: progress.itemType,
      itemId: progress.itemId.toString(),
      creatorId: progress.creatorId.toString(),
      positionSec: Number(progress.positionSec || 0),
      durationSec: Number(progress.durationSec || 0),
      playedAt: progress.playedAt,
    },
  });
});

exports.getContinueListening = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const creatorId = String(req.query?.creatorId || "").trim();
  const query = { userId };
  if (creatorId) {
    if (!isValidId(creatorId)) {
      return res.status(400).json({ error: "Invalid creatorId" });
    }
    query.creatorId = creatorId;
  }

  const rows = await PlayerProgress.find(query).sort({ playedAt: -1 }).limit(20).lean();
  const items = await Promise.all(
    rows.map(async (row) => {
      const track = await Track.findById(row.itemId).select("title coverImageUrl durationSec price previewUrl audioUrl").lean();
      if (!track) return null;
      const entitled = Number(track.price || 0) <= 0 || (await hasEntitlement({
        userId,
        itemType: "track",
        itemId: track._id,
      }));
      const sourceUrl = entitled ? track.audioUrl : track.previewUrl || track.audioUrl;
      return {
        type: row.itemType,
        itemId: row.itemId.toString(),
        title: track.title || "",
        coverUrl: track.coverImageUrl || "",
        progressSec: Number(row.positionSec || 0),
        durationSec: Number(row.durationSec || track.durationSec || 0),
        streamUrl: sourceUrl
          ? buildSignedMediaUrl({
              sourceUrl,
              itemType: "track",
              itemId: row.itemId.toString(),
              userId,
              req,
              expiresInSec: 10 * 60,
            })
          : "",
      };
    })
  );

  return res.json(items.filter(Boolean));
});

exports.createCheckout = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const itemType = String(req.body?.itemType || "").trim().toLowerCase();
  const itemId = String(req.body?.itemId || "").trim();
  const currencyMode = String(req.body?.currencyMode || "NG").trim().toUpperCase();

  if (!itemType || !itemId) {
    return res.status(400).json({ error: "itemType and itemId are required" });
  }

  const item = await resolvePurchasableItem(itemType, itemId);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  const amount = Number(item.price || 0);
  if (amount <= 0) {
    return res.status(400).json({ error: "Item is free and does not require checkout" });
  }

  const user = await User.findById(userId).select("email").lean();
  if (!user?.email) {
    return res.status(400).json({ error: "User email is required for payment" });
  }

  const providerRef = createProviderReference({
    userId,
    itemType: item.itemType,
    itemId: item.itemId.toString(),
  });

  const purchase = await Purchase.create({
    userId,
    creatorId: item.creatorId || undefined,
    itemType: item.itemType,
    itemId: item.itemId,
    amount,
    priceNGN: amount,
    currency: "NGN",
    status: "pending",
    provider: "paystack",
    providerRef,
  });

  try {
    const payment = await initializeTransaction({
      email: user.email,
      amountNgn: amount,
      reference: providerRef,
      callbackUrl: process.env.PAYSTACK_CALLBACK_URL || "",
      metadata: {
        app: "tengacion",
        itemType: item.itemType,
        itemId: item.itemId.toString(),
        purchaseId: purchase._id.toString(),
        userId,
        currencyMode,
      },
    });

    return res.status(201).json({
      purchaseId: purchase._id.toString(),
      checkoutUrl: payment.authorization_url,
      reference: payment.reference || providerRef,
      itemType: item.itemType,
      itemId: item.itemId.toString(),
      amount,
      currency: "NGN",
      currencyMode: ["NG", "GLOBAL"].includes(currencyMode) ? currencyMode : "NG",
      supportedPaymentOptions: {
        NG: ["Paystack Card", "Bank Transfer", "USSD", "Verve", "Flutterwave"],
        GLOBAL: ["Card", "Apple Pay", "Google Pay", "Stripe", "PayPal"],
      },
    });
  } catch (error) {
    await Purchase.updateOne({ _id: purchase._id }, { $set: { status: "failed" } });
    await logAnalyticsEvent({
      type: "purchase_failed",
      userId,
      actorRole: req.user?.role || "user",
      targetId: purchase._id,
      targetType: "purchase",
      contentType: item.itemType,
      metadata: {
        creatorId: item.creatorId?.toString?.() || "",
        itemId: item.itemId.toString(),
        amount,
        reason: error.message || "Checkout initialization failed",
      },
    }).catch(() => null);
    return res.status(502).json({ error: error.message || "Checkout initialization failed" });
  }
});

exports.getMyEntitlements = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const creatorId = String(req.query?.creatorId || "").trim();

  const [purchases, directEntitlements] = await Promise.all([
    Purchase.find({ userId, status: "paid" })
    .select("itemType itemId paidAt")
    .sort({ paidAt: -1, createdAt: -1 })
    .lean(),
    Entitlement.find({ buyerId: userId }).select("itemType itemId grantedAt").lean(),
  ]);

  let trackMap = new Map();
  let bookMap = new Map();
  let albumMap = new Map();
  let videoMap = new Map();

  const trackIds = purchases.filter((row) => row.itemType === "track").map((row) => row.itemId);
  const bookIds = purchases.filter((row) => row.itemType === "book").map((row) => row.itemId);
  const albumIds = purchases.filter((row) => row.itemType === "album").map((row) => row.itemId);
  const videoIds = purchases.filter((row) => row.itemType === "video").map((row) => row.itemId);

  if (trackIds.length) {
    const query = { _id: { $in: trackIds } };
    if (creatorId && isValidId(creatorId)) query.creatorId = creatorId;
    const tracks = await Track.find(query).select("_id creatorId").lean();
    trackMap = new Map(tracks.map((row) => [String(row._id), String(row.creatorId || "")]));
  }

  if (bookIds.length) {
    const query = { _id: { $in: bookIds } };
    if (creatorId && isValidId(creatorId)) query.creatorId = creatorId;
    const books = await Book.find(query).select("_id creatorId").lean();
    bookMap = new Map(books.map((row) => [String(row._id), String(row.creatorId || "")]));
  }

  if (videoIds.length) {
    const query = { _id: { $in: videoIds } };
    if (creatorId && isValidId(creatorId)) query.creatorProfileId = creatorId;
    const videos = await Video.find(query).select("_id creatorProfileId").lean();
    videoMap = new Map(videos.map((row) => [String(row._id), String(row.creatorProfileId || "")]));
  }

  if (albumIds.length) {
    const query = { _id: { $in: albumIds } };
    if (creatorId && isValidId(creatorId)) query.creatorId = creatorId;
    const albums = await Album.find(query).select("_id creatorId").lean();
    albumMap = new Map(albums.map((row) => [String(row._id), String(row.creatorId || "")]));
  }

  const purchaseEntitlements = purchases
    .filter((row) => {
      if (!creatorId) return true;
      const key = String(row.itemId || "");
      if (row.itemType === "track") return trackMap.has(key);
      if (row.itemType === "book") return bookMap.has(key);
      if (row.itemType === "album") return albumMap.has(key);
      if (row.itemType === "video") return videoMap.has(key);
      return false;
    })
    .map((row) => ({
      itemType: row.itemType,
      itemId: String(row.itemId || ""),
      paidAt: row.paidAt || null,
    }));

  const entitlementMap = new Map(
    purchaseEntitlements.map((row) => [`${row.itemType}:${row.itemId}`, row])
  );
  for (const row of directEntitlements) {
    const key = `${row.itemType}:${String(row.itemId || "")}`;
    if (!entitlementMap.has(key)) {
      entitlementMap.set(key, {
        itemType: row.itemType,
        itemId: String(row.itemId || ""),
        paidAt: row.grantedAt || null,
      });
    }
  }

  return res.json({ entitlements: Array.from(entitlementMap.values()) });
});

exports.getMyLibrary = asyncHandler(async (req, res) => {
  const rows = await Entitlement.find({ buyerId: req.user.id })
    .sort({ grantedAt: -1, createdAt: -1 })
    .lean();

  return res.json({
    items: rows.map((row) => ({
      itemType: row.itemType,
      itemId: String(row.itemId || ""),
      grantedAt: row.grantedAt || row.createdAt || null,
    })),
  });
});

exports.getProtectedStream = asyncHandler(async (req, res) => {
  const itemType = String(req.params?.itemType || "").trim().toLowerCase();
  const itemId = String(req.params?.itemId || "").trim();
  if (!itemType || !itemId) {
    return res.status(400).json({ error: "itemType and itemId are required" });
  }

  const item = await resolvePurchasableItem(itemType, itemId);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  const userId = req.user?.id || "";
  const fullSourceUrl = resolveSourceUrl(item);
  const previewSourceUrl = resolvePreviewSourceUrl(item);
  const freeAccess = Number(item.price || 0) <= 0;
  const ownerAccess = await checkOwnerAccess({ userId, item });
  const paidAccess = userId
    ? await hasEntitlement({ userId, itemType: item.itemType, itemId: item.itemId })
    : false;
  const canAccessFull = freeAccess || ownerAccess || paidAccess;
  const sourceUrl = canAccessFull ? fullSourceUrl : previewSourceUrl;

  if (!sourceUrl) {
    return res.status(canAccessFull ? 404 : 402).json({
      error: canAccessFull ? "Stream source not available" : "Preview unavailable, purchase required",
      paywall: !canAccessFull,
      itemType: item.itemType,
      itemId: item.itemId.toString(),
    });
  }

  if (item.itemType === "track") {
    await Track.updateOne({ _id: item.itemId }, { $inc: { playsCount: 1, playCount: 1 } }).catch(() => null);
  } else if (item.itemType === "album") {
    await Album.updateOne({ _id: item.itemId }, { $inc: { playCount: 1 } }).catch(() => null);
  }
  await touchUserActivity({ userId, seenAt: new Date() }).catch(() => null);
  await logAnalyticsEvent({
    type: canAccessFull ? "stream_completed" : "stream_started",
    userId,
    actorRole: req.user?.role || "user",
    targetId: item.itemId,
    targetType: item.itemType,
    contentType: item.itemType,
    metadata: {
      creatorId: item.creatorId?.toString?.() || item.payload?.creatorId?.toString?.() || item.payload?.creatorProfileId?.toString?.() || "",
      previewOnly: !canAccessFull,
    },
  }).catch(() => null);

  const streamUrl = buildSignedMediaUrl({
    sourceUrl,
    itemType: item.itemType,
    itemId: item.itemId.toString(),
    userId: userId || "",
    req,
    expiresInSec: 10 * 60,
  });

  return res.json({
    itemType: item.itemType,
    itemId: item.itemId.toString(),
    canAccessFull,
    previewOnly: !canAccessFull,
    streamUrl,
  });
});

exports.getProtectedDownload = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const itemType = String(req.params?.itemType || "").trim().toLowerCase();
  const itemId = String(req.params?.itemId || "").trim();

  if (!itemType || !itemId) {
    return res.status(400).json({ error: "itemType and itemId are required" });
  }

  const item = await resolvePurchasableItem(itemType, itemId);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  const sourceUrl = resolveSourceUrl(item);
  const isAlbumDownload = item.itemType === "album";
  if (!isAlbumDownload && !sourceUrl) {
    return res.status(404).json({ error: "Download source not available" });
  }

  const freeAccess = Number(item.price || 0) <= 0;
  const ownerAccess = await checkOwnerAccess({ userId, item });
  const paidAccess =
    !freeAccess &&
    (await hasEntitlement({
      userId,
      itemType: item.itemType,
      itemId: item.itemId,
    }));

  if (!freeAccess && !ownerAccess && !paidAccess) {
    return res.status(402).json({
      error: "Purchase required before download",
      itemType: item.itemType,
      itemId: item.itemId.toString(),
      paywall: true,
    });
  }

  const downloadUrl = isAlbumDownload
    ? buildAlbumArchiveUrl({
        albumId: item.itemId.toString(),
        req,
        userId,
      })
    : buildSignedMediaUrl({
        sourceUrl,
        itemType: item.itemType,
        itemId: item.itemId.toString(),
        userId,
        allowDownload: true,
        req,
        expiresInSec: 10 * 60,
      });

  await touchUserActivity({ userId, seenAt: new Date() }).catch(() => null);
  await logAnalyticsEvent({
    type: "download_completed",
    userId,
    actorRole: req.user?.role || "user",
    targetId: item.itemId,
    targetType: item.itemType,
    contentType: item.itemType,
    metadata: {
      creatorId: item.creatorId?.toString?.() || item.payload?.creatorId?.toString?.() || item.payload?.creatorProfileId?.toString?.() || "",
    },
  }).catch(() => null);

  return res.json({
    itemType: item.itemType,
    itemId: item.itemId.toString(),
    downloadUrl,
  });
});
