const crypto = require("crypto");
const User = require("../models/User");
const { persistChatMessage } = require("./chatService");
const { createNotification } = require("./notificationService");
const { toIdString } = require("../utils/messagePayload");

const MODERATION_SENDER_ROLES = ["admin", "super_admin", "moderator", "trust_safety_admin"];

const cleanText = (value = "", maxLength = 2000) =>
  String(value || "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, maxLength);

const buildPolicyWarnings = ({ action = "", labels = [], combinedText = "" } = {}) => {
  const normalizedAction = String(action || "").trim().toLowerCase();
  const text = String(combinedText || "").toLowerCase();
  const normalizedLabels = Array.isArray(labels)
    ? [...new Set(labels.map((entry) => String(entry || "").trim().toLowerCase()).filter(Boolean))]
    : [];
  const warnings = new Set();

  const hasExplicitSexualContent =
    normalizedLabels.some((label) => label.includes("explicit_pornography") || label === "xxx") ||
    /(\b|\s)(porn|pornographic|explicit|sexual|nudity|nude)(\b|\s)/.test(text);
  if (hasExplicitSexualContent) {
    warnings.add("Explicit pornography and other prohibited sexual content are not allowed on Tengacion.");
  }

  const hasCsamRisk =
    normalizedLabels.some((label) => label.includes("suspected_child_exploitation") || label.includes("csam")) ||
    /(\b|\s)(child sexual abuse|csam|underage|minor)(\b|\s)/.test(text);
  if (hasCsamRisk) {
    warnings.add("Any content involving minors or suspected exploitation is strictly prohibited and has been escalated.");
  }

  const hasGraphicGore =
    normalizedLabels.some((label) => label.includes("graphic_gore")) ||
    /(\b|\s)(graphic gore|extreme violence|beheading)(\b|\s)/.test(text);
  if (hasGraphicGore) {
    warnings.add("Graphic gore and extreme violence are not allowed without review.");
  }

  const hasAnimalCruelty =
    normalizedLabels.some((label) => label.includes("animal_cruelty")) ||
    /(\b|\s)(animal cruelty|animal abuse)(\b|\s)/.test(text);
  if (hasAnimalCruelty) {
    warnings.add("Animal cruelty content is prohibited on the platform.");
  }

  if (normalizedAction === "ban_user" || normalizedAction === "suspend_user") {
    warnings.add("Repeated violations can lead to stronger account restrictions or a permanent ban.");
  }

  return Array.from(warnings);
};

const buildActionSentence = ({ action = "", scope = "content" } = {}) => {
  const normalizedAction = String(action || "").trim().toLowerCase();
  const isUserScope = String(scope || "").trim().toLowerCase() === "user";

  const contentActions = {
    approve: "Your upload has been approved for publication.",
    restore_content: "Your upload has been restored after review.",
    hold_for_review: "Your upload has been placed on hold for additional review.",
    reject: "Your upload has been rejected because it violates our community rules.",
    delete_media: "Your upload has been removed from the platform.",
    remove: "Your upload has been removed from the platform.",
    restrict_with_warning: "Your upload remains visible with a safety warning and additional restrictions.",
    blur_preview: "Your upload preview has been blurred while review continues.",
    preserve_evidence: "Your upload has been preserved as evidence while the case is reviewed.",
    escalate_case: "Your case has been escalated for additional review.",
    quarantine: "Your upload has been quarantined while the case is reviewed.",
    warn: "Your upload has been reviewed and a warning has been issued.",
  };

  const userActions = {
    suspend_user: "Your account has been suspended because of this violation.",
    ban_user: "Your account has been banned because of this violation.",
  };

  if (isUserScope) {
    return userActions[normalizedAction] || "Your account has been reviewed by the moderation team.";
  }

  return contentActions[normalizedAction] || "Your upload has been reviewed by the moderation team.";
};

const buildModerationMessageText = ({
  action = "",
  reason = "",
  scope = "content",
  subjectTitle = "",
  subjectDescription = "",
  labels = [],
} = {}) => {
  const normalizedScope = String(scope || "").trim().toLowerCase() === "user" ? "user" : "content";
  const subjectLine = normalizedScope === "user"
    ? "your account"
    : cleanText(subjectTitle || subjectDescription || "your upload", 160);
  const intro = subjectLine
    ? `Moderation update for ${subjectLine}.`
    : "Moderation update.";
  const actionSentence = buildActionSentence({ action, scope: normalizedScope });
  const moderatorNote = cleanText(reason, 800);
  const warnings = buildPolicyWarnings({
    action,
    labels,
    combinedText: [subjectTitle, subjectDescription, reason, Array.isArray(labels) ? labels.join(" ") : ""].join(" "),
  });
  const closing = normalizedScope === "user"
    ? "Please review the community guidelines before posting again. Continued violations can result in further restrictions or a permanent ban."
    : "Please do not re-upload prohibited content. Continued violations can result in further restrictions or a permanent ban.";

  return [
    intro,
    actionSentence,
    moderatorNote ? `Moderator note: ${moderatorNote}` : "",
    ...warnings,
    closing,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2000);
};

const resolveModerationSenderId = async ({ actor = {}, receiverId = "" } = {}) => {
  const actorId = toIdString(actor?._id || actor?.id);
  if (actorId && actorId !== receiverId) {
    const sender = await User.findById(actorId).select("_id").lean();
    if (sender) {
      return actorId;
    }
  }

  const fallback = await User.findOne({
    role: { $in: MODERATION_SENDER_ROLES },
    isDeleted: { $ne: true },
    isBanned: { $ne: true },
  })
    .sort({ createdAt: 1 })
    .select("_id")
    .lean();

  const fallbackId = toIdString(fallback?._id);
  if (fallbackId && fallbackId !== receiverId) {
    return fallbackId;
  }

  return "";
};

const sendModerationMessengerWarning = async ({
  req = null,
  actor = {},
  recipientId = "",
  action = "",
  reason = "",
  scope = "content",
  subjectTitle = "",
  subjectDescription = "",
  labels = [],
  clientSeed = "",
} = {}) => {
  const receiverId = toIdString(recipientId);
  if (!receiverId) {
    return { sent: false, skipped: true, reason: "missing_recipient" };
  }

  const senderId = await resolveModerationSenderId({ actor, receiverId });
  if (!senderId) {
    return { sent: false, skipped: true, reason: "missing_sender" };
  }

  const text = buildModerationMessageText({
    action,
    reason,
    scope,
    subjectTitle,
    subjectDescription,
    labels,
  });

  if (!text) {
    return { sent: false, skipped: true, reason: "empty_message" };
  }

  const hash = crypto
    .createHash("sha1")
    .update(
      [
        senderId,
        receiverId,
        String(scope || ""),
        String(action || ""),
        String(subjectTitle || ""),
        String(subjectDescription || ""),
        String(reason || ""),
        Array.isArray(labels) ? labels.join(",") : "",
        String(clientSeed || ""),
      ].join("|")
    )
    .digest("hex");
  const clientId = `moderation_${hash}`;

  let result;
  try {
    result = await persistChatMessage({
      senderId,
      receiverId,
      payload: {
        text,
        type: "text",
        clientId,
      },
    });
  } catch (error) {
    console.error("Moderation messenger warning failed:", error);
    return { sent: false, skipped: false, error: error.message || "Failed to send moderation warning" };
  }

  if (result.existed) {
    return {
      sent: false,
      duplicate: true,
      messageId: result.message?._id ? String(result.message._id) : "",
      text,
    };
  }

  const io = req?.app?.get("io") || null;
  const onlineUsers = req?.app?.get("onlineUsers") || null;
  const payload = result.message;
  const senderRoom = toIdString(payload.senderId);
  const receiverRoom = toIdString(payload.receiverId);

  if (io) {
    io.to(receiverRoom).to(senderRoom).emit("newMessage", payload);
    io.to(`user:${receiverRoom}`).to(`user:${senderRoom}`).emit("chat:message", payload);
    io.to(`user:${senderRoom}`).emit("chat:sent", {
      serverMsgId: payload?._id || null,
      clientMsgId: payload?.clientId || null,
      persistedAt: payload?.createdAt || new Date().toISOString(),
      toUserId: receiverRoom,
    });
  }

  await createNotification({
    recipient: receiverRoom,
    sender: senderRoom,
    type: "message",
    text: "sent you a moderation warning",
    entity: {
      id: payload._id,
      model: "Message",
    },
    metadata: {
      previewText: text.slice(0, 120),
      link: "/home",
    },
    io,
    onlineUsers,
  }).catch(() => null);

  return {
    sent: true,
    duplicate: false,
    messageId: String(payload._id),
    text,
  };
};

module.exports = {
  buildModerationMessageText,
  sendModerationMessengerWarning,
};
