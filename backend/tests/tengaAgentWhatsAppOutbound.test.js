const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengaagent-whatsapp-outbound-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "tengaagent-whatsapp-outbound-jwt-secret-not-for-production";
process.env.OPENAI_API_KEY = "";

const Organization = require("../models/tengaAgent/Organization");
const Agent = require("../models/tengaAgent/Agent");
const Conversation = require("../models/tengaAgent/Conversation");
const Message = require("../models/tengaAgent/Message");
const WhatsAppReply = require("../models/tengaAgent/WhatsAppReply");
const {
  processWhatsAppAutoReply,
  sendMetaWhatsAppText,
} = require("../services/tengaAgent/whatsappOutboundService");

let mongod;

const createInbound = async ({
  slug = "tenant-a",
  conversationStatus = "ai_active",
  inboundProviderMessageId = "wamid.inbound-1",
  text = "Hello, I need help",
} = {}) => {
  const organization = await Organization.create({
    name: `${slug} Limited`,
    slug,
    status: "active",
    plan: "growth",
  });

  const agent = await Agent.create({
    organizationId: organization._id,
    key: `${slug}-agent`,
    name: `${slug} Agent`,
    status: "active",
    enabledTools: ["lead_capture", "appointment_requests"],
  });

  const conversation = await Conversation.create({
    organizationId: organization._id,
    agentId: agent._id,
    sessionKey: `wa:phone-${slug}:2348012345678`,
    channel: "whatsapp",
    status: conversationStatus,
  });

  const inboundMessage = await Message.create({
    organizationId: organization._id,
    conversationId: conversation._id,
    agentId: agent._id,
    sender: "customer",
    type: "text",
    content: text,
    provider: "meta_whatsapp",
    providerMessageId: inboundProviderMessageId,
    externalSenderId: "2348012345678",
  });

  return { organization, agent, conversation, inboundMessage };
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });

  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await WhatsAppReply.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe("TengaAgent WhatsApp outbound replies", () => {
  it("sends Meta text messages through the phone-number messages endpoint", async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        messaging_product: "whatsapp",
        messages: [{ id: "wamid.outbound-1" }],
      }),
    }));

    const result = await sendMetaWhatsAppText({
      phoneNumberId: "123456789",
      recipientId: "2348012345678",
      text: "Hello from TengaAgent",
      accessToken: "test-system-user-token",
      graphVersion: "v23.0",
      fetchImpl,
    });

    expect(result.providerMessageId).toBe("wamid.outbound-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v23.0/123456789/messages");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer test-system-user-token");
    expect(JSON.parse(options.body)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "2348012345678",
      type: "text",
      text: {
        preview_url: false,
        body: "Hello from TengaAgent",
      },
    });
  });

  it("sends at most one AI reply for the same inbound WhatsApp message", async () => {
    const { inboundMessage, organization } = await createInbound();
    const sendText = jest.fn(async () => ({
      providerMessageId: "wamid.outbound-once",
    }));
    const responseBuilder = jest.fn(async () => ({
      reply: "Thanks. How can I help further?",
      actions: [],
    }));

    const first = await processWhatsAppAutoReply({
      inboundMessageId: inboundMessage._id,
      phoneNumberId: "phone-tenant-a",
      recipientId: "2348012345678",
      sendText,
      responseBuilder,
    });

    const second = await processWhatsAppAutoReply({
      inboundMessageId: inboundMessage._id,
      phoneNumberId: "phone-tenant-a",
      recipientId: "2348012345678",
      sendText,
      responseBuilder,
    });

    expect(first.status).toBe("accepted");
    expect(second.status).toBe("already_claimed");
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(responseBuilder).toHaveBeenCalledTimes(1);
    expect(await WhatsAppReply.countDocuments()).toBe(1);

    const messages = await Message.find({
      organizationId: organization._id,
    })
      .sort({ createdAt: 1 })
      .lean();

    expect(messages).toHaveLength(2);
    expect(messages[1]).toEqual(
      expect.objectContaining({
        sender: "agent",
        content: "Thanks. How can I help further?",
        provider: "meta_whatsapp",
        providerMessageId: "wamid.outbound-once",
      })
    );
  });

  it("suppresses AI replies while a human owns the WhatsApp conversation", async () => {
    const { inboundMessage } = await createInbound({
      conversationStatus: "human_active",
    });
    const sendText = jest.fn();
    const responseBuilder = jest.fn();

    const result = await processWhatsAppAutoReply({
      inboundMessageId: inboundMessage._id,
      phoneNumberId: "phone-tenant-a",
      recipientId: "2348012345678",
      sendText,
      responseBuilder,
    });

    expect(result.status).toBe("suppressed_human");
    expect(sendText).not.toHaveBeenCalled();
    expect(responseBuilder).not.toHaveBeenCalled();
    expect(await WhatsAppReply.countDocuments()).toBe(0);
  });

  it("turns lead and booking actions into a WhatsApp handoff instead of pretending a form exists", async () => {
    const { inboundMessage, conversation } = await createInbound({
      text: "I want to speak with someone",
    });
    const sendText = jest.fn(async ({ text }) => ({
      providerMessageId: `wamid.${text.length}`,
    }));
    const responseBuilder = jest.fn(async () => ({
      reply: "Use the contact option below.",
      actions: [{ type: "capture_lead", label: "Leave your details" }],
    }));

    const result = await processWhatsAppAutoReply({
      inboundMessageId: inboundMessage._id,
      phoneNumberId: "phone-tenant-a",
      recipientId: "2348012345678",
      sendText,
      responseBuilder,
    });

    expect(result.status).toBe("accepted");
    const sentText = sendText.mock.calls[0][0].text;
    expect(sentText).toContain("continue this WhatsApp conversation");
    expect(sentText).not.toContain("option below");

    const updatedConversation = await Conversation.findById(conversation._id).lean();
    expect(updatedConversation.status).toBe("handoff_requested");
  });

  it("records provider failure without persisting a false delivered agent message", async () => {
    const { inboundMessage, organization } = await createInbound();
    const sendText = jest.fn(async () => {
      const error = new Error("Meta rejected the message");
      error.code = "WHATSAPP_PROVIDER_REJECTED";
      throw error;
    });
    const responseBuilder = jest.fn(async () => ({
      reply: "This reply should fail delivery.",
      actions: [],
    }));

    const result = await processWhatsAppAutoReply({
      inboundMessageId: inboundMessage._id,
      phoneNumberId: "phone-tenant-a",
      recipientId: "2348012345678",
      sendText,
      responseBuilder,
    });

    expect(result.status).toBe("failed");
    expect(result.code).toBe("WHATSAPP_PROVIDER_REJECTED");

    const reply = await WhatsAppReply.findOne({
      inboundMessageId: inboundMessage._id,
    }).lean();
    expect(reply.status).toBe("failed");
    expect(reply.attempts).toBe(1);
    expect(reply.lastError).toContain("Meta rejected");

    expect(
      await Message.countDocuments({
        organizationId: organization._id,
        sender: "agent",
      })
    ).toBe(0);
  });
});
