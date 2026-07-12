const User = require("../models/User");
const Notification = require("../models/Notification");
const Message = require("../models/Message");
const { birthdayFromDob, hasBirthdayDate } = require("../utils/birthday");

const BIRTHDAY_CAKE_IMAGE = "/assets/birthday-cake.svg";

const toDayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const runBirthdayRecognition = async ({ logger = console } = {}) => {
  // Older accounts stored DOB but never received the derived birthday fields.
  // Backfill them before matching today's date so every registered user is included.
  const candidates = await User.find({
    dob: { $type: "date" },
    isDeleted: { $ne: true },
  }).select("_id +dob birthday").lean();
  const repairs = candidates
    .filter((user) => !hasBirthdayDate(user?.birthday))
    .map((user) => {
      const birthday = birthdayFromDob(user.dob, "friends");
      return birthday ? {
        updateOne: { filter: { _id: user._id }, update: { $set: { birthday } } },
      } : null;
    })
    .filter(Boolean);
  if (repairs.length) {
    await User.bulkWrite(repairs, { ordered: false });
  }

  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const dayKey = toDayKey(now);

  const users = await User.find({
    "birthday.day": day,
    "birthday.month": month,
    isDeleted: { $ne: true },
  }).select("_id name username birthday");

  let created = 0;
  let friendRemindersCreated = 0;

  for (const user of users) {
    const userId = user._id.toString();
    const existing = await Message.findOne({
      receiverId: user._id,
      isSystem: true,
      "metadata.type": "birthday",
      "metadata.payload.dayKey": dayKey,
    })
      .select("_id")
      .lean();

    if (!existing) {
      const conversationId = [userId, userId].sort().join("_");
      const message = await Message.create({
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

      await Notification.create({
        recipient: user._id,
        sender: user._id,
        type: "system",
        text: `Happy Birthday, ${user.name || user.username || "Friend"}!`,
        entity: { id: message._id, model: "Message" },
        metadata: {
          type: "birthday",
          birthdayPersonId: userId,
          previewImage: BIRTHDAY_CAKE_IMAGE,
          previewText: "Wishing you a joyful day from Tengacion.",
          link: `/birthdays?focus=${userId}`,
        },
      });
      created += 1;
    }

    if (["friends", "public"].includes(String(user?.birthday?.visibility || ""))) {
      const friends = await User.find({
        friends: user._id,
        _id: { $ne: user._id },
        isDeleted: { $ne: true },
        isBanned: { $ne: true },
      })
        .select("_id")
        .lean();

      for (const friend of friends) {
        const dedupeKey = `birthday:${dayKey}:${userId}`;
        const result = await Notification.updateOne(
          { recipient: friend._id, dedupeKey },
          {
            $setOnInsert: {
              recipient: friend._id,
              sender: user._id,
              type: "system",
              text: "has a birthday today. Send them a wish!",
              dedupeKey,
              entity: { id: user._id, model: "User" },
              metadata: {
                type: "birthday",
                birthdayPersonId: userId,
                previewImage: BIRTHDAY_CAKE_IMAGE,
                previewText: "Celebrate their birthday on Tengacion.",
                link: `/birthdays?focus=${userId}`,
              },
            },
          },
          { upsert: true }
        );
        friendRemindersCreated += Number(result.upsertedCount || 0);
      }
    }
  }

  logger.info("[birthday] recognition complete", {
    date: dayKey,
    matchedUsers: users.length,
    created,
    friendRemindersCreated,
  });
  return { matchedUsers: users.length, created, friendRemindersCreated };
};

module.exports = {
  BIRTHDAY_CAKE_IMAGE,
  runBirthdayRecognition,
};
