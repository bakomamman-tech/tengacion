const mongoose = require("mongoose");

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
  if (!avatar) {
    return "";
  }
  if (typeof avatar === "string") {
    return avatar;
  }
  return avatar.url || "";
};

const buildConversationId = (a, b) =>
  [toIdString(a), toIdString(b)].sort().join("_");

const normalizeMessage = (message) => {
  const senderDoc =
    message?.senderId && typeof message.senderId === "object"
      ? message.senderId
      : null;

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
        : null,
    attachments: Array.isArray(message.attachments)
      ? message.attachments
          .map((file) => ({
            url: String(file?.url || "").trim(),
            type: String(file?.type || "").trim(),
            name: String(file?.name || "").trim(),
            size: Number(file?.size) || 0,
            durationSeconds: Number(file?.durationSeconds) || 0,
          }))
          .filter((file) => file.url)
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
  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments
        .map((file) => ({
          url: String(file?.url || "").trim(),
          type: String(file?.type || "")
            .trim()
            .toLowerCase(),
          name: String(file?.name || "").trim(),
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
    const title = String(payload.metadata?.title || "").trim();
    const description = String(payload.metadata?.description || "").trim();
    const coverImageUrl = String(payload.metadata?.coverImageUrl || "").trim();
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

  return {
    text,
    clientId,
    type,
    metadata,
    attachments,
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
