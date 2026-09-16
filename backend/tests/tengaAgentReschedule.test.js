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
  "mongodb://127.0.0.1:27017/tengaagent-reschedule-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-reschedule-test-secret";

jest.mock(
  "../middleware/auth",
  () =>
    (req, res, next) => {
      const userId = req.headers["x-test-user-id"];

      if (!userId) {
        return res.status(401).json({
          error: "No token",
        });
      }

      req.user = {
        id: userId,
        _id: userId,
      };
      req.userId = userId;
      return next();
    }
);

require("../../apps/api/config/env");

const ownerRoutes = require("../routes/tengaAgentOwner");
const errorHandler = require(
  "../../apps/api/middleware/errorHandler"
);
const Organization = require(
  "../models/tengaAgent/Organization"
);
const Agent = require(
  "../models/tengaAgent/Agent"
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
    "/api/tengaagent/owner",
    ownerRoutes
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

const createOwner = async (slug) => {
  const userId = new mongoose.Types.ObjectId();
  const organization = await Organization.create({
    name: `${slug} Business`,
    slug,
    ownerUser: userId,
    timezone: "UTC",
    plan: "starter",
    status: "pilot",
  });
  const agent = await Agent.create({
    organizationId: organization._id,
    key: "receptionist",
    name: "TengaAgent",
    status: "active",
  });

  return { userId, organization, agent };
};

const createAppointment = async ({
  owner,
  startAt,
  status = "requested",
}) =>
  Appointment.create({
    organizationId: owner.organization._id,
    agentId: owner.agent._id,
    conversationId: new mongoose.Types.ObjectId(),
    sessionKey: `reschedule-${Date.now()}-${Math.random()}`,
    name: "Reschedule Visitor",
    email: "visitor@example.com",
    preferredStartAt: startAt,
    timezone: "UTC",
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

describe("TengaAgent owner appointment rescheduling", () => {
  it("reschedules a requested appointment and keeps it tenant-scoped", async () => {
    const ownerA = await createOwner("reschedule-owner-a");
    const ownerB = await createOwner("reschedule-owner-b");
    const appointment = await createAppointment({
      owner: ownerA,
      startAt: futureAt(7, 10),
    });
    const nextStart = futureAt(8, 11);

    const response = await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${appointment._id}/reschedule`
      )
      .set("x-test-user-id", String(ownerA.userId))
      .send({
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
      new Date(response.body.appointment.preferredStartAt).getTime()
    ).toBe(nextStart.getTime());

    await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${appointment._id}/reschedule`
      )
      .set("x-test-user-id", String(ownerB.userId))
      .send({
        preferredStartAt: futureAt(9, 12).toISOString(),
      })
      .expect(404);
  });

  it("revalidates and reschedules a confirmed appointment without changing its status", async () => {
    const owner = await createOwner("reschedule-confirmed");
    const appointment = await createAppointment({
      owner,
      startAt: futureAt(7, 10),
      status: "confirmed",
    });
    const originalConfirmedAt = appointment.confirmedAt.getTime();
    const nextStart = futureAt(9, 11);

    const response = await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${appointment._id}/reschedule`
      )
      .set("x-test-user-id", String(owner.userId))
      .send({
        preferredStartAt: nextStart.toISOString(),
        durationMinutes: 60,
      })
      .expect(200);

    expect(response.body.appointment).toEqual(
      expect.objectContaining({
        status: "confirmed",
        durationMinutes: 60,
        availabilityState: "confirmed_free",
        rescheduleCount: 1,
      })
    );

    const saved = await Appointment.findById(
      appointment._id
    ).lean();
    expect(saved.preferredStartAt.getTime()).toBe(
      nextStart.getTime()
    );
    expect(saved.confirmedAt.getTime()).toBe(
      originalConfirmedAt
    );
  });

  it("rejects a confirmed reschedule that overlaps another confirmed meeting", async () => {
    const owner = await createOwner("reschedule-conflict");
    const appointment = await createAppointment({
      owner,
      startAt: futureAt(7, 10),
      status: "confirmed",
    });
    const blockedStart = futureAt(8, 11);

    await createAppointment({
      owner,
      startAt: blockedStart,
      status: "confirmed",
    });

    const response = await request(app)
      .patch(
        `/api/tengaagent/owner/appointments/${appointment._id}/reschedule`
      )
      .set("x-test-user-id", String(owner.userId))
      .send({
        preferredStartAt: blockedStart.toISOString(),
        durationMinutes: 30,
      })
      .expect(400);

    expect(response.body.message).toMatch(
      /no longer available/i
    );

    const unchanged = await Appointment.findById(
      appointment._id
    ).lean();
    expect(unchanged.preferredStartAt.getTime()).toBe(
      futureAt(7, 10).getTime()
    );
    expect(unchanged.rescheduleCount).toBe(0);
  });

  it("does not reschedule completed or cancelled appointments", async () => {
    const owner = await createOwner("reschedule-terminal");
    const completed = await createAppointment({
      owner,
      startAt: futureAt(7, 10),
      status: "completed",
    });
    const cancelled = await createAppointment({
      owner,
      startAt: futureAt(8, 10),
      status: "cancelled",
    });

    for (const appointment of [completed, cancelled]) {
      const response = await request(app)
        .patch(
          `/api/tengaagent/owner/appointments/${appointment._id}/reschedule`
        )
        .set("x-test-user-id", String(owner.userId))
        .send({
          preferredStartAt: futureAt(10, 10).toISOString(),
        })
        .expect(400);

      expect(response.body.message).toMatch(
        /cannot be rescheduled/i
      );
    }
  });
});
