const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "test-placeholder";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-follow-up-intelligence-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-follow-up-intelligence-test-secret";

jest.mock(
  "../middleware/auth",
  () =>
    (req, res, next) => {
      const userId = req.headers["x-test-user-id"];
      if (!userId) return res.status(401).json({ error: "No token" });
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
const FollowUpActivity = require("../models/tengaAgent/FollowUpActivity");

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
    slug: `nba-${label.toLowerCase()}-${Date.now()}-${Math.random()}`,
    industry: "Software",
    website: "https://example.com",
    ownerUser: ownerUserId,
    plan: "starter",
    status: "pilot",
  });
  const agent = await Agent.create({
    organizationId: organization._id,
    key: "receptionist",
    name: "TengaAgent",
    tone: "friendly-professional",
    status: "active",
  });
  const conversation = await Conversation.create({
    organizationId: organization._id,
    agentId: agent._id,
    sessionKey: `nba-session-${Date.now()}-${Math.random()}`,
  });
  return { ownerUserId, organization, agent, conversation };
};

const createFollowUp = async ({
  organization,
  agent,
  conversation,
  status = "completed",
  disposition = "qualified",
  email = "customer@example.com",
  phone = "+2348012345678",
  consentToContact = true,
  followUpAt = new Date(Date.now() - 60 * 60 * 1000),
}) =>
  Appointment.create({
    organizationId: organization._id,
    agentId: agent._id,
    conversationId: conversation._id,
    sessionKey: conversation.sessionKey,
    name: "Ada Customer",
    email,
    phone,
    purpose: "Review implementation proposal",
    preferredStartAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    timezone: "Africa/Lagos",
    consentToContact,
    status,
    ...(status === "completed"
      ? { completedAt: new Date(), completedBy: "owner" }
      : { noShowAt: new Date(), noShowBy: "owner" }),
    outcomeDisposition: disposition,
    outcomeNotes: "Owner recorded the meeting outcome.",
    followUpNeeded: true,
    followUpAt,
    followUpUpdatedAt: new Date(),
  });

const addActivity = async ({
  workspace,
  appointment,
  channel = "email",
  direction = "outbound",
  status = "sent",
  occurredAt = new Date(),
}) =>
  FollowUpActivity.create({
    organizationId: workspace.organization._id,
    agentId: workspace.agent._id,
    appointmentId: appointment._id,
    ownerUserId: workspace.ownerUserId,
    channel,
    direction,
    status,
    provider: channel === "email" ? "smtp" : "manual",
    occurredAt,
    ...(status === "sent" ? { sentAt: occurredAt } : {}),
    ...(status === "failed" ? { attemptedAt: occurredAt, lastError: "Mailbox unavailable" } : {}),
  });

const getRecommendation = ({ ownerUserId, appointmentId }) =>
  request(app)
    .get(`/api/tengaagent/owner/follow-ups/${appointmentId}/recommendation`)
    .set("x-test-user-id", String(ownerUserId));

describe("TengaAgent follow-up next-best-action intelligence", () => {
  it("recommends closing when the customer is recorded as not interested", async () => {
    const workspace = await createWorkspace("NotInterested");
    const appointment = await createFollowUp({
      ...workspace,
      disposition: "not_interested",
    });

    const response = await getRecommendation({
      ownerUserId: workspace.ownerUserId,
      appointmentId: appointment._id,
    }).expect(200);

    expect(response.body.recommendation).toEqual(
      expect.objectContaining({
        action: "close",
        advisoryOnly: true,
        strength: "strong",
        reasonCodes: expect.arrayContaining(["OUTCOME_NOT_INTERESTED"]),
      })
    );
  });

  it("recommends rescheduling when the recorded outcome requests it", async () => {
    const workspace = await createWorkspace("Reschedule");
    const appointment = await createFollowUp({
      ...workspace,
      disposition: "reschedule_requested",
    });

    const response = await getRecommendation({
      ownerUserId: workspace.ownerUserId,
      appointmentId: appointment._id,
    }).expect(200);

    expect(response.body.recommendation.action).toBe("reschedule");
    expect(response.body.recommendation.reasonCodes).toContain(
      "OUTCOME_RESCHEDULE_REQUESTED"
    );
  });

  it("recommends waiting after a recent successful outbound contact", async () => {
    const workspace = await createWorkspace("RecentContact");
    const appointment = await createFollowUp(workspace);
    await addActivity({
      workspace,
      appointment,
      occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    const response = await getRecommendation({
      ownerUserId: workspace.ownerUserId,
      appointmentId: appointment._id,
    }).expect(200);

    expect(response.body.recommendation.action).toBe("wait");
    expect(response.body.recommendation.waitUntil).toBeTruthy();
    expect(response.body.recommendation.reasonCodes).toContain(
      "RECENT_SUCCESSFUL_OUTBOUND"
    );
  });

  it("switches to a phone call when the latest email delivery failed", async () => {
    const workspace = await createWorkspace("DeliveryFailure");
    const appointment = await createFollowUp(workspace);
    await addActivity({
      workspace,
      appointment,
      status: "failed",
      occurredAt: new Date(Date.now() - 10 * 60 * 1000),
    });

    const response = await getRecommendation({
      ownerUserId: workspace.ownerUserId,
      appointmentId: appointment._id,
    }).expect(200);

    expect(response.body.recommendation.action).toBe("call");
    expect(response.body.recommendation.reasonCodes).toEqual(
      expect.arrayContaining(["LATEST_EMAIL_FAILED", "PHONE_AVAILABLE"])
    );
  });

  it("recommends an owner-reviewed email for a due qualified opportunity", async () => {
    const workspace = await createWorkspace("Qualified");
    const appointment = await createFollowUp(workspace);

    const response = await getRecommendation({
      ownerUserId: workspace.ownerUserId,
      appointmentId: appointment._id,
    }).expect(200);

    expect(response.body.recommendation.action).toBe("email");
    expect(response.body.recommendation.signals.canEmail).toBe(true);
    expect(response.body.recommendation.reasonCodes).toEqual(
      expect.arrayContaining(["OUTCOME_QUALIFIED", "FOLLOW_UP_DUE"])
    );
  });

  it("recommends waiting when a follow-up is not due yet", async () => {
    const workspace = await createWorkspace("Upcoming");
    const appointment = await createFollowUp({
      ...workspace,
      followUpAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    });

    const response = await getRecommendation({
      ownerUserId: workspace.ownerUserId,
      appointmentId: appointment._id,
    }).expect(200);

    expect(response.body.recommendation.action).toBe("wait");
    expect(response.body.recommendation.reasonCodes).toContain("FOLLOW_UP_NOT_DUE");
  });

  it("keeps recommendations tenant-isolated and read-only", async () => {
    const ownerOne = await createWorkspace("OwnerOne");
    const ownerTwo = await createWorkspace("OwnerTwo");
    const appointment = await createFollowUp(ownerTwo);
    const originalUpdatedAt = appointment.updatedAt;

    await getRecommendation({
      ownerUserId: ownerOne.ownerUserId,
      appointmentId: appointment._id,
    }).expect(404);

    await getRecommendation({
      ownerUserId: ownerTwo.ownerUserId,
      appointmentId: appointment._id,
    }).expect(200);

    const unchanged = await Appointment.findById(appointment._id).lean();
    expect(unchanged.followUpNeeded).toBe(true);
    expect(unchanged.updatedAt.getTime()).toBe(originalUpdatedAt.getTime());
    expect(await FollowUpActivity.countDocuments()).toBe(0);
  });

  it("includes advisory recommendations in the owner follow-up queue", async () => {
    const workspace = await createWorkspace("Queue");
    await createFollowUp(workspace);

    const response = await request(app)
      .get("/api/tengaagent/owner/follow-ups?filter=all")
      .set("x-test-user-id", String(workspace.ownerUserId))
      .expect(200);

    expect(response.body.followUps).toHaveLength(1);
    expect(response.body.followUps[0].recommendation).toEqual(
      expect.objectContaining({
        action: "email",
        advisoryOnly: true,
      })
    );
  });
});
