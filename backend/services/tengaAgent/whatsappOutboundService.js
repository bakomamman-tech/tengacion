const Agent = require("../../models/tengaAgent/Agent");
const Conversation = require("../../models/tengaAgent/Conversation");
const Message = require("../../models/tengaAgent/Message");
const Organization = require("../../models/tengaAgent/Organization");
const WhatsAppReply = require("../../models/tengaAgent/WhatsAppReply");

const {
  respondToPublishedAgent,
} = require("./publicAgentService");

const MESSAGE_PROVIDER = "meta_whatsapp";
const MAX_REPLY_LENGTH = 4096;
const MAX_HISTORY_MESSAGES = 12;
const META_TIMEOUT_MS = 15000;

const clean = (value, max = 4096) =>
  String(value || "")
    .trim()
    .slice(0, max);

const isAutoReplyEnabled = () =>
  String(process.env.TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED || "")
    .trim()
    .toLowerCase() === "true";

const buildMetaConfig = ({
  accessToken = process.env.TENGAAGENT_WHATSAPP_ACCESS_TOKEN,
  graphVersion = process.env.TENGAAGENT_WHATSAPP_GRAPH_VERSION,
} = {}) => {
  const token = clean(accessToken, 10000);
  const version = clean(graphVersion, 20);

  if (!token) {
    const error = new Error("WhatsApp access token is not configured.");
    error.code = "WHATSAPP_ACCESS_TOKEN_MISSING";
    throw error;
  }

  if (!/^v\d+\.\d+$/.test(version)) {
    const error = new Error("WhatsApp Graph API version is not configured.");
    error.code = "WHATSAPP_GRAPH_VERSION_MISSING";
    throw error;
  }

  return { token, version };
};

const parseProviderError = (payload = {}) => {
  const code = payload?.error?.code;
  const message = clean(payload?.error?.message, 500);

  if (message) {
    return code ? `Meta ${code}: ${message}` : message;
  }

  return "Meta rejected the WhatsApp message.";
};

const sendMetaWhatsAppText = async ({
  phoneNumberId,
  recipientId,
  text,
  fetchImpl = global.fetch,
  accessToken,
  graphVersion,
}) => {
  const phone = clean(phoneNumberId, 160);
  const recipient = clean(recipientId, 160);
  const bodyText = clean(text, MAX_REPLY_LENGTH);

  if (!phone || !recipient || !bodyText) {
    const error = new Error("WhatsApp outbound message is incomplete.");
    error.code = "WHATSAPP_OUTBOUND_INVALID";
    throw error;
  }

  if (typeof fetchImpl !== "function") {
    const error = new Error("HTTP client is unavailable.");
    error.code = "WHATSAPP_HTTP_UNAVAILABLE";
    throw error;
  }

  const { token, version } = buildMetaConfig({
    accessToken,
    graphVersion,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), META_TIMEOUT_MS);

  try {
    const response = await fetchImpl(
      `https://graph.facebook.com/${version}/${encodeURIComponent(phone)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: {
            preview_url: false,
            body: bodyText,
          },
        }),
        signal: controller.signal,
      }
    );

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const error = new Error(parseProviderError(payload));
      error.code = "WHATSAPP_PROVIDER_REJECTED";
      error.status = response.status;
      throw error;
    }

    const providerMessageId = clean(payload?.messages?.[0]?.id, 300);
    if (!providerMessageId) {
      const error = new Error("Meta accepted the request without returning a message id.");
      error.code = "WHATSAPP_PROVIDER_ID_MISSING";
      throw error;
    }

    return { providerMessageId };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("WhatsApp provider request timed out.");
      timeoutError.code = "WHATSAPP_PROVIDER_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const buildConversationHistory = async (conversationId) => {
  const recentMessages = await Message.find({
    conversationId,
    sender: { $ne: "tool" },
  })
    .sort({ createdAt: -1 })
    .limit(MAX_HISTORY_MESSAGES)
    .lean();

  return recentMessages.reverse().map((entry) => ({
    sender: entry.sender,
    content: entry.content,
  }));
};

const buildChannelSafeReply = ({ organization, result }) => {
  const actionType = result?.actions?.[0]?.type || "";

  if (actionType === "book_appointment") {
    return {
      reply:
        `I can help arrange that with ${organization.name}. A team member can continue here to confirm a suitable meeting time.`,
      requestHandoff: true,
    };
  }

  if (actionType === "capture_lead") {
    return {
      reply:
        `I can connect you with ${organization.name}. A team member can continue this WhatsApp conversation with you.`,
      requestHandoff: true,
    };
  }

  return {
    reply: clean(result?.reply, MAX_REPLY_LENGTH),
    requestHandoff: false,
  };
};

const claimReply = async ({
  inboundMessage,
  conversation,
  phoneNumberId,
  recipientId,
}) => {
  try {
    const reply = await WhatsAppReply.create({
      organizationId: inboundMessage.organizationId,
      agentId: inboundMessage.agentId,
      conversationId: conversation._id,
      inboundMessageId: inboundMessage._id,
      inboundProviderMessageId: inboundMessage.providerMessageId,
      phoneNumberId,
      recipientId,
      status: "processing",
      attempts: 0,
    });

    return { claimed: true, reply };
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const existing = await WhatsAppReply.findOne({
      inboundMessageId: inboundMessage._id,
    });

    return { claimed: false, reply: existing };
  }
};

const processWhatsAppAutoReply = async ({
  inboundMessageId,
  phoneNumberId,
  recipientId,
  sendText = sendMetaWhatsAppText,
  responseBuilder = respondToPublishedAgent,
}) => {
  const inboundMessage = await Message.findById(inboundMessageId);
  if (
    !inboundMessage ||
    inboundMessage.sender !== "customer" ||
    inboundMessage.provider !== MESSAGE_PROVIDER ||
    !inboundMessage.providerMessageId
  ) {
    return { status: "skipped_invalid" };
  }

  const [organization, agent, conversation] = await Promise.all([
    Organization.findById(inboundMessage.organizationId),
    Agent.findOne({
      _id: inboundMessage.agentId,
      organizationId: inboundMessage.organizationId,
      status: "active",
    }),
    Conversation.findOne({
      _id: inboundMessage.conversationId,
      organizationId: inboundMessage.organizationId,
      agentId: inboundMessage.agentId,
    }),
  ]);

  if (!organization || !agent || !conversation) {
    return { status: "skipped_tenant" };
  }

  if (conversation.status === "human_active") {
    return { status: "suppressed_human" };
  }

  const recipient = clean(recipientId || inboundMessage.externalSenderId, 160);
  const phone = clean(phoneNumberId, 160);
  if (!recipient || !phone) {
    return { status: "skipped_invalid" };
  }

  const claim = await claimReply({
    inboundMessage,
    conversation,
    phoneNumberId: phone,
    recipientId: recipient,
  });

  if (!claim.claimed) {
    return {
      status: "already_claimed",
      replyId: claim.reply?._id || null,
      existingStatus: claim.reply?.status || null,
    };
  }

  const replyRecord = claim.reply;

  try {
    const conversationHistory = await buildConversationHistory(conversation._id);
    const result = await responseBuilder({
      organization,
      agent,
      message: inboundMessage.content,
      conversationHistory,
    });

    const channelReply = buildChannelSafeReply({ organization, result });
    if (!channelReply.reply) {
      replyRecord.status = "skipped";
      replyRecord.completedAt = new Date();
      replyRecord.lastError = "No reply text was generated.";
      await replyRecord.save();
      return { status: "skipped_empty", replyId: replyRecord._id };
    }

    replyRecord.replyText = channelReply.reply;
    replyRecord.attempts += 1;
    await replyRecord.save();

    const delivery = await sendText({
      phoneNumberId: phone,
      recipientId: recipient,
      text: channelReply.reply,
    });

    const agentMessage = await Message.create({
      organizationId: organization._id,
      conversationId: conversation._id,
      agentId: agent._id,
      sender: "agent",
      type: "text",
      content: channelReply.reply,
      provider: MESSAGE_PROVIDER,
      providerMessageId: delivery.providerMessageId,
    });

    if (channelReply.requestHandoff && conversation.status !== "human_active") {
      conversation.status = "handoff_requested";
    }
    conversation.lastMessageAt = agentMessage.createdAt || new Date();
    await conversation.save();

    replyRecord.status = "accepted";
    replyRecord.providerMessageId = delivery.providerMessageId;
    replyRecord.completedAt = new Date();
    replyRecord.lastError = "";
    await replyRecord.save();

    return {
      status: "accepted",
      replyId: replyRecord._id,
      providerMessageId: delivery.providerMessageId,
      messageId: agentMessage._id,
    };
  } catch (error) {
    replyRecord.status = "failed";
    replyRecord.completedAt = new Date();
    replyRecord.lastError = clean(error?.message || error, 1000);
    await replyRecord.save().catch(() => null);

    return {
      status: "failed",
      replyId: replyRecord._id,
      code: error?.code || "WHATSAPP_REPLY_FAILED",
    };
  }
};

module.exports = {
  MESSAGE_PROVIDER,
  buildChannelSafeReply,
  buildMetaConfig,
  isAutoReplyEnabled,
  processWhatsAppAutoReply,
  sendMetaWhatsAppText,
};
