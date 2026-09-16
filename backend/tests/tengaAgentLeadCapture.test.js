const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");

const {
  MongoMemoryServer,
} = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-lead-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-local-test-secret-not-for-production";

require("../../apps/api/config/env");

const routes = require("../routes/tengaAgent");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const Conversation = require("../models/tengaAgent/Conversation");
const Lead = require("../models/tengaAgent/Lead");

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: {
      launchTimeout: 60000,
    },
  });

  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });

  app = express();
  app.use(express.json());
  app.use("/api/tengaagent", routes);
  app.use(errorHandler);
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();

  if (mongod) {
    await mongod.stop();
  }
});

describe("TengaAgent lead capture", () => {
  it("offers lead capture when a visitor asks for human follow-up", async () => {
    const response = await request(app)
      .post("/api/tengaagent/chat/tengacion-demo/message")
      .send({
        message: "I want to speak with someone about my project.",
        sessionId: "lead-intent-001",
      })
      .expect(200);

    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "capture_lead",
        }),
      ])
    );
  });

  it("persists a consented lead and links it to the conversation", async () => {
    const sessionId = "lead-session-001";

    await request(app)
      .post("/api/tengaagent/chat/tengacion-demo/message")
      .send({
        message: "I want to talk to the team about an AI product.",
        sessionId,
      })
      .expect(200);

    const response = await request(app)
      .post("/api/tengaagent/chat/tengacion-demo/lead")
      .send({
        sessionId,
        name: "Ada Customer",
        email: "ADA@example.com",
        company: "Northstar Labs",
        projectSummary: "We need an AI receptionist for our website.",
        consentToContact: true,
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        lead: expect.objectContaining({
          status: "new",
        }),
        conversation: expect.objectContaining({
          status: "handoff_requested",
        }),
      })
    );

    const leads = await Lead.find({}).lean();
    expect(leads).toHaveLength(1);
    expect(leads[0]).toEqual(
      expect.objectContaining({
        name: "Ada Customer",
        email: "ada@example.com",
        company: "Northstar Labs",
        consentToContact: true,
        status: "new",
      })
    );

    const conversation = await Conversation.findOne({
      sessionKey: sessionId,
    }).lean();

    expect(String(conversation.contactId)).toBe(String(leads[0]._id));
    expect(conversation.status).toBe("handoff_requested");
  });

  it("updates the existing lead instead of creating duplicates", async () => {
    const sessionId = "lead-session-002";

    await request(app)
      .post("/api/tengaagent/chat/tengacion-demo/message")
      .send({
        message: "Please contact me.",
        sessionId,
      })
      .expect(200);

    await request(app)
      .post("/api/tengaagent/chat/tengacion-demo/lead")
      .send({
        sessionId,
        email: "first@example.com",
        consentToContact: true,
      })
      .expect(201);

    await request(app)
      .post("/api/tengaagent/chat/tengacion-demo/lead")
      .send({
        sessionId,
        email: "updated@example.com",
        phone: "+2348012345678",
        consentToContact: true,
      })
      .expect(201);

    const leads = await Lead.find({}).lean();
    expect(leads).toHaveLength(1);
    expect(leads[0].email).toBe("updated@example.com");
    expect(leads[0].phone).toBe("+2348012345678");
  });

  it("rejects missing consent, invalid email, and unknown sessions", async () => {
    const sessionId = "lead-session-003";

    await request(app)
      .post("/api/tengaagent/chat/tengacion-demo/message")
      .send({
        message: "I need a human.",
        sessionId,
      })
      .expect(200);

    await request(app)
      .post("/api/tengaagent/chat/tengacion-demo/lead")
      .send({
        sessionId,
        email: "visitor@example.com",
        consentToContact: false,
      })
      .expect(400);

    await request(app)
      .post("/api/tengaagent/chat/tengacion-demo/lead")
      .send({
        sessionId,
        email: "not-an-email",
        consentToContact: true,
      })
      .expect(400);

    await request(app)
      .post("/api/tengaagent/chat/tengacion-demo/lead")
      .send({
        sessionId: "does-not-exist",
        email: "visitor@example.com",
        consentToContact: true,
      })
      .expect(404);
  });
});
