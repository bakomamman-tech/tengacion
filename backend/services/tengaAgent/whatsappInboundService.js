const crypto = require("crypto");

const Agent = require("../../models/tengaAgent/Agent");
const Conversation = require("../../models/tengaAgent/Conversation");
const Message = require("../../models/tengaAgent/Message");
const Organization = require("../../models/tengaAgent/Organization");
const WhatsAppConnection = require("../../models/tengaAgent/WhatsAppConnection");
const {
  isAutoReplyEnabled,
  processWhatsAppAutoReply,
} = require("./whatsappOutboundService");

const PROVIDER = "meta_cloud";
const MESSAGE_PROVIDER = "meta_whatsapp";
const MAX_TEXT_LENGTH = 6000;
const MAX_EXTERNAL_ID_LENGTH = 160;
const MAX_PROVIDER_MESSAGE_ID_LENGTH = 300;

const clean = (value, max = 300) =>
  String(value || "")
    .trim()
    .slice(0, max);

const toRawBuffer = (rawBody) => {
  if (Buffer.isBuffer(rawBody)) {
    return rawBody;
  }

  if (typeof rawBody === "string") {
    return Buffer.from(rawBody, "utf8");
  }

  return null;
};

const verifyMetaWebhookSignature = ({
  rawBody,
  signatureHeader,
  appSecret,
}) => {
  const secret = String(appSecret || "").trim();
  const signature = String(signatureHeader || "").trim();
  const body = toRawBuffer(rawBody);

  if (!secret || !body || !/^sha256=[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  const received = signature.slice("sha256=".length).toLowerCase();

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
};

const parseProviderTimestamp = (value) => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
};

const extractInboundTextEvents = (payload = {}) => {
  const events = [];
  let ignored = 0;

  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value || {};
      const phoneNumberId = clean(value?.metadata?.phone_number_id, 160);
      const messages = Array.isArray(value?.messages) ? value.messages : [];

      for (const message of messages) {
        const providerMessageId = clean(message?.id, MAX_PROVIDER_MESSAGE_ID_LENGTH);
        const externalSenderId = clean(message?.from, MAX_EXTERNAL_ID_LENGTH);
        const content = clean(message?.text?.body, MAX_TEXT_LENGTH);

        if (
          message?.type !== "text" ||
          !phoneNumberId ||
          !providerMessageId ||
          !externalSenderId ||
          !content
        ) {
          ignored += 1;
          continue;
        }

        events.push({
          phoneNumberId,
          providerMessageId,
          externalSenderId,
          content,
          providerTimestamp: parseProviderTimestamp(message?.timestamp),
        });
      }
    }
  }

  return { events, ignored };
};

const resolveTenantForPhoneNumber = async (phoneNumberId) => {
  const connection = await WhatsAppConnection.findOne({
    provider: PROVIDER,
    phoneNumberId,
    status: "active",
  }).lean();

  if (!connection) {
    return null;
  }

  const [organization, agent] = await Promise.all([
    Organization.findOne({
      _id: connection.organizationId,
      status: { $in: ["pilot", "active"] },
    }).lean(),
    Agent.findOne({
      _id: connection.agentId,
      organizationId: connection.organizationId,
      status: "active",
    }).lean(),
  ]);

  if (!organization || !agent) {
    return null;
  }

  return {
    connection,
    organization,
    agent,
  };
};

const buildSessionKey = ({ phoneNumberId, externalSenderId }) =>
  `wa:${clean(phoneNumberId, 80)}:${clean(externalSenderId, 60)}`.slice(0, 160);

const findOrCreateConversation = async ({ organization, agent, sessionKey }) => {
  let conversation = await Conversation.findOne({
    organizationId: organization._id,
    agentId: agent._id,
    sessionKey,
  });

  if (!conversation) {
    try {
      conversation = await Conversation.create({
        organizationId: organization._id,
        agentId: agent._id,
        sessionKey,
        channel: "whatsapp",
        status: "ai_active",
        lastMessageAt: new Date(),
      });
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }

      conversation = await Conversation.findOne({
        organizationId: organization._id,
        agentId: agent._id,
        sessionKey,
      });
    }
  }

  if (!conversation) {
    throw new Error("Unable to create WhatsApp conversation.");
  }

  if (conversation.channel !== "whatsapp") {
    conversation.channel = "whatsapp";
  }

  if (conversation.status === "closed") {
    conversation.status = "ai_active";
    conversation.assignedToUser = null;
    conversation.claimedAt = null;
    conversation.closedAt = null;
  }

  return conversation;
};

const persistInboundTextEvent = async (event) => {
  const tenant = await resolveTenantForPhoneNumber(event.phoneNumberId);

  if (!tenant) {
    return { status: "unrouted" };
  }

  const { organization, agent } = tenant;

  const existing = await Message.findOne({
    organizationId: organization._id,
    provider: MESSAGE_PROVIDER,
    providerMessageId: event.providerMessageId,
  })
    .select("_id conversationId")
    .lean();

  if (existing) {
    return {
      status: "duplicate",
      messageId: existing._id,
      conversationId: existing.conversationId,
    };
  }

  const sessionKey = buildSessionKey(event);
  const conversation = await findOrCreateConversation({
    organization,
    agent,
    sessionKey,
  });

  let message;

  try {
    message = await Message.create({
      organizationId: organization._id,
      conversationId: conversation._id,
      agentId: agent._id,
      sender: "customer",
      type: "text",
      content: event.content,
      provider: MESSAGE_PROVIDER,
      providerMessageId: event.providerMessageId,
      externalSenderId: event.externalSenderId,
      providerTimestamp: event.providerTimestamp,
    });
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const duplicate = await Message.findOne({
      organizationId: organization._id,
      provider: MESSAGE_PROVIDER,
      providerMessageId: event.providerMessageId,
    })
      .select("_id conversationId")
      .lean();

    return {
      status: "duplicate",
      messageId: duplicate?._id || null,
      conversationId: duplicate?.conversationId || conversation._id,
    };
  }

  conversation.lastMessageAt = message.createdAt || new Date();
  await conversation.save();

  return {
    status: "stored",
    messageId: message._id,
    conversationId: conversation._id,
    organizationId: organization._id,
    agentId: agent._id,
  };
};

const updateReplySummary = (summary, replyResult = {}) => {
  if (replyResult.status === "accepted") summary.repliesAccepted += 1;
  if (replyResult.status === "failed") summary.repliesFailed += 1;
  if (replyResult.status === "suppressed_human") summary.repliesSuppressed += 1;
  if (replyResult.status === "already_claimed") summary.repliesAlreadyClaimed += 1;
};

const processWhatsAppWebhook = async (
  payload = {},
  {
    autoReply = isAutoReplyEnabled(),
    replyProcessor = processWhatsAppAutoReply,
  } = {}
) => {
  if (payload?.object && payload.object !== "whatsapp_business_account") {
    return {
      received: 0,
      stored: 0,
      duplicates: 0,
      unrouted: 0,
      ignored: 0,
      repliesAccepted: 0,
      repliesFailed: 0,
      repliesSuppressed: 0,
      repliesAlreadyClaimed: 0,
    };
  }

  const { events, ignored } = extractInboundTextEvents(payload);
  const summary = {
    received: events.length,
    stored: 0,
    duplicates: 0,
    unrouted: 0,
    ignored,
    repliesAccepted: 0,
    repliesFailed: 0,
    repliesSuppressed: 0,
    repliesAlreadyClaimed: 0,
  };

  for (const event of events) {
    const result = await persistInboundTextEvent(event);
    if (result.status === "stored") summary.stored += 1;
    if (result.status === "duplicate") summary.duplicates += 1;
    if (result.status === "unrouted") summary.unrouted += 1;

    if (
      autoReply &&
      result.messageId &&
      (result.status === "stored" || result.status === "duplicate")
    ) {
      try {
        const replyResult = await replyProcessor({
          inboundMessageId: result.messageId,
          phoneNumberId: event.phoneNumberId,
          recipientId: event.externalSenderId,
        });
        updateReplySummary(summary, replyResult);
      } catch {
        summary.repliesFailed += 1;
      }
    }
  }

  return summary;
};

module.exports = {
  MESSAGE_PROVIDER,
  PROVIDER,
  buildSessionKey,
  extractInboundTextEvents,
  persistInboundTextEvent,
  processWhatsAppWebhook,
  resolveTenantForPhoneNumber,
  verifyMetaWebhookSignature,
};
