const CreatorProfile = require("../models/CreatorProfile");
const Message = require("../models/Message");
const Track = require("../models/Track");
const Book = require("../models/Book");
const Album = require("../models/Album");
const User = require("../models/User");
const { buildConversationId, normalizeMessage, toIdString } = require("../utils/messagePayload");

const SALES_SENDER_ROLES = ["admin", "super_admin"];
const SALES_SENDER_NAME = "Tengacion Sales";

const formatCurrency = (amount = 0, currency = "NGN") => {
  const value = Number(amount || 0);
  const normalizedCurrency = String(currency || "NGN").trim().toUpperCase() || "NGN";
  return `${normalizedCurrency} ${value.toLocaleString("en-NG")}`;
};

const loadPurchasedItemTitle = async (purchase = {}) => {
  const itemType = String(purchase?.itemType || "").trim().toLowerCase();
  const itemId = purchase?.itemId;

  if (!itemId) {
    return "";
  }

  if (itemType === "track") {
    const track = await Track.findById(itemId).select("title").lean();
    return String(track?.title || "").trim();
  }

  if (itemType === "book") {
    const book = await Book.findById(itemId).select("title").lean();
    return String(book?.title || "").trim();
  }

  if (itemType === "album") {
    const album = await Album.findById(itemId).select("title").lean();
    return String(album?.title || "").trim();
  }

  return "";
};

const describePurchasedItem = ({ purchase = {}, itemTitle = "" } = {}) => {
  const itemType = String(purchase?.itemType || "").trim().toLowerCase();
  const title = String(itemTitle || "").trim();

  if (itemType === "subscription") {
    return "A fan just subscribed to your creator page";
  }

  if (title) {
    return `Your ${itemType || "item"} "${title}" was purchased`;
  }

  return `Your ${itemType || "item"} was purchased`;
};

const buildSalesAlertText = ({ purchase = {}, itemTitle = "" } = {}) => {
  const purchaseLine = describePurchasedItem({ purchase, itemTitle });
  const amountLine = formatCurrency(purchase?.amount, purchase?.currency || "NGN");

  return [
    "You made a sale on Tengacion.",
    `${purchaseLine} for ${amountLine}.`,
    "Open your creator dashboard or sales page to review the transaction.",
  ].join(" ");
};

const resolveSalesAlertSenderId = async ({ receiverId = "" } = {}) => {
  const sender = await User.findOne({
    role: { $in: SALES_SENDER_ROLES },
    isDeleted: { $ne: true },
    isBanned: { $ne: true },
  })
    .sort({ createdAt: 1 })
    .select("_id")
    .lean();

  const senderId = toIdString(sender?._id);
  return senderId && senderId !== receiverId ? senderId : "";
};

const findExistingAlert = async ({ conversationId = "", senderId = "", clientId = "" } = {}) =>
  Message.findOne({
    conversationId,
    senderId,
    clientId,
  }).populate("senderId", "name username avatar");

const emitSalesAlertMessage = ({ req = null, payload = null } = {}) => {
  const io = req?.app?.get?.("io");
  if (!io || !payload) {
    return;
  }

  const receiverRoom = toIdString(payload.receiverId);
  if (!receiverRoom) {
    return;
  }

  io.to(receiverRoom).to(`user:${receiverRoom}`).emit("newMessage", payload);
  io.to(receiverRoom).to(`user:${receiverRoom}`).emit("chat:message", payload);
};

const sendCreatorPurchaseMessengerAlert = async ({ req = null, purchase = {} } = {}) => {
  const creatorProfileId = toIdString(purchase?.creatorId);
  if (!creatorProfileId) {
    return { sent: false, skipped: true, reason: "missing_creator_profile" };
  }

  const creatorProfile = await CreatorProfile.findById(creatorProfileId).select("userId").lean();
  const receiverId = toIdString(creatorProfile?.userId);
  if (!receiverId) {
    return { sent: false, skipped: true, reason: "missing_creator_user" };
  }

  const senderId = await resolveSalesAlertSenderId({ receiverId });
  if (!senderId) {
    return { sent: false, skipped: true, reason: "missing_sales_sender" };
  }

  const conversationId = buildConversationId(senderId, receiverId);
  const clientId = `sale_alert_${toIdString(purchase?._id)}`;
  const existing = await findExistingAlert({ conversationId, senderId, clientId });
  if (existing) {
    return {
      sent: false,
      duplicate: true,
      messageId: toIdString(existing._id),
    };
  }

  const itemTitle = await loadPurchasedItemTitle(purchase);
  const text = buildSalesAlertText({ purchase, itemTitle });

  let message;
  try {
    message = await Message.create({
      conversationId,
      senderId,
      receiverId,
      senderName: SALES_SENDER_NAME,
      text,
      type: "text",
      isSystem: true,
      time: Date.now(),
      clientId,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await findExistingAlert({ conversationId, senderId, clientId });
      return {
        sent: false,
        duplicate: true,
        messageId: toIdString(duplicate?._id),
      };
    }
    throw error;
  }

  await message.populate("senderId", "name username avatar");
  const payload = normalizeMessage(message.toObject());
  emitSalesAlertMessage({ req, payload });

  return {
    sent: true,
    duplicate: false,
    messageId: toIdString(message._id),
  };
};

module.exports = {
  SALES_SENDER_NAME,
  buildSalesAlertText,
  sendCreatorPurchaseMessengerAlert,
};
