const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const { resolvePurchasableItem } = require("./catalogService");
const {
  buildConversationId,
  normalizeIncomingMessagePayload,
  normalizeMessage,
} = require("../utils/messagePayload");

const ensureContentCardMetadata = async (metadata) => {
  if (!metadata) {
    return null;
  }

  const item = await resolvePurchasableItem(metadata.itemType, metadata.itemId);
  if (!item) {
    throw new Error("Content item not found");
  }

  return {
    itemType: item.itemType,
    itemId: item.itemId,
    previewType: metadata.previewType,
    title: item.title,
    description: item.payload?.description || "",
    price: Number(item.price) || 0,
    coverImageUrl:
      item.itemType === "book"
        ? item.payload?.coverImageUrl || ""
        : "",
  };
};

const buildReplyReference = async ({ conversationId, replyToMessageId }) => {
  if (!replyToMessageId) {
    return undefined;
  }

  const target = await Message.findOne({
    _id: replyToMessageId,
    conversationId,
  }).select(
    "_id senderId senderName text type metadata attachments"
  );

  if (!target) {
    throw new Error("Reply target not found");
  }

  const normalizedTarget = normalizeMessage(target.toObject());
  return {
    messageId: target._id,
    senderId: target.senderId,
    senderName: normalizedTarget.senderName || "",
    type: normalizedTarget.type || "text",
    text: String(normalizedTarget.text || "").slice(0, 400),
    contentTitle:
      normalizedTarget.type === "contentCard"
        ? String(
            normalizedTarget.metadata?.title
              || normalizedTarget.metadata?.itemType
              || ""
          ).slice(0, 200)
        : "",
    attachmentType: String(
      normalizedTarget.attachments?.[0]?.type || ""
    ).slice(0, 16),
    attachmentCount: Array.isArray(normalizedTarget.attachments)
      ? normalizedTarget.attachments.length
      : 0,
  };
};

const persistChatMessage = async ({ senderId, receiverId, payload }) => {
  if (
    !mongoose.Types.ObjectId.isValid(senderId) ||
    !mongoose.Types.ObjectId.isValid(receiverId)
  ) {
    throw new Error("Invalid sender or receiver id");
  }

  if (senderId.toString() === receiverId.toString()) {
    throw new Error("Cannot message yourself");
  }

  const parsed = normalizeIncomingMessagePayload(payload);
  if (parsed.error) {
    throw new Error(parsed.error);
  }

  const [sender, receiver] = await Promise.all([
    User.findById(senderId).select("name"),
    User.findById(receiverId).select("_id"),
  ]);

  if (!sender || !receiver) {
    throw new Error("User not found");
  }

  const conversationId = buildConversationId(senderId, receiverId);
  if (parsed.clientId) {
    const existing = await Message.findOne({
      conversationId,
      senderId,
      clientId: parsed.clientId,
    }).populate("senderId", "name username avatar");

    if (existing) {
      console.log("[DB READ]", {
        collection: "messages",
        reason: "idempotency-hit",
        conversationId,
        senderId: senderId.toString(),
        receiverId: receiverId.toString(),
        clientId: parsed.clientId,
      });
      return {
        message: normalizeMessage(existing.toObject()),
        existed: true,
      };
    }
  }

  const message = await Message.create({
    conversationId,
    senderId,
    receiverId,
    senderName: sender.name || "",
    text: parsed.text,
    type: parsed.type,
    metadata:
      parsed.type === "contentCard"
        ? await ensureContentCardMetadata(parsed.metadata)
        : undefined,
    attachments: parsed.attachments || [],
    replyTo: await buildReplyReference({
      conversationId,
      replyToMessageId: parsed.replyToMessageId,
    }),
    time: Date.now(),
    clientId: parsed.clientId || undefined,
  });

  await message.populate("senderId", "name username avatar");
  console.log("[DB WRITE]", {
    collection: "messages",
    reason: "persist-chat-message",
    messageId: message._id.toString(),
    conversationId,
    senderId: senderId.toString(),
    receiverId: receiverId.toString(),
  });

  return {
    message: normalizeMessage(message.toObject()),
    existed: false,
  };
};

module.exports = {
  persistChatMessage,
};
