const User = require("../models/User");
const Notification = require("../models/Notification");
const Message = require("../models/Message");

const BIRTHDAY_CAKE_IMAGE = "/assets/birthday-cake.svg";

const toDayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const runBirthdayRecognition = async ({ logger = console } = {}) => {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const dayKey = toDayKey(now);

  const users = await User.find({
    "birthday.day": day,
    "birthday.month": month,
  }).select("_id name username birthday");

  let created = 0;
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

    if (existing) {
      continue;
    }

    const conversationId = [userId, userId].sort().join("_");
    await Message.create({
      conversationId,
      senderId: user._id,
      receiverId: user._id,
      text: `Happy Birthday, ${user.name || user.username || "Friend"} 🎉`,
      type: "text",
      isSystem: true,
      metadata: {
        type: "birthday",
        payload: {
          dayKey,
          cakeImage: BIRTHDAY_CAKE_IMAGE,
        },
      },
    });

    await Notification.create({
      recipient: user._id,
      sender: user._id,
      type: "system",
      text: `Happy Birthday, ${user.name || user.username || "Friend"} 🎉`,
      entity: { id: null, model: null },
      metadata: {
        previewImage: BIRTHDAY_CAKE_IMAGE,
        previewText: "Wishing you a joyful day from Tengacion.",
        link: "/home",
      },
    });

    created += 1;
  }

  logger.info("[birthday] recognition complete", {
    date: dayKey,
    matchedUsers: users.length,
    created,
  });
  return { matchedUsers: users.length, created };
};

module.exports = {
  BIRTHDAY_CAKE_IMAGE,
  runBirthdayRecognition,
};
