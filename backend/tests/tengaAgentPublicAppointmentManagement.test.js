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
  "mongodb://127.0.0.1:27017/tengaagent-public-appointment-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-public-appointment-test-secret";

require("../../apps/api/config/env");

const publicRoutes = require(
  "../routes/tengaAgentPublic"
);
const errorHandler = require(
  "../../apps/api/middleware/errorHandler"
);
const Organization = require(
  "../models/tengaAgent/Organization"
);
const Agent = require(
  "../models/tengaAgent/Agent"
);
const Conversation = require(
  "../models/tengaAgent/Conversation"
);
const Appointment = require(
  "../models/tengaAgent/Appointment"
);

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
  app.use(
    "/api/tengaagent/public",
    publicRoutes
  );
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

const futureAt = (daysAhead, hour = 10) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};

const createFixture = async () => {
  const organization = await Organization.create({
    name: "Visitor Booking Co",
    slug: "visitor-booking-co",
    ownerUser: new mongoose.Types.ObjectId(),
    timezone: "UTC",
    plan: "starter",
    status: "pilot",
  });
  const agent = await Agent.create({
    organizationId: organization._id,
    key: "receptionist",
    name: "TengaAgent",
    status: "active",
    enabledTools: ["appointment_requests"],
  });
  const conversationA = await Conversation.create({
    organizationId: organization._id,
    agentId: agent._id,
    sessionKey: "visitor-session-a",
    channel: "web",
    status: "handoff_requested",
  });
  const conversationB = await Conversation.create({
    organizationId: organization._id,
    agentId: agent._id,
    sessionKey: "visitor-session-b",
    channel: "web",
    status: "ai_active",
  });
  const appointment = await Appointment.create({
    organizationId: organization._id,
    agentId: agent._id,
    conversationId: conversationA._id,
    sessionKey: "visitor-session-a",
    name: "Ada Visitor",
    email: "ada@example.com",
    purpose: "Discuss the product",
    preferredStartAt: futureAt(10, 10),
    timezone: "UTC",
    durationMinutes: 30,
    status: "requested",
    consentToContact: true,
  });

  return {
    organization,
    agent,
    conversationA,
    conversationB,
    appointment,
  };
};

const basePath =
  "/api/tengaagent/public/visitor-booking-co/receptionist/appointment";

describe("TengaAgent visitor appointment management", () => {
  it("shows an appointment only to the session that created it", async () => {
    await createFixture();

    const own = await request(app)
      .get(basePath)
      .query({ sessionId: "visitor-session-a" })
      .expect(200);

    expect(own.body).toEqual(
      expect.objectContaining({
        ok: true,
        exists: true,
        appointment: expect.objectContaining({
          status: "requested",
          purpose: "Discuss the product",
          durationMinutes: 30,
        }),
      })
    );
    expect(own.body.appointment).not.toHaveProperty(
      "email"
    );
    expect(own.body.appointment).not.toHaveProperty(
      "phone"
    );

    const other = await request(app)
      .get(basePath)
      .query({ sessionId: "visitor-session-b" })
      .expect(200);

    expect(other.body).toEqual(
      expect.objectContaining({
        ok: true,
        exists: false,
        appointment: null,
      })
    );
  });

  it("lets the owning session reschedule while rejecting another session", async () => {
    const { appointment } = await createFixture();
    const nextStart = futureAt(12, 11);

    await request(app)
      .patch(`${basePath}/reschedule`)
      .send({
        sessionId: "visitor-session-b",
        preferredStartAt: nextStart.toISOString(),
        timezone: "UTC",
        durationMinutes: 45,
      })
      .expect(404);

    const before = await Appointment.findById(
      appointment._id
    ).lean();
    expect(before.rescheduleCount).toBe(0);

    const response = await request(app)
      .patch(`${basePath}/reschedule`)
      .send({
        sessionId: "visitor-session-a",
        preferredStartAt: nextStart.toISOString(),
        timezone: "Africa/Lagos",
        durationMinutes: 45,
      })
      .expect(200);

    expect(response.body.appointment).toEqual(
      expect.objectContaining({
        status: "requested",
        timezone: "Africa/Lagos",
        durationMinutes: 45,
        rescheduleCount: 1,
        rescheduledAt: expect.any(String),
      })
    );
    expect(
      new Date(
        response.body.appointment.preferredStartAt
      ).getTime()
    ).toBe(nextStart.getTime());
  });

  it("lets the owning session cancel an active appointment and keeps cancellation terminal", async () => {
    const { appointment } = await createFixture();

    await request(app)
      .patch(`${basePath}/cancel`)
      .send({ sessionId: "visitor-session-b" })
      .expect(404);

    const cancelled = await request(app)
      .patch(`${basePath}/cancel`)
      .send({ sessionId: "visitor-session-a" })
      .expect(200);

    expect(cancelled.body.appointment.status).toBe(
      "cancelled"
    );

    await request(app)
      .patch(`${basePath}/cancel`)
      .send({ sessionId: "visitor-session-a" })
      .expect(200);

    await request(app)
      .patch(`${basePath}/reschedule`)
      .send({
        sessionId: "visitor-session-a",
        preferredStartAt: futureAt(13, 10).toISOString(),
      })
      .expect(400);

    const saved = await Appointment.findById(
      appointment._id
    ).lean();
    expect(saved.status).toBe("cancelled");
    expect(saved.rescheduleCount).toBe(0);
    expect(saved.cancelledBy).toBe("visitor");
    expect(saved.cancelledAt).toBeInstanceOf(Date);
  });

  it("does not let a visitor cancel a completed appointment", async () => {
    const { appointment } = await createFixture();
    appointment.status = "completed";
    await appointment.save();

    const response = await request(app)
      .patch(`${basePath}/cancel`)
      .send({ sessionId: "visitor-session-a" })
      .expect(400);

    expect(response.body.message).toMatch(
      /completed appointments cannot be cancelled/i
    );
  });
});
