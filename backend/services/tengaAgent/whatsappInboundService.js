const crypto = require("crypto");

const Agent = require("../../models/tengaAgent/Agent");
const Conversation = require("../../models/tengaAgent/Conversation");
const Message = require("../../models/tengaAgent/Message");
const Organization = require("../../models/tengaAgent/Organization");
const WhatsAppConnection = require("../../models/tengaAgent/WhatsAppConnection");
const {
  assertFeatureAccess,
  recordUsage,
  releaseConversationStart,
  reserveConversationStart,
  TengaAgentBillingError,
} = require("./billingService");
const {
  isAutoReplyEnabled,
  queueWhatsAppAutoReply,
} = require("./whatsappOutboundService");
const {
  isWhatsAppVoiceEnabled,
} = require("./whatsappVoiceService");

const PROVIDER = "meta_cloud";
const MESSAGE_PROVIDER = "meta_whatsapp";
const MAX_TEXT_LENGTH = 6000;
const MAX_EXTERNAL_ID_LENGTH = 160;
const MAX_PROVIDER_MESSAGE_ID_LENGTH = 300;
const MAX_PROVIDER_MEDIA_ID_LENGTH = 300;
const VOICE_PENDING_CONTENT = "Voice note received. Transcription pending.";

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

const extractInboundEvents = (
  payload = {},
  { voiceEnabled = isWhatsAppVoiceEnabled() } = {}
) => {
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
        const providerTimestamp = parseProviderTimestamp(message?.timestamp);

        if (!phoneNumberId || !providerMessageId || !externalSenderId) {
          ignored += 1;
          continue;
        }

        if (message?.type === "text") {
          const content = clean(message?.text?.body, MAX_TEXT_LENGTH);
          if (!content) {
            ignored += 1;
            continue;
          }

          events.push({
            sourceType: "text",
            phoneNumberId,
            providerMessageId,
            externalSenderId,
            content,
            providerTimestamp,
          });
          continue;
        }

        if (message?.type === "audio" && voiceEnabled) {
          const mediaId = clean(message?.audio?.id, MAX_PROVIDER_MEDIA_ID_LENGTH);
          if (!mediaId) {
            ignored += 1;
            continue;
          }

          events.push({
            sourceType: "voice_note",
            phoneNumberId,
            providerMessageId,
            externalSenderId,
            content: VOICE_PENDING_CONTENT,
            providerTimestamp,
            providerMediaId: mediaId,
            providerMediaMimeType: clean(message?.audio?.mime_type, 160),
            providerMediaSha256: clean(message?.audio?.sha256, 200),
          });
          continue;
        }

        ignored += 1;
      }
    }
  }

  return { events, ignored };
};

const extractInboundTextEvents = (payload = {}) => {
  const { events, ignored } = extractInboundEvents(payload, { voiceEnabled: false });
  return {
    events: events.filter((event) => event.sourceType === "text"),
    ignored,
  };
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
    }),
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
    await reserveConversationStart({ organization });

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
      await releaseConversationStart({
        organizationId: organization._id,
      }).catch(() => null);

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

const persistInboundEvent = async (event) => {
  const tenant = await resolveTenantForPhoneNumber(event.phoneNumberId);

  if (!tenant) {
    return { status: "unrouted", sourceType: event.sourceType };
  }

  const { organization, agent } = tenant;

  try {
    await assertFeatureAccess({ organization, feature: "whatsapp" });
    if (event.sourceType === "voice_note") {
      await assertFeatureAccess({ organization, feature: "voice" });
    }
  } catch (error) {
    if (error instanceof TengaAgentBillingError) {
      return {
        status: "blocked_plan",
        sourceType: event.sourceType,
        code: error.code,
      };
    }
    throw error;
  }

  const existing = await Message.findOne({
    organizationId: organization._id,
    provider: MESSAGE_PROVIDER,
    providerMessageId: event.providerMessageId,
  })
    .select("_id conversationId sourceType transcriptionStatus")
    .lean();

  if (existing) {
    return {
      status: "duplicate",
      messageId: existing._id,
      conversationId: existing.conversationId,
      sourceType: existing.sourceType || event.sourceType,
      transcriptionStatus: existing.transcriptionStatus || null,
    };
  }

  let conversation;
  try {
    const sessionKey = buildSessionKey(event);
    conversation = await findOrCreateConversation({
      organization,
      agent,
      sessionKey,
    });
  } catch (error) {
    if (error instanceof TengaAgentBillingError) {
      return {
        status: "blocked_plan",
        sourceType: event.sourceType,
        code: error.code,
      };
    }
    throw error;
  }

  let message;

  try {
    const isVoiceNote = event.sourceType === "voice_note";
    message = await Message.create({
      organizationId: organization._id,
      conversationId: conversation._id,
      agentId: agent._id,
      sender: "customer",
      type: "text",
      sourceType: isVoiceNote ? "voice_note" : "text",
      content: event.content,
      provider: MESSAGE_PROVIDER,
      providerMessageId: event.providerMessageId,
      externalSenderId: event.externalSenderId,
      providerPhoneNumberId: event.phoneNumberId,
      providerMediaId: isVoiceNote ? event.providerMediaId : null,
      providerMediaMimeType: isVoiceNote ? event.providerMediaMimeType || null : null,
      providerMediaSha256: isVoiceNote ? event.providerMediaSha256 || null : null,
      transcriptionStatus: isVoiceNote ? "pending" : "not_required",
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
      .select("_id conversationId sourceType transcriptionStatus")
      .lean();

    return {
      status: "duplicate",
      messageId: duplicate?._id || null,
      conversationId: duplicate?.conversationId || conversation._id,
      sourceType: duplicate?.sourceType || event.sourceType,
      transcriptionStatus: duplicate?.transcriptionStatus || null,
    };
  }

  conversation.lastMessageAt = message.createdAt || new Date();
  await conversation.save();

  const usageWrites = [
    recordUsage({
      organizationId: organization._id,
      metric: "customerMessages",
    }),
    recordUsage({
      organizationId: organization._id,
      metric: "whatsappInboundMessages",
    }),
  ];
  if (message.sourceType === "voice_note") {
    usageWrites.push(
      recordUsage({
        organizationId: organization._id,
        metric: "voiceNotes",
      })
    );
  }
  await Promise.all(usageWrites).catch(() => null);

  return {
    status: "stored",
    messageId: message._id,
    conversationId: conversation._id,
    organizationId: organization._id,
    agentId: agent._id,
    sourceType: message.sourceType,
    transcriptionStatus: message.transcriptionStatus,
  };
};

const persistInboundTextEvent = async (event) =>
  persistInboundEvent({ ...event, sourceType: "text" });

const updateReplyQueueSummary = (summary, replyResult = {}) => {
  if (replyResult.status === "queued") summary.repliesQueued += 1;
  if (replyResult.status === "already_queued") summary.repliesAlreadyQueued += 1;
  if (replyResult.status === "suppressed_human") summary.repliesSuppressed += 1;
};

const processWhatsAppWebhook = async (
  payload = {},
  {
    autoReply = isAutoReplyEnabled(),
    voiceEnabled = isWhatsAppVoiceEnabled(),
    replyProcessor = queueWhatsAppAutoReply,
  } = {}
) => {
  if (payload?.object && payload.object !== "whatsapp_business_account") {
    return {
      received: 0,
      stored: 0,
      duplicates: 0,
      unrouted: 0,
      blockedByPlan: 0,
      ignored: 0,
      repliesQueued: 0,
      repliesAlreadyQueued: 0,
      repliesSuppressed: 0,
      replyQueueFailures: 0,
      voiceNotesQueued: 0,
      voiceNotesAlreadyQueued: 0,
    };
  }

  const { events, ignored } = extractInboundEvents(payload, { voiceEnabled });
  const summary = {
    received: events.length,
    stored: 0,
    duplicates: 0,
    unrouted: 0,
    blockedByPlan: 0,
    ignored,
    repliesQueued: 0,
    repliesAlreadyQueued: 0,
    repliesSuppressed: 0,
    replyQueueFailures: 0,
    voiceNotesQueued: 0,
    voiceNotesAlreadyQueued: 0,
  };

  for (const event of events) {
    const result = await persistInboundEvent(event);
    if (result.status === "stored") summary.stored += 1;
    if (result.status === "duplicate") summary.duplicates += 1;
    if (result.status === "unrouted") summary.unrouted += 1;
    if (result.status === "blocked_plan") summary.blockedByPlan += 1;

    if (result.sourceType === "voice_note") {
      if (result.status === "stored" && result.transcriptionStatus === "pending") {
        summary.voiceNotesQueued += 1;
      }
      if (
        result.status === "duplicate" &&
        ["pending", "processing"].includes(result.transcriptionStatus)
      ) {
        summary.voiceNotesAlreadyQueued += 1;
      }
      continue;
    }

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
        updateReplyQueueSummary(summary, replyResult);
      } catch {
        summary.replyQueueFailures += 1;
      }
    }
  }

  return summary;
};

module.exports = {
  MESSAGE_PROVIDER,
  PROVIDER,
  VOICE_PENDING_CONTENT,
  buildSessionKey,
  extractInboundEvents,
  extractInboundTextEvents,
  persistInboundEvent,
  persistInboundTextEvent,
  processWhatsAppWebhook,
  resolveTenantForPhoneNumber,
  verifyMetaWebhookSignature,
};
