const mongoose = require("mongoose");
const {
  limitArray,
  sanitizePlainObject,
  truncate,
} = require("../config/storage");
const { normalizeMediaValue } = require("./userMedia");

const MESSAGE_TYPES = ["text", "contentCard", "voice"];
const CONTENT_CARD_ITEM_TYPES = ["track", "book"];
const CONTENT_CARD_PREVIEW_TYPES = ["play", "read"];

const toIdString = (value) => {
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

const avatarToUrl = (avatar) => {
  return normalizeMediaValue(avatar).url;
};

const buildConversationId = (a, b) =>
  [toIdString(a), toIdString(b)].sort().join("_");

const normalizeOnboardingReminderMetadata = (metadata = {}) => {
  const payload = metadata?.payload && typeof metadata.payload === "object" ? metadata.payload : {};

  return {
    type: "onboardingReminder",
    payload: {
      stateKey: String(payload.stateKey || ""),
      needsProfile: Boolean(payload.needsProfile),
      needsEmailVerification: Boolean(payload.needsEmailVerification),
      actionLink: String(payload.actionLink || ""),
    },
  };
};

const normalizeMessage = (message) => {
  const senderDoc =
    message?.senderId && typeof message.senderId === "object"
      ? message.senderId
      : null;
  const replyTo = message?.replyTo || null;
  const metadataType = String(message?.metadata?.type || "").trim();

  return {
    _id: toIdString(message._id),
    conversationId: message.conversationId,
    senderId: toIdString(message.senderId),
    receiverId: toIdString(message.receiverId),
    senderName: message.senderName || senderDoc?.name || "",
    senderAvatar: avatarToUrl(senderDoc?.avatar),
    text: message.text || "",
    status: message.status || "sent",
    type: MESSAGE_TYPES.includes(message.type) ? message.type : "text",
    metadata:
      message.type === "contentCard" && message.metadata
        ? {
            itemType: message.metadata.itemType || "",
            itemId: toIdString(message.metadata.itemId),
            previewType: message.metadata.previewType || "",
            title: message.metadata.title || "",
            description: message.metadata.description || "",
            price: Number(message.metadata.price) || 0,
            coverImageUrl: message.metadata.coverImageUrl || "",
          }
        : metadataType === "onboardingReminder" && message.metadata
          ? normalizeOnboardingReminderMetadata(message.metadata)
        : null,
    attachments: Array.isArray(message.attachments)
      ? limitArray(message.attachments, 5)
          .map((file) => ({
            url: truncate(file?.url || "", 1200),
            type: truncate(file?.type || "", 20),
            name: truncate(file?.name || "", 260),
            size: Number(file?.size) || 0,
            durationSeconds: Number(file?.durationSeconds) || 0,
          }))
          .filter((file) => file.url)
      : [],
    replyTo:
      replyTo && replyTo.messageId
        ? {
            messageId: toIdString(replyTo.messageId),
            senderId: toIdString(replyTo.senderId),
            senderName: replyTo.senderName || "",
            type: MESSAGE_TYPES.includes(replyTo.type) ? replyTo.type : "text",
            text: replyTo.text || "",
            contentTitle: replyTo.contentTitle || "",
            attachmentType: String(replyTo.attachmentType || "").trim(),
            attachmentCount: Number(replyTo.attachmentCount) || 0,
          }
        : null,
    reactions: Array.isArray(message.reactions)
      ? message.reactions
          .map((entry) => ({
            userId: toIdString(entry?.userId),
            emoji: String(entry?.emoji || "").trim(),
            createdAt: entry?.createdAt || null,
          }))
          .filter((entry) => entry.userId && entry.emoji)
      : [],
    time:
      message.time ||
      (message.createdAt ? new Date(message.createdAt).getTime() : Date.now()),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    clientId: message.clientId || null,
  };
};

const normalizeIncomingMessagePayload = (payload = {}) => {
  const text = String(payload.text || "").trim();
  const clientId = String(payload.clientId || "").trim();
  const type = MESSAGE_TYPES.includes(payload.type) ? payload.type : "text";
  const replyToMessageId = String(
    payload.replyTo?.messageId || payload.replyToMessageId || ""
  ).trim();
  const attachments = Array.isArray(payload.attachments)
    ? limitArray(payload.attachments, 5)
        .map((file) => ({
          url: truncate(file?.url || "", 1200),
          type: truncate(file?.type || "", 20).toLowerCase(),
          name: truncate(file?.name || "", 260),
          size: Number(file?.size) || 0,
          durationSeconds: Number(file?.durationSeconds) || 0,
        }))
        .filter((file) => file.url)
    : [];

  let metadata = null;
  if (type === "contentCard") {
    const itemType = String(payload.metadata?.itemType || "").trim().toLowerCase();
    const itemId = String(payload.metadata?.itemId || "").trim();
    const previewType = String(payload.metadata?.previewType || "")
      .trim()
      .toLowerCase();
    const title = truncate(payload.metadata?.title || "", 200);
    const description = truncate(payload.metadata?.description || "", 500);
    const coverImageUrl = truncate(payload.metadata?.coverImageUrl || "", 1200);
    const price = Number(payload.metadata?.price || 0);

    if (!CONTENT_CARD_ITEM_TYPES.includes(itemType)) {
      return { error: "Invalid content card itemType" };
    }

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return { error: "Invalid content card itemId" };
    }

    if (!CONTENT_CARD_PREVIEW_TYPES.includes(previewType)) {
      return { error: "Invalid content card previewType" };
    }

    metadata = {
      itemType,
      itemId,
      previewType,
      title,
      description,
      coverImageUrl,
      price: Number.isFinite(price) ? Math.max(0, price) : 0,
    };
  }

  if (type === "text" && !text && attachments.length === 0) {
    return { error: "Message text is required" };
  }

  if (type === "voice") {
    const hasAudioAttachment = attachments.some((file) => file.type === "audio");
    if (!hasAudioAttachment) {
      return { error: "Voice message requires an audio attachment" };
    }
  }

  if (replyToMessageId && !mongoose.Types.ObjectId.isValid(replyToMessageId)) {
    return { error: "Invalid reply target" };
  }

  return {
    text: truncate(text, 2000),
    clientId,
    type,
    metadata,
    attachments,
    replyToMessageId,
  };
};

module.exports = {
  MESSAGE_TYPES,
  toIdString,
  avatarToUrl,
  buildConversationId,
  normalizeMessage,
  normalizeIncomingMessagePayload,
};
