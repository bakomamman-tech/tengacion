const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-follow-up-reminders-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-follow-up-reminders-test-secret";

require("../../apps/api/config/env");

const User = require("../models/User");
const Organization = require("../models/tengaAgent/Organization");
const Agent = require("../models/tengaAgent/Agent");
const Conversation = require("../models/tengaAgent/Conversation");
const Appointment = require("../models/tengaAgent/Appointment");
const FollowUpReminder = require("../models/tengaAgent/FollowUpReminder");
const {
  queueDueFollowUpReminders,
} = require("../services/tengaAgent/followUpReminderService");
const {
  updateOwnerAppointmentOutcome,
} = require("../services/tengaAgent/appointmentOutcomeService");

let mongod;

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
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

const createWorkspace = async () => {
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const owner = await User.create({
    name: "Follow Up Owner",
    username: `followup${nonce.replace(/[^a-z0-9]/gi, "").slice(-16)}`.toLowerCase(),
    email: `follow-up-${nonce}@example.com`,
    password: "secure-test-password",
    emailVerified: true,
  });
  const organization = await Organization.create({
    name: "Follow Up Business",
    slug: `follow-up-${nonce}`,
    ownerUser: owner._id,
    plan: "starter",
    status: "pilot",
    timezone: "Africa/Lagos",
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
    sessionKey: `follow-up-session-${nonce}`,
  });

  return { owner, organization, agent, conversation };
};

const createCompletedAppointment = async ({
  organization,
  agent,
  conversation,
  followUpAt,
  followUpNeeded = true,
}) =>
  Appointment.create({
    organizationId: organization._id,
    agentId: agent._id,
    conversationId: conversation._id,
    sessionKey: conversation.sessionKey,
    name: "Prospective Customer",
    email: "prospect@example.com",
    phone: "+2348000000000",
    purpose: "Review the proposal and agree next steps.",
    preferredStartAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    timezone: "Africa/Lagos",
    consentToContact: true,
    status: "completed",
    completedAt: new Date(Date.now() - 90 * 60 * 1000),
    completedBy: "owner",
    outcomeDisposition: "qualified",
    outcomeNotes: "Send pricing and implementation timeline.",
    outcomeUpdatedAt: new Date(Date.now() - 60 * 60 * 1000),
    followUpNeeded,
    followUpAt,
    followUpUpdatedAt: followUpNeeded
      ? new Date(Date.now() - 45 * 60 * 1000)
      : null,
  });

describe("TengaAgent follow-up reminder outbox", () => {
  it("queues only due follow-ups and deduplicates repeated sweeps", async () => {
    const { owner, organization, agent, conversation } = await createWorkspace();
    const now = new Date();

    const due = await createCompletedAppointment({
      organization,
      agent,
      conversation,
      followUpAt: new Date(now.getTime() - 5 * 60 * 1000),
    });

    const futureConversation = await Conversation.create({
      organizationId: organization._id,
      agentId: agent._id,
      sessionKey: `future-follow-up-${Date.now()}`,
    });
    await createCompletedAppointment({
      organization,
      agent,
      conversation: futureConversation,
      followUpAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    });

    const firstSweep = await queueDueFollowUpReminders({
      now,
      dispatch: false,
    });

    expect(firstSweep).toEqual(
      expect.objectContaining({
        appointments: 1,
        queued: 1,
        skipped: 0,
      })
    );

    const queued = await FollowUpReminder.findOne({
      appointmentId: due._id,
    }).lean();

    expect(queued).toEqual(
      expect.objectContaining({
        recipientEmail: owner.email,
        status: "pending",
      })
    );
    expect(queued.snapshot).toEqual(
      expect.objectContaining({
        businessName: "Follow Up Business",
        visitorName: "Prospective Customer",
        outcomeDisposition: "qualified",
      })
    );

    await queueDueFollowUpReminders({ now, dispatch: false });

    expect(
      await FollowUpReminder.countDocuments({ appointmentId: due._id })
    ).toBe(1);
  });

  it("supersedes an open reminder when the owner completes the follow-up", async () => {
    const { owner, organization, agent, conversation } = await createWorkspace();
    const now = new Date();
    const appointment = await createCompletedAppointment({
      organization,
      agent,
      conversation,
      followUpAt: new Date(now.getTime() - 10 * 60 * 1000),
    });

    await queueDueFollowUpReminders({ now, dispatch: false });

    const result = await updateOwnerAppointmentOutcome({
      userId: owner._id,
      appointmentId: appointment._id,
      disposition: "qualified",
      notes: "Follow-up completed by phone.",
      followUpNeeded: false,
      followUpAt: null,
    });

    expect(result.outcome).toEqual(
      expect.objectContaining({
        followUpNeeded: false,
        followUpAt: null,
      })
    );

    const reminder = await FollowUpReminder.findOne({
      appointmentId: appointment._id,
    }).lean();

    expect(reminder.status).toBe("superseded");
    expect(reminder.lastError).toMatch(/schedule changed/i);
  });
});
