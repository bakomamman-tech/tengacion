const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.TENGAAGENT_WHATSAPP_VERIFY_TOKEN = "tengaagent-test-verify-token";
process.env.TENGAAGENT_WHATSAPP_APP_SECRET = "tengaagent-test-app-secret";

const routes = require("../routes/tengaAgentWhatsApp");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const Organization = require("../models/tengaAgent/Organization");
const Agent = require("../models/tengaAgent/Agent");
const Conversation = require("../models/tengaAgent/Conversation");
const Message = require("../models/tengaAgent/Message");
const WhatsAppConnection = require("../models/tengaAgent/WhatsAppConnection");

let mongod;
let app;

const sign = (body) =>
  `sha256=${crypto
    .createHmac("sha256", process.env.TENGAAGENT_WHATSAPP_APP_SECRET)
    .update(Buffer.from(body, "utf8"))
    .digest("hex")}`;

const buildPayload = ({
  phoneNumberId,
  messageId = "wamid.test-001",
  from = "2348012345678",
  text = "Hello from WhatsApp",
} = {}) => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba-test",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "+234 800 000 0000",
              phone_number_id: phoneNumberId,
            },
            contacts: [
              {
                profile: { name: "Test Customer" },
                wa_id: from,
              },
            ],
            messages: [
              {
                from,
                id: messageId,
                timestamp: "1789617600",
                type: "text",
                text: { body: text },
              },
            ],
          },
        },
      ],
    },
  ],
});

const createTenant = async ({ slug, phoneNumberId }) => {
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
  });

  await WhatsAppConnection.create({
    organizationId: organization._id,
    agentId: agent._id,
    phoneNumberId,
    wabaId: `waba-${slug}`,
    status: "active",
  });

  return { organization, agent };
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });

  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });

  app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    })
  );
  app.use("/api/tengaagent/whatsapp", routes);
  app.use(errorHandler);
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe("TengaAgent WhatsApp webhook ingress", () => {
  it("completes Meta GET webhook verification only with the configured token", async () => {
    const success = await request(app)
      .get("/api/tengaagent/whatsapp/webhook")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": process.env.TENGAAGENT_WHATSAPP_VERIFY_TOKEN,
        "hub.challenge": "challenge-123",
      })
      .expect(200);

    expect(success.text).toBe("challenge-123");
    expect(success.headers["cache-control"]).toContain("no-store");

    await request(app)
      .get("/api/tengaagent/whatsapp/webhook")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token",
        "hub.challenge": "challenge-123",
      })
      .expect(403);
  });

  it("rejects webhook deliveries with a missing or invalid Meta signature", async () => {
    const payload = buildPayload({ phoneNumberId: "phone-a" });

    await request(app)
      .post("/api/tengaagent/whatsapp/webhook")
      .set("Content-Type", "application/json")
      .send(payload)
      .expect(401);

    await request(app)
      .post("/api/tengaagent/whatsapp/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", `sha256=${"0".repeat(64)}`)
      .send(payload)
      .expect(401);

    expect(await Message.countDocuments()).toBe(0);
  });

  it("routes a verified inbound text by provider phone number and persists it once", async () => {
    const { organization, agent } = await createTenant({
      slug: "tenant-a",
      phoneNumberId: "phone-a",
    });

    const payload = buildPayload({
      phoneNumberId: "phone-a",
      messageId: "wamid.tenant-a-001",
      from: "2348111111111",
      text: "I need help with an order",
    });
    const raw = JSON.stringify(payload);

    const first = await request(app)
      .post("/api/tengaagent/whatsapp/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", sign(raw))
      .send(raw)
      .expect(200);

    expect(first.body).toEqual(
      expect.objectContaining({
        ok: true,
        received: 1,
        stored: 1,
        duplicates: 0,
        unrouted: 0,
      })
    );

    const conversation = await Conversation.findOne({
      organizationId: organization._id,
      agentId: agent._id,
      channel: "whatsapp",
    }).lean();

    expect(conversation).toBeTruthy();
    expect(conversation.sessionKey).toBe("wa:phone-a:2348111111111");

    const message = await Message.findOne({
      organizationId: organization._id,
      providerMessageId: "wamid.tenant-a-001",
    }).lean();

    expect(message).toEqual(
      expect.objectContaining({
        sender: "customer",
        provider: "meta_whatsapp",
        externalSenderId: "2348111111111",
        content: "I need help with an order",
      })
    );

    const duplicate = await request(app)
      .post("/api/tengaagent/whatsapp/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", sign(raw))
      .send(raw)
      .expect(200);

    expect(duplicate.body.stored).toBe(0);
    expect(duplicate.body.duplicates).toBe(1);
    expect(await Message.countDocuments()).toBe(1);
    expect(await Conversation.countDocuments()).toBe(1);
  });

  it("keeps tenants isolated by resolving the provider connection server-side", async () => {
    const tenantA = await createTenant({
      slug: "tenant-a",
      phoneNumberId: "phone-a",
    });
    const tenantB = await createTenant({
      slug: "tenant-b",
      phoneNumberId: "phone-b",
    });

    const payloadA = buildPayload({
      phoneNumberId: "phone-a",
      messageId: "wamid.a",
      from: "2348000000001",
      text: "Tenant A message",
    });
    const payloadB = buildPayload({
      phoneNumberId: "phone-b",
      messageId: "wamid.b",
      from: "2348000000001",
      text: "Tenant B message",
    });

    for (const payload of [payloadA, payloadB]) {
      const raw = JSON.stringify(payload);
      await request(app)
        .post("/api/tengaagent/whatsapp/webhook")
        .set("Content-Type", "application/json")
        .set("X-Hub-Signature-256", sign(raw))
        .send(raw)
        .expect(200);
    }

    const messagesA = await Message.find({
      organizationId: tenantA.organization._id,
    }).lean();
    const messagesB = await Message.find({
      organizationId: tenantB.organization._id,
    }).lean();

    expect(messagesA).toHaveLength(1);
    expect(messagesA[0].content).toBe("Tenant A message");
    expect(messagesB).toHaveLength(1);
    expect(messagesB[0].content).toBe("Tenant B message");
  });

  it("acknowledges unrouted and non-message webhook events without creating data", async () => {
    const unroutedPayload = buildPayload({
      phoneNumberId: "unknown-phone",
      messageId: "wamid.unrouted",
    });
    const unroutedRaw = JSON.stringify(unroutedPayload);

    const unrouted = await request(app)
      .post("/api/tengaagent/whatsapp/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", sign(unroutedRaw))
      .send(unroutedRaw)
      .expect(200);

    expect(unrouted.body.unrouted).toBe(1);

    const statusPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-test",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "phone-a" },
                statuses: [{ id: "wamid.status", status: "delivered" }],
              },
            },
          ],
        },
      ],
    };
    const statusRaw = JSON.stringify(statusPayload);

    const status = await request(app)
      .post("/api/tengaagent/whatsapp/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", sign(statusRaw))
      .send(statusRaw)
      .expect(200);

    expect(status.body).toEqual(
      expect.objectContaining({
        ok: true,
        received: 0,
        stored: 0,
        duplicates: 0,
        unrouted: 0,
      })
    );
    expect(await Message.countDocuments()).toBe(0);
  });
});
