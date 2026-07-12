const User = require("../models/User");
const Notification = require("../models/Notification");
const Message = require("../models/Message");
const { birthdayFromDob, getDatePartsInTimeZone, hasBirthdayDate } = require("../utils/birthday");
const { buildExpiryDate, notificationUnreadRetentionDays } = require("../config/storage");

const BIRTHDAY_CAKE_IMAGE = "/assets/birthday-cake.svg";

const toDayKey = (date = new Date()) =>
  (() => {
    const parts = getDatePartsInTimeZone(date);
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  })();

const emitBirthdayNotification = async ({ io, notificationId, recipientId }) => {
  if (!io || !notificationId || !recipientId) return;
  const notification = await Notification.findById(notificationId)
    .populate("sender", "_id name username avatar")
    .lean();
  if (!notification) return;
  const unreadCount = await Notification.countDocuments({
    recipient: recipientId,
    read: false,
    expiresAt: { $gt: new Date() },
  });
  io.to(`user:${recipientId}`).emit("notifications:new", { notification, unreadCount });
};

const upsertBirthdayNotification = async (filter, update) => {
  try {
    return await Notification.updateOne(filter, update, { upsert: true });
  } catch (err) {
    // Another application instance may win the same daily dedupe-key race.
    if (err?.code === 11000) {
      return { upsertedCount: 0, upsertedId: null };
    }
    throw err;
  }
};

const runBirthdayRecognition = async ({ logger = console, now = new Date(), io = null } = {}) => {
  // Older accounts stored DOB but never received the derived birthday fields.
  // Backfill them before matching today's date so every registered user is included.
  const candidates = await User.find({
    dob: { $type: "date" },
    isDeleted: { $ne: true },
  }).select("_id +dob birthday").lean();
  const repairs = candidates
    .filter((user) => !hasBirthdayDate(user?.birthday))
    .map((user) => {
      const visibility = ["private", "friends", "public"].includes(
        String(user?.birthday?.visibility || "")
      )
        ? String(user.birthday.visibility)
        : "friends";
      const birthday = birthdayFromDob(user.dob, visibility);
      return birthday ? {
        updateOne: { filter: { _id: user._id }, update: { $set: { birthday } } },
      } : null;
    })
    .filter(Boolean);
  if (repairs.length) {
    await User.bulkWrite(repairs, { ordered: false });
  }

  const today = getDatePartsInTimeZone(now);
  const day = today.day;
  const month = today.month;
  const dayKey = toDayKey(now);
  const notificationExpiresAt = buildExpiryDate({
    createdAt: now,
    retentionDays: notificationUnreadRetentionDays,
  });
  const isLeapYear = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const birthdayMatch = month === 2 && day === 28 && !isLeapYear(today.year)
    ? {
        $or: [
          { "birthday.day": 28, "birthday.month": 2 },
          { "birthday.day": 29, "birthday.month": 2 },
        ],
      }
    : { "birthday.day": day, "birthday.month": month };

  const users = await User.find({
    ...birthdayMatch,
    isDeleted: { $ne: true },
    isActive: { $ne: false },
    isBanned: { $ne: true },
    isSuspended: { $ne: true },
  }).select("_id name username birthday");

  let created = 0;
  let friendRemindersCreated = 0;
  let communityAnnouncementsCreated = 0;

  const communityRecipients = await User.find({
    isDeleted: { $ne: true },
    isActive: { $ne: false },
    isBanned: { $ne: true },
    isSuspended: { $ne: true },
    "notificationPrefs.system": { $ne: false },
  })
    .select("_id")
    .lean();

  for (const user of users) {
    const userId = user._id.toString();
    let message = await Message.findOne({
      receiverId: user._id,
      isSystem: true,
      "metadata.type": "birthday",
      "metadata.payload.dayKey": dayKey,
    })
      .select("_id")
      .lean();

    if (!message) {
      const conversationId = [userId, userId].sort().join("_");
      message = await Message.create({
        conversationId,
        senderId: user._id,
        receiverId: user._id,
        text: `Happy Birthday, ${user.name || user.username || "Friend"}!`,
        type: "text",
        isSystem: true,
        metadata: {
          type: "birthday",
          payload: { dayKey, cakeImage: BIRTHDAY_CAKE_IMAGE },
        },
      });
    }

    const selfDedupeKey = `birthday:self:${dayKey}:${userId}`;
    const selfResult = await upsertBirthdayNotification(
      {
        recipient: user._id,
        $or: [
          { dedupeKey: selfDedupeKey },
          {
            "metadata.type": "birthday",
            "metadata.birthdayPersonId": userId,
            "entity.id": message._id,
          },
        ],
      },
      {
        $setOnInsert: {
          recipient: user._id,
          sender: user._id,
          type: "system",
          text: `Happy Birthday, ${user.name || user.username || "Friend"}!`,
          dedupeKey: selfDedupeKey,
          expiresAt: notificationExpiresAt,
          entity: { id: message._id, model: "Message" },
          metadata: {
            type: "birthday",
            birthdayPersonId: userId,
            previewImage: BIRTHDAY_CAKE_IMAGE,
            previewText: "Wishing you a joyful day from Tengacion.",
            link: `/birthdays?focus=${userId}`,
          },
        },
      }
    );
    const selfInserted = Number(selfResult.upsertedCount || 0);
    created += selfInserted;
    if (selfInserted && selfResult.upsertedId) {
      await emitBirthdayNotification({
        io,
        notificationId: selfResult.upsertedId,
        recipientId: userId,
      });
    }

    if (["friends", "public"].includes(String(user?.birthday?.visibility || ""))) {
      const recipients = communityRecipients.filter(
        (entry) => entry._id.toString() !== userId
      );

      for (const recipient of recipients) {
        const dedupeKey = `birthday:${dayKey}:${userId}`;
        const result = await upsertBirthdayNotification(
          { recipient: recipient._id, dedupeKey },
          {
            $setOnInsert: {
              recipient: recipient._id,
              sender: user._id,
              type: "system",
              text: "is celebrating a birthday today. Join Tengacion in wishing them well!",
              dedupeKey,
              expiresAt: notificationExpiresAt,
              entity: { id: user._id, model: "User" },
              metadata: {
                type: "birthday",
                birthdayPersonId: userId,
                previewImage: BIRTHDAY_CAKE_IMAGE,
                previewText: "An official Tengacion community birthday celebration.",
                link: `/birthdays?focus=${userId}`,
              },
            },
          }
        );
        const inserted = Number(result.upsertedCount || 0);
        communityAnnouncementsCreated += inserted;
        friendRemindersCreated += inserted;
        if (inserted && result.upsertedId) {
          await emitBirthdayNotification({
            io,
            notificationId: result.upsertedId,
            recipientId: recipient._id.toString(),
          });
        }
      }
    }
  }

  logger.info("[birthday] recognition complete", {
    date: dayKey,
    matchedUsers: users.length,
    created,
    friendRemindersCreated,
    communityAnnouncementsCreated,
  });
  return { matchedUsers: users.length, created, friendRemindersCreated, communityAnnouncementsCreated };
};

module.exports = {
  BIRTHDAY_CAKE_IMAGE,
  runBirthdayRecognition,
};
