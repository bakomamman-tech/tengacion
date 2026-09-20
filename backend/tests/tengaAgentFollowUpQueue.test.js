const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-follow-up-queue-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-follow-up-queue-test-secret";

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
const FollowUpReminder = require("../models/tengaAgent/FollowUpReminder");

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

const createWorkspace = async (label) => {
  const ownerUserId = new mongoose.Types.ObjectId();
  const organization = await Organization.create({
    name: `${label} Business`,
    slug: `follow-up-${label.toLowerCase()}-${Date.now()}-${Math.random()}`,
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

const createFollowUpAppointment = async ({
  organization,
  agent,
  name,
  followUpAt,
  status = "completed",
}) => {
  const conversation = await Conversation.create({
    organizationId: organization._id,
    agentId: agent._id,
    sessionKey: `follow-up-session-${Date.now()}-${Math.random()}`,
  });

  return Appointment.create({
    organizationId: organization._id,
    agentId: agent._id,
    conversationId: conversation._id,
    sessionKey: conversation.sessionKey,
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    purpose: `Follow up with ${name}`,
    preferredStartAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    timezone: "Africa/Lagos",
    consentToContact: true,
    status,
    outcomeDisposition: "qualified",
    followUpNeeded: true,
    followUpAt,
    followUpUpdatedAt: new Date(),
    ...(status === "completed"
      ? { completedAt: new Date(), completedBy: "owner" }
      : { noShowAt: new Date(), noShowBy: "owner" }),
  });
};

describe("TengaAgent owner follow-up queue", () => {
  it("lists only the authenticated tenant queue with reminder delivery metadata", async () => {
    const ownerOne = await createWorkspace("OwnerOne");
    const ownerTwo = await createWorkspace("OwnerTwo");
    const overdue = await createFollowUpAppointment({
      ...ownerOne,
      name: "Overdue Visitor",
      followUpAt: new Date(Date.now() - 30 * 60 * 1000),
    });
    await createFollowUpAppointment({
      ...ownerOne,
      name: "Upcoming Visitor",
      followUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await createFollowUpAppointment({
      ...ownerTwo,
      name: "Other Tenant Visitor",
      followUpAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    await FollowUpReminder.create({
      organizationId: ownerOne.organization._id,
      agentId: ownerOne.agent._id,
      appointmentId: overdue._id,
      recipientEmail: "owner@example.com",
      dedupeKey: `${overdue._id}:queue-test`,
      status: "pending",
      scheduledFor: new Date(),
    });

    const all = await request(app)
      .get("/api/tengaagent/owner/follow-ups?filter=all&limit=100")
      .set("x-test-user-id", String(ownerOne.ownerUserId))
      .expect(200);

    expect(all.body.followUps).toHaveLength(2);
    expect(all.body.metrics).toEqual({
      open: 2,
      overdue: 1,
      upcoming: 1,
      dueNext7Days: 1,
    });
    expect(all.body.followUps[0]).toEqual(
      expect.objectContaining({
        appointmentId: String(overdue._id),
        name: "Overdue Visitor",
        overdue: true,
        dueState: "overdue",
        reminder: expect.objectContaining({ status: "pending" }),
      })
    );
    expect(
      all.body.followUps.some((item) => item.name === "Other Tenant Visitor")
    ).toBe(false);

    const overdueOnly = await request(app)
      .get("/api/tengaagent/owner/follow-ups?filter=overdue")
      .set("x-test-user-id", String(ownerOne.ownerUserId))
      .expect(200);

    expect(overdueOnly.body.followUps).toHaveLength(1);
    expect(overdueOnly.body.followUps[0].name).toBe("Overdue Visitor");
  });

  it("reschedules and completes follow-ups while preventing cross-tenant mutation", async () => {
    const ownerOne = await createWorkspace("OwnerOneActions");
    const ownerTwo = await createWorkspace("OwnerTwoActions");
    const appointment = await createFollowUpAppointment({
      ...ownerOne,
      name: "Action Visitor",
      followUpAt: new Date(Date.now() - 20 * 60 * 1000),
    });
    const otherTenantAppointment = await createFollowUpAppointment({
      ...ownerTwo,
      name: "Protected Visitor",
      followUpAt: new Date(Date.now() - 10 * 60 * 1000),
    });

    const reminder = await FollowUpReminder.create({
      organizationId: ownerOne.organization._id,
      agentId: ownerOne.agent._id,
      appointmentId: appointment._id,
      recipientEmail: "owner-actions@example.com",
      dedupeKey: `${appointment._id}:action-test`,
      status: "pending",
      scheduledFor: new Date(),
    });

    await request(app)
      .patch(
        `/api/tengaagent/owner/follow-ups/${otherTenantAppointment._id}/complete`
      )
      .set("x-test-user-id", String(ownerOne.ownerUserId))
      .expect(404);

    const protectedAppointment = await Appointment.findById(
      otherTenantAppointment._id
    ).lean();
    expect(protectedAppointment.followUpNeeded).toBe(true);

    const rescheduledFor = new Date(
      Date.now() + 2 * 24 * 60 * 60 * 1000
    ).toISOString();
    const rescheduled = await request(app)
      .patch(`/api/tengaagent/owner/follow-ups/${appointment._id}/reschedule`)
      .set("x-test-user-id", String(ownerOne.ownerUserId))
      .send({ followUpAt: rescheduledFor })
      .expect(200);

    expect(rescheduled.body.followUp).toEqual(
      expect.objectContaining({
        appointmentId: String(appointment._id),
        overdue: false,
        dueState: "upcoming",
        reminder: expect.objectContaining({ status: "superseded" }),
      })
    );

    const staleReminder = await FollowUpReminder.findById(reminder._id).lean();
    expect(staleReminder.status).toBe("superseded");

    const completed = await request(app)
      .patch(`/api/tengaagent/owner/follow-ups/${appointment._id}/complete`)
      .set("x-test-user-id", String(ownerOne.ownerUserId))
      .expect(200);

    expect(completed.body.followUp.followUpAt).toBeNull();
    expect(completed.body.followUp.followUpCompletedAt).toEqual(
      expect.any(String)
    );

    const saved = await Appointment.findById(appointment._id).lean();
    expect(saved.followUpNeeded).toBe(false);
    expect(saved.followUpAt).toBeNull();
    expect(saved.followUpCompletedAt).toEqual(expect.any(Date));

    await request(app)
      .get("/api/tengaagent/owner/follow-ups?filter=all")
      .set("x-test-user-id", String(ownerOne.ownerUserId))
      .expect(200)
      .expect((response) => {
        expect(response.body.followUps).toHaveLength(0);
        expect(response.body.metrics.open).toBe(0);
      });
  });

  it("rejects invalid queue filters and non-future reschedules", async () => {
    const owner = await createWorkspace("Validation");
    const appointment = await createFollowUpAppointment({
      ...owner,
      name: "Validation Visitor",
      followUpAt: new Date(Date.now() - 5 * 60 * 1000),
    });

    await request(app)
      .get("/api/tengaagent/owner/follow-ups?filter=unknown")
      .set("x-test-user-id", String(owner.ownerUserId))
      .expect(400);

    await request(app)
      .patch(`/api/tengaagent/owner/follow-ups/${appointment._id}/reschedule`)
      .set("x-test-user-id", String(owner.ownerUserId))
      .send({ followUpAt: new Date(Date.now() - 60 * 1000).toISOString() })
      .expect(400);
  });
});
