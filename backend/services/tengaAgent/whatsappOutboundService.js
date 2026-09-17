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
const REPLY_SWEEP_INTERVAL_MS = 60 * 1000;
const REPLY_SWEEP_LIMIT = 10;

let replySweepTimer = null;

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

const loadReplyContext = async (inboundMessageId) => {
  const inboundMessage = await Message.findById(inboundMessageId);
  if (
    !inboundMessage ||
    inboundMessage.sender !== "customer" ||
    inboundMessage.provider !== MESSAGE_PROVIDER ||
    !inboundMessage.providerMessageId
  ) {
    return null;
  }

  const [organization, agent, conversation] = await Promise.all([
    Organization.findOne({
      _id: inboundMessage.organizationId,
      status: { $in: ["pilot", "active"] },
    }),
    Agent.findOne({
      _id: inboundMessage.agentId,
      organizationId: inboundMessage.organizationId,
      status: "active",
    }),
    Conversation.findOne({
      _id: inboundMessage.conversationId,
      organizationId: inboundMessage.organizationId,
      agentId: inboundMessage.agentId,
      channel: "whatsapp",
    }),
  ]);

  if (!organization || !agent || !conversation) {
    return null;
  }

  return { inboundMessage, organization, agent, conversation };
};

const queueWhatsAppAutoReply = async ({
  inboundMessageId,
  phoneNumberId,
  recipientId,
}) => {
  const context = await loadReplyContext(inboundMessageId);
  if (!context) {
    return { status: "skipped_invalid" };
  }

  const { inboundMessage, conversation } = context;
  if (conversation.status === "human_active") {
    return { status: "suppressed_human" };
  }

  const recipient = clean(recipientId || inboundMessage.externalSenderId, 160);
  const phone = clean(phoneNumberId, 160);
  if (!recipient || !phone) {
    return { status: "skipped_invalid" };
  }

  try {
    const reply = await WhatsAppReply.create({
      organizationId: inboundMessage.organizationId,
      agentId: inboundMessage.agentId,
      conversationId: conversation._id,
      inboundMessageId: inboundMessage._id,
      inboundProviderMessageId: inboundMessage.providerMessageId,
      phoneNumberId: phone,
      recipientId: recipient,
      status: "queued",
      attempts: 0,
    });

    return { status: "queued", replyId: reply._id };
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const existing = await WhatsAppReply.findOne({
      inboundMessageId: inboundMessage._id,
    }).lean();

    return {
      status: "already_queued",
      replyId: existing?._id || null,
      existingStatus: existing?.status || null,
    };
  }
};

const deliverWhatsAppReply = async ({
  replyId,
  sendText = sendMetaWhatsAppText,
  responseBuilder = respondToPublishedAgent,
}) => {
  const replyRecord = await WhatsAppReply.findOneAndUpdate(
    { _id: replyId, status: "queued" },
    {
      $set: { status: "processing", lastError: "" },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" }
  );

  if (!replyRecord) {
    const existing = await WhatsAppReply.findById(replyId).lean();
    return {
      status: "already_claimed",
      replyId,
      existingStatus: existing?.status || null,
    };
  }

  const context = await loadReplyContext(replyRecord.inboundMessageId);
  if (!context) {
    replyRecord.status = "skipped";
    replyRecord.completedAt = new Date();
    replyRecord.lastError = "Inbound WhatsApp reply context is no longer valid.";
    await replyRecord.save();
    return { status: "skipped_invalid", replyId: replyRecord._id };
  }

  const { inboundMessage, organization, agent, conversation } = context;

  if (conversation.status === "human_active") {
    replyRecord.status = "skipped";
    replyRecord.completedAt = new Date();
    replyRecord.lastError = "Human handoff owns this conversation.";
    await replyRecord.save();
    return { status: "suppressed_human", replyId: replyRecord._id };
  }

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
    await replyRecord.save();

    const delivery = await sendText({
      phoneNumberId: replyRecord.phoneNumberId,
      recipientId: replyRecord.recipientId,
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

const processWhatsAppAutoReply = async ({
  inboundMessageId,
  phoneNumberId,
  recipientId,
  sendText = sendMetaWhatsAppText,
  responseBuilder = respondToPublishedAgent,
}) => {
  const queued = await queueWhatsAppAutoReply({
    inboundMessageId,
    phoneNumberId,
    recipientId,
  });

  if (queued.status === "already_queued") {
    return {
      status: "already_claimed",
      replyId: queued.replyId,
      existingStatus: queued.existingStatus,
    };
  }

  if (queued.status !== "queued") {
    return queued;
  }

  return deliverWhatsAppReply({
    replyId: queued.replyId,
    sendText,
    responseBuilder,
  });
};

const drainQueuedWhatsAppReplies = async ({
  limit = REPLY_SWEEP_LIMIT,
  sendText = sendMetaWhatsAppText,
  responseBuilder = respondToPublishedAgent,
} = {}) => {
  if (!isAutoReplyEnabled()) {
    return { processed: 0, accepted: 0, failed: 0, suppressed: 0 };
  }

  const queued = await WhatsAppReply.find({ status: "queued" })
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Math.min(Number(limit) || REPLY_SWEEP_LIMIT, 50)))
    .select("_id")
    .lean();

  const summary = { processed: 0, accepted: 0, failed: 0, suppressed: 0 };

  for (const entry of queued) {
    const result = await deliverWhatsAppReply({
      replyId: entry._id,
      sendText,
      responseBuilder,
    });
    summary.processed += 1;
    if (result.status === "accepted") summary.accepted += 1;
    if (result.status === "failed") summary.failed += 1;
    if (result.status === "suppressed_human") summary.suppressed += 1;
  }

  return summary;
};

const startWhatsAppReplyScheduler = ({ logger = console } = {}) => {
  if (
    process.env.NODE_ENV === "test" ||
    !isAutoReplyEnabled() ||
    replySweepTimer
  ) {
    return replySweepTimer;
  }

  const runSweep = () =>
    drainQueuedWhatsAppReplies().catch((error) => {
      logger.error?.("[TengaAgent WhatsApp] reply sweep failed", {
        message: error?.message || String(error),
      });
    });

  const initialTimer = setTimeout(runSweep, 1500);
  initialTimer.unref?.();

  replySweepTimer = setInterval(runSweep, REPLY_SWEEP_INTERVAL_MS);
  replySweepTimer.unref?.();
  return replySweepTimer;
};

module.exports = {
  MESSAGE_PROVIDER,
  buildChannelSafeReply,
  buildMetaConfig,
  deliverWhatsAppReply,
  drainQueuedWhatsAppReplies,
  isAutoReplyEnabled,
  processWhatsAppAutoReply,
  queueWhatsAppAutoReply,
  sendMetaWhatsAppText,
  startWhatsAppReplyScheduler,
};
