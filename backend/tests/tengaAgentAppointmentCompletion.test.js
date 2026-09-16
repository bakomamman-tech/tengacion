const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-appointment-completion-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-appointment-completion-test-secret";

jest.mock(
  "../middleware/auth",
  () =>
    (req, res, next) => {
      const userId = req.headers["x-test-user-id"];

      if (!userId) {
        return res.status(401).json({ error: "No token" });
      }

      req.user = { id: userId, _id: userId };
      req.userId = userId;
      return next();
    }
);

require("../../apps/api/config/env");

const ownerRoutes = require("../routes/tengaAgentOwner");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const Organization = require("../models/tengaAgent/Organization");
const Agent = require("../models/tengaAgent/Agent");
const Conversation = require("../models/tengaAgent/Conversation");
const Appointment = require("../models/tengaAgent/Appointment");

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
  app.use("/api/tengaagent/owner", ownerRoutes);
  app.use(errorHandler);
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

const createConfirmedAppointment = async () => {
  const ownerUserId = new mongoose.Types.ObjectId();
  const organization = await Organization.create({
    name: "Completion Audit Business",
    slug: `completion-audit-${Date.now()}-${Math.random()}`,
    ownerUser: ownerUserId,
    plan: "starter",
    status: "pilot",
  });
  const agent = await Agent.create({
    organizationId: organization._id,
    key: "receptionist",
    name: "TengaAgent",
    status: "active",
  });
  const conversation = await Conversation.create({
    organizationId: organization._id,
    agentId: agent._id,
    sessionKey: `completion-session-${Date.now()}-${Math.random()}`,
  });
  const appointment = await Appointment.create({
    organizationId: organization._id,
    agentId: agent._id,
    conversationId: conversation._id,
    sessionKey: conversation.sessionKey,
    email: "visitor@example.com",
    preferredStartAt: new Date(Date.now() + 60 * 60 * 1000),
    timezone: "Africa/Lagos",
    consentToContact: true,
    status: "confirmed",
    confirmedAt: new Date(),
    availabilityState: "confirmed_free",
  });

  return { ownerUserId, appointment };
};

describe("TengaAgent appointment completion lifecycle", () => {
  it("records and exposes an idempotent owner completion audit", async () => {
    const { ownerUserId, appointment } =
      await createConfirmedAppointment();

    const first = await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${appointment._id}/status`
      )
      .set("x-test-user-id", String(ownerUserId))
      .send({ status: "completed" })
      .expect(200);

    expect(first.body.appointment).toEqual(
      expect.objectContaining({
        status: "completed",
        completedBy: "owner",
        completedAt: expect.any(String),
        cancelledAt: null,
        cancelledBy: null,
      })
    );

    const completedAt = first.body.appointment.completedAt;

    const persisted = await Appointment.findById(appointment._id).lean();
    expect(persisted.status).toBe("completed");
    expect(persisted.completedBy).toBe("owner");
    expect(persisted.completedAt).toBeInstanceOf(Date);

    const second = await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${appointment._id}/status`
      )
      .set("x-test-user-id", String(ownerUserId))
      .send({ status: "completed" })
      .expect(200);

    expect(second.body.appointment.completedAt).toBe(completedAt);
    expect(second.body.appointment.completedBy).toBe("owner");

    await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${appointment._id}/status`
      )
      .set("x-test-user-id", String(ownerUserId))
      .send({ status: "cancelled" })
      .expect(400);
  });
});
