const Message = require("../models/Message");
const User = require("../models/User");
const { createNotification } = require("./notificationService");
const {
  buildConversationId,
  normalizeMessage,
  toIdString,
} = require("../utils/messagePayload");

const REMINDER_METADATA_TYPE = "onboardingReminder";
const ADMIN_ROLES = ["admin", "super_admin"];

const buildReminderState = (user = {}) => {
  const needsProfile = !Boolean(user?.onboarding?.completed);
  const needsEmailVerification = !Boolean(user?.emailVerified);

  if (needsProfile && needsEmailVerification) {
    return {
      key: "profile_email",
      needsProfile,
      needsEmailVerification,
      actionLink: "/onboarding",
      text:
        "Your registration is still incomplete. Please complete your profile and verify your email as soon as possible to avoid being banned by the admin.",
    };
  }

  if (needsProfile) {
    return {
      key: "profile",
      needsProfile,
      needsEmailVerification,
      actionLink: "/onboarding",
      text:
        "Your registration is still incomplete. Please complete your profile as soon as possible to avoid being banned by the admin.",
    };
  }

  if (needsEmailVerification) {
    return {
      key: "email",
      needsProfile,
      needsEmailVerification,
      actionLink: "/settings/security",
      text:
        "Your registration is still incomplete. Please verify your email as soon as possible to avoid being banned by the admin.",
    };
  }

  return null;
};

const resolveReminderSender = async (userId) => {
  const adminUser = await User.findOne({
    role: { $in: ADMIN_ROLES },
    isDeleted: { $ne: true },
    isBanned: { $ne: true },
  })
    .sort({ createdAt: 1 })
    .select("_id name username avatar");

  if (adminUser) {
    return adminUser;
  }

  return User.findById(userId).select("_id name username avatar");
};

const emitReminderMessage = async ({ io, message }) => {
  if (!io || !message) {
    return;
  }

  await message.populate("senderId", "name username avatar");
  const payload = normalizeMessage(message.toObject());
  const senderId = toIdString(payload.senderId);
  const receiverId = toIdString(payload.receiverId);

  io.to(receiverId).to(`user:${receiverId}`).emit("newMessage", payload);
  io.to(receiverId).to(`user:${receiverId}`).emit("chat:message", payload);

  if (senderId && senderId !== receiverId) {
    io.to(senderId).to(`user:${senderId}`).emit("newMessage", payload);
    io.to(senderId).to(`user:${senderId}`).emit("chat:message", payload);
  }
};

const metadataMatches = (message, reminder) => {
  const payload = message?.metadata?.payload || {};
  return (
    String(message?.metadata?.type || "") === REMINDER_METADATA_TYPE &&
    String(payload.stateKey || "") === String(reminder?.key || "") &&
    Boolean(payload.needsProfile) === Boolean(reminder?.needsProfile) &&
    Boolean(payload.needsEmailVerification) === Boolean(reminder?.needsEmailVerification) &&
    String(payload.actionLink || "") === String(reminder?.actionLink || "")
  );
};

const ensureOnboardingReminderMessage = async ({
  userId,
  io = null,
  onlineUsers = null,
} = {}) => {
  const user = await User.findById(userId).select(
    "_id name username role onboarding.completed emailVerified isDeleted isBanned"
  );

  if (!user || user.isDeleted || user.isBanned) {
    return { created: false, skipped: true, reason: "user_unavailable" };
  }

  if (ADMIN_ROLES.includes(String(user.role || "").toLowerCase())) {
    return { created: false, skipped: true, reason: "admin_account" };
  }

  const reminder = buildReminderState(user);
  if (!reminder) {
    return { created: false, skipped: true, reason: "registration_complete" };
  }

  const sender = await resolveReminderSender(user._id);
  if (!sender) {
    return { created: false, skipped: true, reason: "missing_sender" };
  }

  const senderId = toIdString(sender._id);
  const receiverId = toIdString(user._id);
  const senderName = String(sender?.name || "Tengacion Admin").trim() || "Tengacion Admin";
  const conversationId = buildConversationId(senderId, receiverId);
  const nextMetadata = {
    type: REMINDER_METADATA_TYPE,
    payload: {
      stateKey: reminder.key,
      needsProfile: reminder.needsProfile,
      needsEmailVerification: reminder.needsEmailVerification,
      actionLink: reminder.actionLink,
    },
  };

  const existing = await Message.findOne({
    receiverId: user._id,
    isSystem: true,
    "metadata.type": REMINDER_METADATA_TYPE,
  }).sort({ createdAt: -1 });

  if (existing) {
    const needsUpdate =
      String(existing.text || "") !== reminder.text ||
      String(existing.senderName || "") !== senderName ||
      toIdString(existing.senderId) !== senderId ||
      String(existing.conversationId || "") !== conversationId ||
      !metadataMatches(existing, reminder);

    if (!needsUpdate) {
      return { created: false, updated: false, skipped: true, reason: "already_exists" };
    }

    existing.text = reminder.text;
    existing.senderId = sender._id;
    existing.senderName = senderName;
    existing.conversationId = conversationId;
    existing.metadata = nextMetadata;
    existing.time = Date.now();
    await existing.save();

    await emitReminderMessage({ io, message: existing });
    return { created: false, updated: true, messageId: existing._id.toString() };
  }

  const message = await Message.create({
    conversationId,
    senderId: sender._id,
    receiverId: user._id,
    senderName,
    text: reminder.text,
    type: "text",
    isSystem: true,
    metadata: nextMetadata,
    time: Date.now(),
  });

  await emitReminderMessage({ io, message });

  await createNotification({
    recipient: user._id,
    sender: sender._id,
    type: "message",
    text: "sent you a private registration reminder",
    entity: {
      id: message._id,
      model: "Message",
    },
    metadata: {
      previewText: reminder.text.slice(0, 120),
      link: reminder.actionLink,
    },
    io,
    onlineUsers,
  });

  return { created: true, updated: false, messageId: message._id.toString() };
};

module.exports = {
  REMINDER_METADATA_TYPE,
  ensureOnboardingReminderMessage,
};
