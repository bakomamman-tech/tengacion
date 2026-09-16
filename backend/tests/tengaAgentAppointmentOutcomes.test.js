const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-appointment-outcomes-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-appointment-outcomes-test-secret";

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

const createWorkspace = async () => {
  const ownerUserId = new mongoose.Types.ObjectId();
  const organization = await Organization.create({
    name: "Outcome Intelligence Business",
    slug: `outcomes-${Date.now()}-${Math.random()}`,
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

  return { ownerUserId, organization, agent };
};

const createAppointment = async ({
  organization,
  agent,
  status,
  name,
  email,
}) => {
  const conversation = await Conversation.create({
    organizationId: organization._id,
    agentId: agent._id,
    sessionKey: `outcome-session-${Date.now()}-${Math.random()}`,
  });

  return Appointment.create({
    organizationId: organization._id,
    agentId: agent._id,
    conversationId: conversation._id,
    sessionKey: conversation.sessionKey,
    name,
    email,
    preferredStartAt: new Date(Date.now() - 60 * 60 * 1000),
    timezone: "Africa/Lagos",
    consentToContact: true,
    status,
    ...(status === "completed"
      ? { completedAt: new Date(), completedBy: "owner" }
      : {}),
    ...(status === "no_show"
      ? { noShowAt: new Date(), noShowBy: "owner" }
      : {}),
  });
};

describe("TengaAgent post-appointment outcomes", () => {
  it("records owner disposition, follow-up state and exposes outcome metrics", async () => {
    const { ownerUserId, organization, agent } = await createWorkspace();
    const completed = await createAppointment({
      organization,
      agent,
      status: "completed",
      name: "Converted Customer",
      email: "converted@example.com",
    });
    await createAppointment({
      organization,
      agent,
      status: "no_show",
      name: "Missed Visitor",
      email: "missed@example.com",
    });

    const followUpAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const updated = await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${completed._id}/outcome`
      )
      .set("x-test-user-id", String(ownerUserId))
      .send({
        disposition: "converted",
        notes: "Customer accepted the proposed package.",
        followUpNeeded: true,
        followUpAt,
      })
      .expect(200);

    expect(updated.body.outcome).toEqual(
      expect.objectContaining({
        appointmentId: String(completed._id),
        outcomeDisposition: "converted",
        outcomeNotes: "Customer accepted the proposed package.",
        followUpNeeded: true,
        followUpOverdue: true,
      })
    );

    const list = await request(app)
      .get("/api/tengaagent/owner/appointment-outcomes?limit=100")
      .set("x-test-user-id", String(ownerUserId))
      .expect(200);

    expect(list.body.outcomes).toHaveLength(2);
    expect(list.body.metrics).toEqual(
      expect.objectContaining({
        terminalAppointments: 2,
        completed: 1,
        noShow: 1,
        reviewedOutcomes: 1,
        converted: 1,
        followUpNeeded: 1,
        followUpOverdue: 1,
      })
    );

    const cleared = await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${completed._id}/outcome`
      )
      .set("x-test-user-id", String(ownerUserId))
      .send({
        disposition: "converted",
        notes: "Follow-up completed.",
        followUpNeeded: false,
      })
      .expect(200);

    expect(cleared.body.outcome.followUpNeeded).toBe(false);
    expect(cleared.body.outcome.followUpAt).toBeNull();
    expect(cleared.body.outcome.followUpCompletedAt).toEqual(expect.any(String));
  });

  it("rejects outcomes for active appointments and keeps tenant scope enforced", async () => {
    const { ownerUserId, organization, agent } = await createWorkspace();
    const active = await createAppointment({
      organization,
      agent,
      status: "confirmed",
      name: "Active Visitor",
      email: "active@example.com",
    });

    await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${active._id}/outcome`
      )
      .set("x-test-user-id", String(ownerUserId))
      .send({
        disposition: "qualified",
        followUpNeeded: false,
      })
      .expect(400);

    await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${active._id}/outcome`
      )
      .set("x-test-user-id", String(new mongoose.Types.ObjectId()))
      .send({
        disposition: "qualified",
        followUpNeeded: false,
      })
      .expect(404);
  });
});
