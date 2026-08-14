const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
require("../../apps/api/config/env");

const routes = require("../routes/tengaharvest");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const User = require("../models/User");
const Participant = require("../models/TengaHarvestParticipant");
const Service = require("../models/TengaHarvestService");
const Booking = require("../models/TengaHarvestBooking");

let mongod;
let app;
let adminToken;

const issueSessionToken = async (userId) => {
  const sessionId = new mongoose.Types.ObjectId().toString();
  await User.updateOne(
    { _id: userId },
    { $push: { sessions: { sessionId, createdAt: new Date(), lastSeenAt: new Date() } } }
  );
  return jwt.sign(
    { id: userId.toString(), tv: 0, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });
  app = express();
  app.use(express.json());
  app.use("/api/tengaharvest", routes);
  app.use(errorHandler);
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  const admin = await User.create({
    name: "TengaHarvest Admin",
    username: `th_admin_${Date.now()}`,
    email: `th-admin-${Date.now()}@test.com`,
    password: "Password123!",
    role: "admin",
  });
  adminToken = await issueSessionToken(admin._id);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe("TengaHarvest routes", () => {
  it("registers a farmer without exposing their personal data publicly", async () => {
    const response = await request(app)
      .post("/api/tengaharvest/participants")
      .send({
        role: "farmer",
        fullName: "Kaduna Farmer",
        phone: "08030000000",
        lga: "Chikun",
        farmSizeHectares: 2.5,
        crops: ["tomato", "maize"],
        serviceInterests: ["solar_irrigation"],
      })
      .expect(201);

    expect(response.body.participant).toEqual(
      expect.objectContaining({ role: "farmer", status: "pilot_lead" })
    );
    expect(response.body.participant.phone).toBeUndefined();

    const impact = await request(app).get("/api/tengaharvest/impact").expect(200);
    expect(impact.body).toEqual(
      expect.objectContaining({ farmers: 1, registeredHectares: 2.5 })
    );
  });

  it("requires a real provider registration before infrastructure submission", async () => {
    await request(app)
      .post("/api/tengaharvest/provider-services")
      .send({
        providerName: "Unlinked Solar Ltd",
        type: "solar_irrigation",
        title: "Solar pump service",
      })
      .expect(400);

    const provider = await request(app)
      .post("/api/tengaharvest/participants")
      .send({
        role: "provider",
        fullName: "Solar Provider",
        phone: "08031111111",
        organizationName: "Solar Provider Ltd",
        lga: "Igabi",
      })
      .expect(201);

    const service = await request(app)
      .post("/api/tengaharvest/provider-services")
      .send({
        participantId: provider.body.participant.id,
        providerName: "Solar Provider Ltd",
        type: "solar_irrigation",
        title: "Shared 3HP solar pump",
        lga: "Igabi",
        capacity: 4,
        capacityUnit: "hectares_per_day",
        pricePerUnitNgn: 12000,
      })
      .expect(201);

    expect(service.body.service.status).toBe("pending_review");
    const publicServices = await request(app).get("/api/tengaharvest/services").expect(200);
    expect(publicServices.body.services).toHaveLength(0);
  });

  it("lets an admin activate a verified service and complete a booking", async () => {
    const participant = await Participant.create({
      role: "provider",
      fullName: "Verified Provider",
      phone: "08032222222",
      organizationName: "Verified Solar",
      lga: "Chikun",
    });
    const service = await Service.create({
      participant: participant._id,
      providerName: "Verified Solar",
      type: "solar_irrigation",
      title: "Verified pump",
      lga: "Chikun",
      capacity: 2,
      status: "pending_review",
    });

    const activation = await request(app)
      .patch(`/api/tengaharvest/admin/services/${service._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "active", verificationNote: "Provider and equipment checked." })
      .expect(200);

    expect(activation.body.service).toEqual(
      expect.objectContaining({ status: "active", verificationNote: "Provider and equipment checked." })
    );
    expect(activation.body.service.verifiedAt).toBeTruthy();

    const bookingResponse = await request(app)
      .post("/api/tengaharvest/bookings")
      .send({
        serviceId: service._id,
        customerName: "Pilot Farmer",
        phone: "08033333333",
        units: 1,
        startDate: new Date(Date.now() + 2 * 86400000).toISOString(),
      })
      .expect(201);

    const booking = await Booking.findOne({ reference: bookingResponse.body.booking.reference });
    const completion = await request(app)
      .patch(`/api/tengaharvest/admin/bookings/${booking._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "completed", operationsNote: "Service delivered and confirmed." })
      .expect(200);

    expect(completion.body.booking.status).toBe("completed");
    expect(completion.body.booking.completedAt).toBeTruthy();

    const impact = await request(app).get("/api/tengaharvest/impact").expect(200);
    expect(impact.body.completedBookings).toBe(1);
  });

  it("blocks non-admin access to pilot operations", async () => {
    await request(app).get("/api/tengaharvest/admin/overview").expect(401);
  });
});
