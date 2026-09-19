const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-follow-up-activity-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-follow-up-activity-test-secret";

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

jest.mock("../utils/sendBrandedEmail", () => ({
  sendBrandedEmail: jest.fn(),
}));

require("../../apps/api/config/env");

const { sendBrandedEmail } = require("../utils/sendBrandedEmail");
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
  jest.clearAllMocks();
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
    slug: `activity-${label.toLowerCase()}-${Date.now()}-${Math.random()}`,
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
  email,
  phone = "+2348000000000",
  consentToContact = true,
}) => {
  const conversation = await Conversation.create({
    organizationId: organization._id,
    agentId: agent._id,
    sessionKey: `activity-session-${Date.now()}-${Math.random()}`,
  });

  return Appointment.create({
    organizationId: organization._id,
    agentId: agent._id,
    conversationId: conversation._id,
    sessionKey: conversation.sessionKey,
    name,
    email:
      email === undefined
        ? `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`
        : email,
    phone,
    purpose: `Follow up with ${name}`,
    preferredStartAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    timezone: "Africa/Lagos",
    consentToContact,
    status: "completed",
    completedAt: new Date(),
    completedBy: "owner",
    outcomeDisposition: "qualified",
    followUpNeeded: true,
    followUpAt: new Date(Date.now() - 10 * 60 * 1000),
    followUpUpdatedAt: new Date(),
  });
};

describe("TengaAgent follow-up contact activity ledger", () => {
  it("logs manual contact activity and enforces tenant isolation", async () => {
    const ownerOne = await createWorkspace("OwnerOneActivity");
    const ownerTwo = await createWorkspace("OwnerTwoActivity");
    const appointment = await createFollowUpAppointment({
      ...ownerOne,
      name: "Activity Visitor",
    });
    const protectedAppointment = await createFollowUpAppointment({
      ...ownerTwo,
      name: "Other Tenant Visitor",
    });

    const logged = await request(app)
      .post(`/api/tengaagent/owner/follow-ups/${appointment._id}/log-contact`)
      .set("x-test-user-id", String(ownerOne.ownerUserId))
      .send({
        channel: "phone",
        direction: "outbound",
        notes: "Called the customer and left a voicemail.",
      })
      .expect(201);

    expect(logged.body.activity).toEqual(
      expect.objectContaining({
        appointmentId: String(appointment._id),
        channel: "phone",
        direction: "outbound",
        status: "logged",
        notes: "Called the customer and left a voicemail.",
      })
    );

    await request(app)
      .post(
        `/api/tengaagent/owner/follow-ups/${protectedAppointment._id}/log-contact`
      )
      .set("x-test-user-id", String(ownerOne.ownerUserId))
      .send({
        channel: "manual",
        direction: "outbound",
        notes: "This must not cross tenants.",
      })
      .expect(404);

    const listed = await request(app)
      .get(`/api/tengaagent/owner/follow-ups/${appointment._id}/activity`)
      .set("x-test-user-id", String(ownerOne.ownerUserId))
      .expect(200);

    expect(listed.body.activities).toHaveLength(1);
    expect(listed.body.activities[0].notes).toBe(
      "Called the customer and left a voicemail."
    );
    expect(await FollowUpActivity.countDocuments()).toBe(1);
  });

  it("sends consent-gated email and preserves its ledger after follow-up completion", async () => {
    const owner = await createWorkspace("EmailSuccess");
    const appointment = await createFollowUpAppointment({
      ...owner,
      name: "Email Visitor",
    });
    sendBrandedEmail.mockResolvedValue(undefined);

    const sent = await request(app)
      .post(`/api/tengaagent/owner/follow-ups/${appointment._id}/send-email`)
      .set("x-test-user-id", String(owner.ownerUserId))
      .send({
        subject: "Proposal follow-up",
        message: "Thank you for the meeting. Here are the agreed next steps.",
      })
      .expect(201);

    expect(sent.body.activity).toEqual(
      expect.objectContaining({
        channel: "email",
        direction: "outbound",
        status: "sent",
        recipient: appointment.email,
        subject: "Proposal follow-up",
      })
    );
    expect(sendBrandedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: appointment.email,
        subject: "Proposal follow-up",
        previewText: "Proposal follow-up",
      })
    );

    await request(app)
      .patch(`/api/tengaagent/owner/follow-ups/${appointment._id}/complete`)
      .set("x-test-user-id", String(owner.ownerUserId))
      .expect(200);

    const history = await request(app)
      .get(`/api/tengaagent/owner/follow-ups/${appointment._id}/activity`)
      .set("x-test-user-id", String(owner.ownerUserId))
      .expect(200);

    expect(history.body.activities).toHaveLength(1);
    expect(history.body.activities[0].status).toBe("sent");
  });

  it("records failed email delivery instead of losing the attempt", async () => {
    const owner = await createWorkspace("EmailFailure");
    const appointment = await createFollowUpAppointment({
      ...owner,
      name: "Failure Visitor",
    });
    sendBrandedEmail.mockRejectedValue(new Error("SMTP temporarily unavailable"));

    const response = await request(app)
      .post(`/api/tengaagent/owner/follow-ups/${appointment._id}/send-email`)
      .set("x-test-user-id", String(owner.ownerUserId))
      .send({
        subject: "Checking in",
        message: "I wanted to follow up on our conversation.",
      })
      .expect(502);

    expect(response.body.activity).toEqual(
      expect.objectContaining({
        channel: "email",
        status: "failed",
        lastError: "SMTP temporarily unavailable",
      })
    );

    const saved = await FollowUpActivity.findOne({
      appointmentId: appointment._id,
    }).lean();
    expect(saved.status).toBe("failed");
    expect(saved.lastError).toBe("SMTP temporarily unavailable");
  });

  it("rejects outbound email without stored consent and creates no activity", async () => {
    const owner = await createWorkspace("NoConsent");
    const appointment = await createFollowUpAppointment({
      ...owner,
      name: "No Consent Visitor",
      consentToContact: false,
    });

    await request(app)
      .post(`/api/tengaagent/owner/follow-ups/${appointment._id}/send-email`)
      .set("x-test-user-id", String(owner.ownerUserId))
      .send({
        subject: "Should not send",
        message: "This message must be blocked.",
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toMatch(/consent/i);
      });

    expect(sendBrandedEmail).not.toHaveBeenCalled();
    expect(await FollowUpActivity.countDocuments()).toBe(0);
  });
});
