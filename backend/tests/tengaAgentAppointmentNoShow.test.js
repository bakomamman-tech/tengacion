const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-appointment-no-show-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-appointment-no-show-test-secret";

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
const AppointmentNotification = require("../models/tengaAgent/AppointmentNotification");
const {
  queueAppointmentEventNotifications,
} = require("../services/tengaAgent/appointmentNotificationService");

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
    name: "No Show Audit Business",
    slug: `no-show-audit-${Date.now()}-${Math.random()}`,
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
    sessionKey: `no-show-session-${Date.now()}-${Math.random()}`,
  });
  const appointment = await Appointment.create({
    organizationId: organization._id,
    agentId: agent._id,
    conversationId: conversation._id,
    sessionKey: conversation.sessionKey,
    name: "No Show Visitor",
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

describe("TengaAgent appointment no-show lifecycle", () => {
  it("records an idempotent no-show audit, supersedes reminders, and closes the appointment", async () => {
    const { ownerUserId, appointment } =
      await createConfirmedAppointment();

    await queueAppointmentEventNotifications({
      appointment,
      eventType: "reminder_24h",
      actor: "system",
      dispatch: false,
    });

    const first = await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${appointment._id}/status`
      )
      .set("x-test-user-id", String(ownerUserId))
      .send({ status: "no_show" })
      .expect(200);

    expect(first.body.appointment.status).toBe("no_show");

    const persisted = await Appointment.findById(appointment._id).lean();
    expect(persisted.status).toBe("no_show");
    expect(persisted.noShowAt).toBeInstanceOf(Date);
    expect(persisted.noShowBy).toBe("owner");

    const firstNoShowAt = persisted.noShowAt.getTime();
    const noShowRecords = await AppointmentNotification.find({
      appointmentId: appointment._id,
      eventType: "no_show",
    }).lean();
    const reminders = await AppointmentNotification.find({
      appointmentId: appointment._id,
      eventType: "reminder_24h",
    }).lean();

    expect(noShowRecords).toHaveLength(1);
    expect(noShowRecords[0]).toEqual(
      expect.objectContaining({
        recipientKind: "visitor",
        actor: "owner",
      })
    );
    expect(noShowRecords[0].snapshot.appointmentStatus).toBe("no_show");
    expect(reminders).toHaveLength(1);
    expect(reminders[0].status).toBe("superseded");

    await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${appointment._id}/status`
      )
      .set("x-test-user-id", String(ownerUserId))
      .send({ status: "no_show" })
      .expect(200);

    const afterRetry = await Appointment.findById(appointment._id).lean();
    expect(afterRetry.noShowAt.getTime()).toBe(firstNoShowAt);
    expect(
      await AppointmentNotification.countDocuments({
        appointmentId: appointment._id,
        eventType: "no_show",
      })
    ).toBe(1);

    await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${appointment._id}/status`
      )
      .set("x-test-user-id", String(ownerUserId))
      .send({ status: "completed" })
      .expect(400);
  });
});
