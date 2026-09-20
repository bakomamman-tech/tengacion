const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-appointment-notification-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "tengaagent-notification-test-secret";

require("../../apps/api/config/env");

const Appointment = require("../models/tengaAgent/Appointment");
const AppointmentNotification = require(
  "../models/tengaAgent/AppointmentNotification"
);
const Organization = require("../models/tengaAgent/Organization");
const Agent = require("../models/tengaAgent/Agent");
const User = require("../models/User");
const {
  queueAppointmentEventNotifications,
  queueDueAppointmentReminders,
  stopAppointmentNotificationScheduler,
} = require(
  "../services/tengaAgent/appointmentNotificationService"
);

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
  stopAppointmentNotificationScheduler();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

const createContext = async ({ startAt, status = "requested" } = {}) => {
  const ownerUserId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id: ownerUserId,
    name: "Notification Owner",
    email: "owner@example.com",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const organization = await Organization.create({
    name: "Notification Business",
    slug: `notification-business-${Date.now()}-${Math.random()}`,
    ownerUser: ownerUserId,
    timezone: "Africa/Lagos",
    plan: "starter",
    status: "pilot",
  });
  const agent = await Agent.create({
    organizationId: organization._id,
    key: "receptionist",
    name: "TengaAgent",
    status: "active",
  });
  const appointment = await Appointment.create({
    organizationId: organization._id,
    agentId: agent._id,
    conversationId: new mongoose.Types.ObjectId(),
    sessionKey: `notification-session-${Date.now()}-${Math.random()}`,
    name: "Notification Visitor",
    email: "visitor@example.com",
    purpose: "Discuss a service",
    preferredStartAt:
      startAt || new Date(Date.now() + 48 * 60 * 60 * 1000),
    timezone: "Africa/Lagos",
    durationMinutes: 30,
    status,
    consentToContact: true,
    ...(status === "confirmed"
      ? {
          confirmedAt: new Date(),
          availabilityState: "confirmed_free",
        }
      : {}),
  });

  return { ownerUserId, organization, agent, appointment };
};

describe("TengaAgent appointment notification outbox", () => {
  it("queues tenant-scoped requested notifications idempotently for owner and visitor", async () => {
    const { appointment, organization } = await createContext();

    const first = await queueAppointmentEventNotifications({
      appointment,
      eventType: "requested",
      actor: "visitor",
      dispatch: false,
    });
    const second = await queueAppointmentEventNotifications({
      appointment,
      eventType: "requested",
      actor: "visitor",
      dispatch: false,
    });

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);

    const records = await AppointmentNotification.find({
      appointmentId: appointment._id,
      eventType: "requested",
    }).lean();

    expect(records).toHaveLength(2);
    expect(records.map((entry) => entry.recipientKind).sort()).toEqual([
      "owner",
      "visitor",
    ]);
    expect(
      records.every(
        (entry) =>
          String(entry.organizationId) === String(organization._id) &&
          entry.status === "pending"
      )
    ).toBe(true);
    expect(new Set(records.map((entry) => entry.dedupeKey)).size).toBe(2);
  });

  it("queues confirmation and reschedule events while superseding stale reminders", async () => {
    const { appointment } = await createContext({ status: "confirmed" });

    await queueAppointmentEventNotifications({
      appointment,
      eventType: "confirmed",
      actor: "owner",
      dispatch: false,
    });
    await queueAppointmentEventNotifications({
      appointment,
      eventType: "reminder_24h",
      actor: "system",
      dispatch: false,
    });

    appointment.preferredStartAt = new Date(
      appointment.preferredStartAt.getTime() + 60 * 60 * 1000
    );
    appointment.rescheduledAt = new Date();
    appointment.rescheduleCount = 1;
    await appointment.save();

    await queueAppointmentEventNotifications({
      appointment,
      eventType: "rescheduled",
      actor: "owner",
      dispatch: false,
    });

    const confirmed = await AppointmentNotification.find({
      appointmentId: appointment._id,
      eventType: "confirmed",
    }).lean();
    const rescheduled = await AppointmentNotification.find({
      appointmentId: appointment._id,
      eventType: "rescheduled",
    }).lean();
    const reminders = await AppointmentNotification.find({
      appointmentId: appointment._id,
      eventType: "reminder_24h",
    }).lean();

    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].recipientKind).toBe("visitor");
    expect(rescheduled).toHaveLength(2);
    expect(rescheduled.map((entry) => entry.recipientKind).sort()).toEqual([
      "owner",
      "visitor",
    ]);
    expect(reminders).toHaveLength(2);
    expect(reminders.every((entry) => entry.status === "superseded")).toBe(
      true
    );
  });

  it("queues one 24-hour reminder event per recipient for confirmed upcoming appointments", async () => {
    const startAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const { appointment } = await createContext({
      startAt,
      status: "confirmed",
    });

    const result = await queueDueAppointmentReminders({
      now: new Date(),
      dispatch: false,
    });

    expect(result.appointments).toBe(1);
    expect(result.queued).toBe(2);

    const reminders = await AppointmentNotification.find({
      appointmentId: appointment._id,
      eventType: "reminder_24h",
    }).lean();

    expect(reminders).toHaveLength(2);
    expect(reminders.map((entry) => entry.recipientKind).sort()).toEqual([
      "owner",
      "visitor",
    ]);
  });

  it("queues cancellation notices for both sides", async () => {
    const { appointment } = await createContext({ status: "confirmed" });
    appointment.status = "cancelled";
    await appointment.save();

    await queueAppointmentEventNotifications({
      appointment,
      eventType: "cancelled",
      actor: "visitor",
      dispatch: false,
    });

    const records = await AppointmentNotification.find({
      appointmentId: appointment._id,
      eventType: "cancelled",
    }).lean();

    expect(records).toHaveLength(2);
    expect(records.map((entry) => entry.recipientKind).sort()).toEqual([
      "owner",
      "visitor",
    ]);
    expect(records.every((entry) => entry.actor === "visitor")).toBe(true);
  });

  it("queues completion notices for both sides and supersedes stale reminders", async () => {
    const { appointment } = await createContext({ status: "confirmed" });

    await queueAppointmentEventNotifications({
      appointment,
      eventType: "reminder_24h",
      actor: "system",
      dispatch: false,
    });

    appointment.status = "completed";
    appointment.completedAt = new Date();
    appointment.completedBy = "owner";
    await appointment.save();

    const first = await queueAppointmentEventNotifications({
      appointment,
      eventType: "completed",
      actor: "owner",
      dispatch: false,
    });
    const second = await queueAppointmentEventNotifications({
      appointment,
      eventType: "completed",
      actor: "owner",
      dispatch: false,
    });

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);

    const records = await AppointmentNotification.find({
      appointmentId: appointment._id,
      eventType: "completed",
    }).lean();
    const reminders = await AppointmentNotification.find({
      appointmentId: appointment._id,
      eventType: "reminder_24h",
    }).lean();

    expect(records).toHaveLength(2);
    expect(records.map((entry) => entry.recipientKind).sort()).toEqual([
      "owner",
      "visitor",
    ]);
    expect(records.every((entry) => entry.actor === "owner")).toBe(true);
    expect(records.every((entry) => entry.snapshot.appointmentStatus === "completed")).toBe(
      true
    );
    expect(reminders).toHaveLength(2);
    expect(reminders.every((entry) => entry.status === "superseded")).toBe(
      true
    );
  });
});
