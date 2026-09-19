const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-billing-route-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-billing-route-test-secret-not-for-production";

require("../../apps/api/config/env");

const routes = require("../routes/tengaAgentPublic");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const Agent = require("../models/tengaAgent/Agent");
const Conversation = require("../models/tengaAgent/Conversation");
const Organization = require("../models/tengaAgent/Organization");
const Subscription = require("../models/tengaAgent/Subscription");
const Usage = require("../models/tengaAgent/Usage");

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });

  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });

  app = express();
  app.use(express.json());
  app.use("/api/tengaagent/public", routes);
  app.use(errorHandler);
});

beforeEach(async () => {
  await Promise.all([
    Agent.deleteMany({}),
    Conversation.deleteMany({}),
    Organization.deleteMany({}),
    Subscription.deleteMany({}),
    Usage.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe("TengaAgent billing enforcement on public chat", () => {
  it("returns payment-required before creating a conversation at the monthly cap", async () => {
    const organization = await Organization.create({
      name: "Starter Cap Limited",
      slug: "starter-cap",
      plan: "starter",
      status: "active",
    });

    await Agent.create({
      organizationId: organization._id,
      key: "receptionist",
      name: "TengaAgent",
      status: "active",
    });

    await Subscription.create({
      organizationId: organization._id,
      planCode: "starter",
      status: "active",
      billingProvider: "manual",
    });

    await Usage.create({
      organizationId: organization._id,
      periodKey: new Date().toISOString().slice(0, 7),
      conversationsStarted: 300,
    });

    const response = await request(app)
      .post(
        "/api/tengaagent/public/starter-cap/receptionist/message"
      )
      .send({
        sessionId: "new-session-over-cap",
        message: "Hello",
      })
      .expect(402);

    expect(response.body).toEqual(
      expect.objectContaining({
        message:
          "The monthly TengaAgent conversation allowance has been reached.",
      })
    );
    expect(await Conversation.countDocuments()).toBe(0);
  });

  it("does not charge an additional conversation for an existing session", async () => {
    const organization = await Organization.create({
      name: "Starter Existing Limited",
      slug: "starter-existing",
      plan: "starter",
      status: "active",
    });

    const agent = await Agent.create({
      organizationId: organization._id,
      key: "receptionist",
      name: "TengaAgent",
      status: "active",
    });

    await Subscription.create({
      organizationId: organization._id,
      planCode: "starter",
      status: "active",
      billingProvider: "manual",
    });

    await Usage.create({
      organizationId: organization._id,
      periodKey: new Date().toISOString().slice(0, 7),
      conversationsStarted: 300,
    });

    await Conversation.create({
      organizationId: organization._id,
      agentId: agent._id,
      sessionKey: "existing-session",
      channel: "web",
      status: "human_active",
    });

    await request(app)
      .post(
        "/api/tengaagent/public/starter-existing/receptionist/message"
      )
      .send({
        sessionId: "existing-session",
        message: "One more message in the same conversation",
      })
      .expect(200);

    const usage = await Usage.findOne({
      organizationId: organization._id,
    }).lean();
    expect(usage.conversationsStarted).toBe(300);
  });
});
