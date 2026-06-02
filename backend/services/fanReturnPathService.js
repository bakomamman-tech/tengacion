const mongoose = require("mongoose");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const CreatorProfile = require("../models/CreatorProfile");
const LiveReminder = require("../models/LiveReminder");
const LiveSession = require("../models/LiveSession");
const Purchase = require("../models/Purchase");
const SavedCreatorContent = require("../models/SavedCreatorContent");
const User = require("../models/User");
const { logAnalyticsEvent } = require("./analyticsService");
const { resolvePurchasableItem } = require("./catalogService");
const { createNotification } = require("./notificationService");

const FAN_RETURN_EVENT_TYPES = [
  "creator_followed",
  "creator_unfollowed",
  "content_saved",
  "content_unsaved",
  "continue_progress_saved",
  "paid_content_unlocked",
  "creator_subscribed",
  "live_reminder_set",
  "subscription_renewal_upcoming_notification_sent",
  "subscription_renewal_failed_notification_sent",
  "paid_content_published_notification_sent",
  "saved_content_update_notification_sent",
  "subscribed_creator_live_notification_sent",
  "live_reminder_notification_sent",
];

const ITEM_MODEL_BY_TYPE = {
  track: "Track",
  book: "Book",
  album: "Album",
  video: "Video",
};

const ITEM_ROUTE_BY_TYPE = {
  track: "tracks",
  book: "books",
  album: "albums",
  video: "videos",
};

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const isValidId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const normalizeItemType = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["song", "music"].includes(normalized)) return "track";
  if (["podcast", "podcast_episode"].includes(normalized)) return "track";
  if (["track", "book", "album", "video"].includes(normalized)) return normalized;
  return "";
};

const normalizeProgressItemType = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["song", "track", "music"].includes(normalized)) return "song";
  if (["podcast", "podcast_episode"].includes(normalized)) return "podcast";
  if (["book", "ebook", "pdf_book"].includes(normalized)) return "book";
  return "";
};

const buildContentRoute = ({ itemType = "", itemId = "" } = {}) => {
  const segment = ITEM_ROUTE_BY_TYPE[itemType];
  return segment && itemId ? `/${segment}/${itemId}` : "";
};

const dateKey = (date = new Date()) => {
  const current = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(current.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return current.toISOString().slice(0, 10);
};

const getSocketContext = (req = null) => ({
  io: req?.app?.get?.("io") || null,
  onlineUsers: req?.app?.get?.("onlineUsers") || null,
});

const getCreatorProfileById = async (creatorId) => {
  if (!isValidId(creatorId)) return null;
  return CreatorProfile.findById(creatorId)
    .select("displayName fullName userId")
    .populate("userId", "_id name username followers avatar")
    .lean();
};

const getCreatorProfileByUserId = async (userId) => {
  if (!isValidId(userId)) return null;
  return CreatorProfile.findOne({ userId })
    .select("displayName fullName userId")
    .populate("userId", "_id name username followers avatar")
    .lean();
};

const getCreatorAudienceUserIds = async ({ creatorProfile, itemType = "", itemId = "" } = {}) => {
  const creatorUser = creatorProfile?.userId && typeof creatorProfile.userId === "object"
    ? creatorProfile.userId
    : null;
  const creatorId = toIdString(creatorProfile?._id);
  const creatorUserId = toIdString(creatorUser?._id || creatorProfile?.userId);
  const followers = Array.isArray(creatorUser?.followers)
    ? creatorUser.followers.map(toIdString)
    : [];
  const now = new Date();

  const [subscriberIds, savedUserIds] = await Promise.all([
    creatorId
      ? Purchase.distinct("userId", {
          creatorId,
          itemType: "subscription",
          status: "paid",
          $or: [{ accessExpiresAt: null }, { accessExpiresAt: { $gt: now } }],
        }).catch(() => [])
      : [],
    itemType && itemId
      ? SavedCreatorContent.distinct("userId", {
          itemType,
          itemId,
        }).catch(() => [])
      : [],
  ]);

  return [...new Set([
    ...followers,
    ...subscriberIds.map(toIdString),
    ...savedUserIds.map(toIdString),
  ])].filter((id) => id && id !== creatorUserId && isValidId(id));
};

const logFanReturnEvent = ({
  type,
  userId = null,
  actorRole = "user",
  targetId = null,
  targetType = "",
  contentType = "",
  metadata = {},
} = {}) => {
  if (!FAN_RETURN_EVENT_TYPES.includes(type)) {
    return Promise.resolve(null);
  }
  return logAnalyticsEvent({
    type,
    userId,
    actorRole,
    targetId,
    targetType,
    contentType,
    metadata,
  }).catch(() => null);
};

const resolveCreatorContent = async ({ itemType, itemId } = {}) => {
  const normalizedType = normalizeItemType(itemType);
  if (!normalizedType || !isValidId(itemId)) {
    const error = new Error("Valid itemType and itemId are required");
    error.status = 400;
    throw error;
  }

  const item = await resolvePurchasableItem(normalizedType, itemId);
  if (!item || item.itemType === "subscription") {
    const error = new Error("Creator content not found");
    error.status = 404;
    throw error;
  }

  return {
    item,
    itemType: item.itemType,
    itemId: toIdString(item.itemId),
    creatorId: toIdString(item.creatorId),
    title: item.title || "Creator content",
    price: Number(item.price || 0),
    route: buildContentRoute({
      itemType: item.itemType,
      itemId: toIdString(item.itemId),
    }),
    entityModel: ITEM_MODEL_BY_TYPE[item.itemType] || "Post",
  };
};

const createFanNotification = async ({
  recipient,
  sender,
  text,
  entity,
  metadata = {},
  req = null,
} = {}) => {
  if (!recipient || !sender || String(recipient) === String(sender)) {
    return null;
  }
  const { io, onlineUsers } = getSocketContext(req);
  return createNotification({
    recipient,
    sender,
    type: "system",
    text,
    entity,
    metadata,
    io,
    onlineUsers,
  });
};

const recordCreatorFollow = async ({
  req = null,
  viewerId,
  creatorProfile,
  following,
} = {}) => {
  const creatorId = toIdString(creatorProfile?._id);
  const creatorUserId = toIdString(creatorProfile?.userId);
  await logFanReturnEvent({
    type: following ? "creator_followed" : "creator_unfollowed",
    userId: viewerId,
    actorRole: req?.user?.role || "user",
    targetId: creatorId,
    targetType: "creator",
    contentType: "creator",
    metadata: {
      creatorId,
      creatorUserId,
      source: "creator_follow_toggle",
    },
  });

  if (!following || !creatorUserId) {
    return null;
  }

  return createNotification({
    recipient: creatorUserId,
    sender: viewerId,
    type: "follow",
    text: "started following your creator page",
    entity: {
      id: viewerId,
      model: "User",
    },
    metadata: {
      eventType: "creator_followed",
      creatorId,
      link: `/creator/${creatorId}`,
      dedupeKey: `creator_followed:${creatorId}:${viewerId}`,
    },
    ...getSocketContext(req),
  });
};

const saveCreatorContent = async ({ req = null, userId, itemType, itemId } = {}) => {
  const resolved = await resolveCreatorContent({ itemType, itemId });
  const saved = await SavedCreatorContent.findOneAndUpdate(
    {
      userId,
      itemType: resolved.itemType,
      itemId: resolved.itemId,
    },
    {
      $set: {
        creatorId: resolved.creatorId,
        savedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  ).lean();

  await logFanReturnEvent({
    type: "content_saved",
    userId,
    actorRole: req?.user?.role || "user",
    targetId: resolved.itemId,
    targetType: resolved.itemType,
    contentType: resolved.itemType,
    metadata: {
      creatorId: resolved.creatorId,
      title: resolved.title,
      route: resolved.route,
    },
  });

  return {
    saved: true,
    item: {
      id: toIdString(saved._id),
      itemType: resolved.itemType,
      itemId: resolved.itemId,
      creatorId: resolved.creatorId,
      title: resolved.title,
      route: resolved.route,
      savedAt: saved.savedAt,
    },
  };
};

const removeSavedCreatorContent = async ({ req = null, userId, itemType, itemId } = {}) => {
  const normalizedType = normalizeItemType(itemType);
  if (!normalizedType || !isValidId(itemId)) {
    const error = new Error("Valid itemType and itemId are required");
    error.status = 400;
    throw error;
  }

  const removed = await SavedCreatorContent.findOneAndDelete({
    userId,
    itemType: normalizedType,
    itemId,
  }).lean();

  await logFanReturnEvent({
    type: "content_unsaved",
    userId,
    actorRole: req?.user?.role || "user",
    targetId: itemId,
    targetType: normalizedType,
    contentType: normalizedType,
    metadata: {
      creatorId: toIdString(removed?.creatorId),
      removed: Boolean(removed),
    },
  });

  return { saved: false, removed: Boolean(removed) };
};

const listSavedCreatorContent = async ({ userId, limit = 30 } = {}) => {
  const rows = await SavedCreatorContent.find({ userId })
    .sort({ savedAt: -1, createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit) || 30)))
    .lean();

  const items = await Promise.all(
    rows.map(async (row) => {
      try {
        const resolved = await resolveCreatorContent({
          itemType: row.itemType,
          itemId: row.itemId,
        });
        return {
          id: toIdString(row._id),
          itemType: resolved.itemType,
          itemId: resolved.itemId,
          creatorId: resolved.creatorId,
          title: resolved.title,
          price: resolved.price,
          route: resolved.route,
          savedAt: row.savedAt,
        };
      } catch {
        return null;
      }
    })
  );

  return {
    items: items.filter(Boolean),
  };
};

const recordProgressSaved = ({
  req = null,
  userId,
  itemType,
  itemId,
  creatorId,
  positionSec = 0,
  durationSec = 0,
} = {}) =>
  logFanReturnEvent({
    type: "continue_progress_saved",
    userId,
    actorRole: req?.user?.role || "user",
    targetId: itemId,
    targetType: itemType,
    contentType: itemType,
    metadata: {
      creatorId: toIdString(creatorId),
      positionSec: Number(positionSec || 0),
      durationSec: Number(durationSec || 0),
      progressRatio:
        Number(durationSec || 0) > 0
          ? Number((Number(positionSec || 0) / Number(durationSec || 0)).toFixed(4))
          : 0,
    },
  });

const notifyPurchaseUnlocked = async ({ req = null, purchase } = {}) => {
  if (!purchase?._id || !purchase.userId) {
    return { sent: false, skipped: true, reason: "missing_purchase" };
  }

  const creatorProfile = await getCreatorProfileById(purchase.creatorId);
  const creatorUserId = toIdString(creatorProfile?.userId?._id || creatorProfile?.userId);
  const isSubscription = purchase.itemType === "subscription";
  let title = isSubscription ? (creatorProfile?.displayName || "Creator membership") : "Creator content";
  let route = "/purchases";
  let entityModel = "Purchase";

  if (!isSubscription) {
    try {
      const resolved = await resolveCreatorContent({
        itemType: purchase.itemType,
        itemId: purchase.itemId,
      });
      title = resolved.title;
      route = resolved.route;
      entityModel = resolved.entityModel;
    } catch {
      // Keep the generic purchase notification if the catalog item was removed.
    }
  } else if (purchase.creatorId) {
    route = `/creators/${toIdString(purchase.creatorId)}`;
  }

  await logFanReturnEvent({
    type: isSubscription ? "creator_subscribed" : "paid_content_unlocked",
    userId: purchase.userId,
    targetId: purchase._id,
    targetType: "purchase",
    contentType: purchase.itemType,
    metadata: {
      creatorId: toIdString(purchase.creatorId),
      itemId: toIdString(purchase.itemId),
      amount: Number(purchase.amount || 0),
      provider: purchase.provider || "",
      route,
    },
  });

  const notification = await createFanNotification({
    recipient: purchase.userId,
    sender: creatorUserId || purchase.userId,
    text: isSubscription
      ? `${title} membership is active. Your receipt is ready.`
      : `Payment succeeded. ${title} is unlocked and your receipt is ready.`,
    entity: {
      id: isSubscription ? purchase._id : purchase.itemId,
      model: isSubscription ? "Purchase" : entityModel,
    },
    metadata: {
      eventType: isSubscription ? "creator_subscribed" : "paid_content_unlocked",
      creatorId: toIdString(purchase.creatorId),
      purchaseId: toIdString(purchase._id),
      itemType: purchase.itemType,
      itemId: toIdString(purchase.itemId),
      link: route,
      receiptPath: `/purchases/${toIdString(purchase._id)}`,
      dedupeKey: `purchase_unlocked:${toIdString(purchase._id)}`,
    },
    req,
  });

  return {
    sent: Boolean(notification),
    notificationId: toIdString(notification?._id),
  };
};

const notifyCreatorPublishedPaidContent = async ({
  req = null,
  creatorProfile,
  itemType,
  itemId,
  title = "",
  price = 0,
} = {}) => {
  const normalizedType = normalizeItemType(itemType);
  const creatorId = toIdString(creatorProfile?._id);
  const creatorUserId = toIdString(creatorProfile?.userId);
  if (!creatorId || !creatorUserId || !normalizedType || !isValidId(itemId) || Number(price || 0) <= 0) {
    return { sentCount: 0, skipped: true };
  }

  const route = buildContentRoute({ itemType: normalizedType, itemId });
  const recipients = await getCreatorAudienceUserIds({
    creatorProfile: await getCreatorProfileById(creatorId),
    itemType: normalizedType,
    itemId,
  });
  const limitedRecipients = recipients.slice(0, 200);
  const notifications = await Promise.all(
    limitedRecipients.map((recipient) =>
      createFanNotification({
        recipient,
        sender: creatorUserId,
        text: `${title || "New paid creator content"} is now available.`,
        entity: {
          id: itemId,
          model: ITEM_MODEL_BY_TYPE[normalizedType] || "Post",
        },
        metadata: {
          eventType: "creator_published_paid_content",
          creatorId,
          itemType: normalizedType,
          itemId: toIdString(itemId),
          link: route,
          dedupeKey: `paid_content_published:${normalizedType}:${toIdString(itemId)}`,
        },
        req,
      })
    )
  );
  const sentCount = notifications.filter(Boolean).length;

  await logFanReturnEvent({
    type: "paid_content_published_notification_sent",
    userId: creatorUserId,
    actorRole: "creator",
    targetId: itemId,
    targetType: normalizedType,
    contentType: normalizedType,
    metadata: {
      creatorId,
      recipientCount: limitedRecipients.length,
      sentCount,
      title,
      price: Number(price || 0),
    },
  });

  return { sentCount, recipientCount: limitedRecipients.length };
};

const notifySubscriptionRenewalUpcoming = async ({
  req = null,
  purchase,
  daysUntilRenewal = null,
  renewalAt = null,
} = {}) => {
  if (!purchase?._id || purchase.itemType !== "subscription" || !purchase.userId) {
    return { sent: false, skipped: true, reason: "missing_subscription_purchase" };
  }

  const creatorProfile = await getCreatorProfileById(purchase.creatorId);
  const creatorId = toIdString(creatorProfile?._id || purchase.creatorId);
  const creatorUserId = toIdString(creatorProfile?.userId?._id || creatorProfile?.userId);
  if (!creatorId || !creatorUserId) {
    return { sent: false, skipped: true, reason: "missing_creator" };
  }

  const resolvedRenewalAt = renewalAt || purchase.accessExpiresAt || null;
  const title = creatorProfile?.displayName || creatorProfile?.fullName || "Creator";
  const route = `/creators/${creatorId}`;
  const notification = await createFanNotification({
    recipient: purchase.userId,
    sender: creatorUserId,
    text: `${title} membership renews soon.`,
    entity: {
      id: purchase._id,
      model: "Purchase",
    },
    metadata: {
      eventType: "subscription_renewal_upcoming",
      creatorId,
      purchaseId: toIdString(purchase._id),
      renewalAt: resolvedRenewalAt || "",
      daysUntilRenewal: daysUntilRenewal == null ? "" : Number(daysUntilRenewal || 0),
      link: route,
      dedupeKey: `subscription_renewal_upcoming:${toIdString(purchase._id)}:${dateKey(resolvedRenewalAt || new Date())}`,
    },
    req,
  });

  await logFanReturnEvent({
    type: "subscription_renewal_upcoming_notification_sent",
    userId: purchase.userId,
    actorRole: "system",
    targetId: purchase._id,
    targetType: "purchase",
    contentType: "subscription",
    metadata: {
      creatorId,
      renewalAt: resolvedRenewalAt || "",
      notificationSent: Boolean(notification),
    },
  });

  return {
    sent: Boolean(notification),
    notificationId: toIdString(notification?._id),
  };
};

const notifySubscriptionRenewalFailed = async ({
  req = null,
  purchase,
  reason = "renewal_failed",
} = {}) => {
  if (!purchase?._id || purchase.itemType !== "subscription" || !purchase.userId) {
    return { sent: false, skipped: true, reason: "missing_subscription_purchase" };
  }

  const creatorProfile = await getCreatorProfileById(purchase.creatorId);
  const creatorId = toIdString(creatorProfile?._id || purchase.creatorId);
  const creatorUserId = toIdString(creatorProfile?.userId?._id || creatorProfile?.userId);
  if (!creatorId || !creatorUserId) {
    return { sent: false, skipped: true, reason: "missing_creator" };
  }

  const title = creatorProfile?.displayName || creatorProfile?.fullName || "Creator";
  const notification = await createFanNotification({
    recipient: purchase.userId,
    sender: creatorUserId,
    text: `${title} membership payment failed. Update payment to keep access.`,
    entity: {
      id: purchase._id,
      model: "Purchase",
    },
    metadata: {
      eventType: "subscription_renewal_failed",
      creatorId,
      purchaseId: toIdString(purchase._id),
      reason,
      link: "/purchases",
      dedupeKey: `subscription_renewal_failed:${toIdString(purchase._id)}:${dateKey()}`,
    },
    req,
  });

  await logFanReturnEvent({
    type: "subscription_renewal_failed_notification_sent",
    userId: purchase.userId,
    actorRole: "system",
    targetId: purchase._id,
    targetType: "purchase",
    contentType: "subscription",
    metadata: {
      creatorId,
      reason,
      notificationSent: Boolean(notification),
    },
  });

  return {
    sent: Boolean(notification),
    notificationId: toIdString(notification?._id),
  };
};

const notifySavedContentUpdated = async ({
  req = null,
  creatorProfile,
  itemType,
  itemId,
  title = "",
  reason = "content_updated",
} = {}) => {
  const normalizedType = normalizeItemType(itemType);
  const creatorId = toIdString(creatorProfile?._id);
  const creatorUserId = toIdString(creatorProfile?.userId);
  if (!creatorId || !creatorUserId || !normalizedType || !isValidId(itemId)) {
    return { sentCount: 0, skipped: true };
  }

  const savedRows = await SavedCreatorContent.find({
    itemType: normalizedType,
    itemId,
  }).select("userId").lean();
  const recipients = [...new Set(savedRows.map((row) => toIdString(row.userId)))]
    .filter((id) => id && id !== creatorUserId)
    .slice(0, 200);
  const currentDateKey = dateKey();
  const route = buildContentRoute({ itemType: normalizedType, itemId });
  const notifications = await Promise.all(
    recipients.map((recipient) =>
      createFanNotification({
        recipient,
        sender: creatorUserId,
        text: `${title || "Saved creator content"} has an update.`,
        entity: {
          id: itemId,
          model: ITEM_MODEL_BY_TYPE[normalizedType] || "Post",
        },
        metadata: {
          eventType: "saved_content_updated",
          creatorId,
          itemType: normalizedType,
          itemId: toIdString(itemId),
          reason,
          link: route,
          dedupeKey: `saved_content_updated:${normalizedType}:${toIdString(itemId)}:${currentDateKey}`,
        },
        req,
      })
    )
  );
  const sentCount = notifications.filter(Boolean).length;

  if (sentCount) {
    await SavedCreatorContent.updateMany(
      {
        itemType: normalizedType,
        itemId,
        userId: { $in: recipients },
      },
      { $set: { lastNotifiedAt: new Date() } }
    ).catch(() => null);
  }

  await logFanReturnEvent({
    type: "saved_content_update_notification_sent",
    userId: creatorUserId,
    actorRole: "creator",
    targetId: itemId,
    targetType: normalizedType,
    contentType: normalizedType,
    metadata: {
      creatorId,
      recipientCount: recipients.length,
      sentCount,
      reason,
    },
  });

  return { sentCount, recipientCount: recipients.length };
};

const setLiveReminder = async ({ req = null, userId, creatorId = "", roomName = "" } = {}) => {
  let resolvedCreatorId = creatorId;
  let source = "creator";
  if (!resolvedCreatorId && roomName) {
    const session = await LiveSession.findOne({ roomName, status: "active" }).select("hostUserId").lean();
    const profile = session ? await getCreatorProfileByUserId(session.hostUserId) : null;
    resolvedCreatorId = toIdString(profile?._id);
    source = "active_session";
  }
  if (!isValidId(resolvedCreatorId)) {
    const error = new Error("Valid creatorId or active roomName is required");
    error.status = 400;
    throw error;
  }

  const profile = await getCreatorProfileById(resolvedCreatorId);
  if (!profile?._id) {
    const error = new Error("Creator not found");
    error.status = 404;
    throw error;
  }
  const creatorUserId = toIdString(profile.userId?._id || profile.userId);
  if (creatorUserId === String(userId)) {
    const error = new Error("You cannot set a reminder for your own live session");
    error.status = 400;
    throw error;
  }

  const reminder = await LiveReminder.findOneAndUpdate(
    {
      userId,
      creatorId: profile._id,
      status: "active",
    },
    {
      $set: {
        roomName: String(roomName || "").trim(),
        source,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  ).lean();

  await logFanReturnEvent({
    type: "live_reminder_set",
    userId,
    actorRole: req?.user?.role || "user",
    targetId: profile._id,
    targetType: "creator",
    contentType: "live",
    metadata: {
      creatorId: toIdString(profile._id),
      creatorUserId,
      roomName: roomName || "",
      source,
    },
  });

  return {
    reminder: {
      id: toIdString(reminder._id),
      creatorId: toIdString(profile._id),
      roomName: reminder.roomName || "",
      status: reminder.status,
      source: reminder.source,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
    },
  };
};

const notifyCreatorWentLive = async ({ req = null, session } = {}) => {
  if (!session?.hostUserId) {
    return { sentCount: 0, skipped: true };
  }
  const profile = await getCreatorProfileByUserId(session.hostUserId);
  const creatorId = toIdString(profile?._id);
  const creatorUserId = toIdString(profile?.userId?._id || profile?.userId);
  if (!creatorId || !creatorUserId) {
    return { sentCount: 0, skipped: true };
  }

  const now = new Date();
  const [reminderRows, subscriberIds] = await Promise.all([
    LiveReminder.find({ creatorId, status: "active" }).select("userId").lean(),
    Purchase.distinct("userId", {
      creatorId,
      itemType: "subscription",
      status: "paid",
      $or: [{ accessExpiresAt: null }, { accessExpiresAt: { $gt: now } }],
    }).catch(() => []),
  ]);
  const reminderIds = new Set(reminderRows.map((row) => toIdString(row.userId)));
  const subscriberIdSet = new Set(subscriberIds.map(toIdString));
  const recipients = [...new Set([...reminderIds, ...subscriberIdSet])]
    .filter((id) => id && id !== creatorUserId)
    .slice(0, 200);
  const route = `/live/watch/${encodeURIComponent(session.roomName || "")}`;
  const notifications = await Promise.all(
    recipients.map((recipient) => {
      const hasReminder = reminderIds.has(recipient);
      const isSubscriber = subscriberIdSet.has(recipient);
      return createFanNotification({
        recipient,
        sender: creatorUserId,
        text: `${profile.displayName || profile.fullName || "A creator you follow"} is live now.`,
        entity: {
          id: session._id,
          model: "LiveSession",
        },
        metadata: {
          eventType: hasReminder ? "live_reminder_ready" : "subscribed_creator_went_live",
          creatorId,
          roomName: session.roomName || "",
          subscriber: isSubscriber,
          reminder: hasReminder,
          link: route,
          dedupeKey: `creator_went_live:${creatorId}:${session.roomName || toIdString(session._id)}`,
        },
        req,
      });
    })
  );
  const sentCount = notifications.filter(Boolean).length;

  if (reminderIds.size) {
    await LiveReminder.updateMany(
      {
        creatorId,
        status: "active",
        userId: { $in: [...reminderIds] },
      },
      {
        $set: {
          status: "notified",
          remindedAt: now,
        },
      }
    ).catch(() => null);
  }

  await Promise.all([
    reminderIds.size
      ? logFanReturnEvent({
          type: "live_reminder_notification_sent",
          userId: creatorUserId,
          actorRole: "creator",
          targetId: session._id,
          targetType: "live",
          contentType: "live",
          metadata: {
            creatorId,
            roomName: session.roomName || "",
            recipientCount: reminderIds.size,
            sentCount,
          },
        })
      : Promise.resolve(null),
    subscriberIdSet.size
      ? logFanReturnEvent({
          type: "subscribed_creator_live_notification_sent",
          userId: creatorUserId,
          actorRole: "creator",
          targetId: session._id,
          targetType: "live",
          contentType: "live",
          metadata: {
            creatorId,
            roomName: session.roomName || "",
            recipientCount: subscriberIdSet.size,
            sentCount,
          },
        })
      : Promise.resolve(null),
  ]);

  return {
    sentCount,
    reminderCount: reminderIds.size,
    subscriberCount: subscriberIdSet.size,
  };
};

const buildFanReturnMetrics = async ({ startDate, endDate } = {}) => {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();
  const rows = await AnalyticsEvent.aggregate([
    {
      $match: {
        type: { $in: FAN_RETURN_EVENT_TYPES },
        createdAt: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: "$type", count: { $sum: 1 } } },
  ]).catch(() => []);

  return rows.reduce((acc, row) => {
    acc[row._id] = Number(row.count || 0);
    return acc;
  }, {});
};

module.exports = {
  FAN_RETURN_EVENT_TYPES,
  buildFanReturnMetrics,
  listSavedCreatorContent,
  normalizeProgressItemType,
  notifyCreatorPublishedPaidContent,
  notifyCreatorWentLive,
  notifyPurchaseUnlocked,
  notifySavedContentUpdated,
  notifySubscriptionRenewalFailed,
  notifySubscriptionRenewalUpcoming,
  recordCreatorFollow,
  recordProgressSaved,
  removeSavedCreatorContent,
  saveCreatorContent,
  setLiveReminder,
};
