process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-availability-route-test";
process.env.JWT_SECRET =
  "tengaagent-availability-route-test-secret";
process.env.OPENAI_API_KEY = "";

jest.mock(
  "../middleware/auth",
  () => (req, res, next) => {
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

const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const {
  MongoMemoryServer,
} = require("mongodb-memory-server");

const ownerRoutes = require(
  "../routes/tengaAgentOwner"
);
const publicRoutes = require(
  "../routes/tengaAgentPublic"
);
const {
  createOrUpdateOwnerWorkspace,
  setOwnerAgentPublication,
} = require(
  "../services/tengaAgent/ownerWorkspaceService"
);

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = express();
  app.use(express.json());
  app.use(
    "/api/tengaagent/owner",
    ownerRoutes
  );
  app.use(
    "/api/tengaagent/public",
    publicRoutes
  );
  app.use((error, _req, res, _next) =>
    res.status(500).json({
      message: error?.message || "Internal error",
    })
  );
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

const createOwner = async (name) => {
  const userId = new mongoose.Types.ObjectId();
  const workspace = await createOrUpdateOwnerWorkspace({
    userId,
    name,
    industry: "Services",
    countryCode: "NG",
    timezone: "UTC",
  });

  return { userId, ...workspace };
};

const futureDate = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  date.setUTCHours(10, 0, 0, 0);
  return date;
};

const ownerHeaders = (owner) => ({
  "x-test-user-id": owner.userId.toString(),
});

describe("TengaAgent availability routes", () => {
  it("saves and reads availability only for the authenticated owner", async () => {
    const ownerA = await createOwner("Alpha Calendar");
    const ownerB = await createOwner("Beta Calendar");
    const date = futureDate();

    const saved = await request(app)
      .put("/api/tengaagent/owner/availability")
      .set(ownerHeaders(ownerA))
      .send({
        enabled: true,
        timezone: "UTC",
        minimumNoticeMinutes: 90,
        bookingHorizonDays: 45,
        slotStepMinutes: 30,
        defaultDurationMinutes: 30,
        weeklyHours: [
          {
            dayOfWeek: date.getUTCDay(),
            startMinutes: 540,
            endMinutes: 720,
          },
        ],
      })
      .expect(200);

    expect(saved.body.schedule).toEqual(
      expect.objectContaining({
        enabled: true,
        timezone: "UTC",
        minimumNoticeMinutes: 90,
        bookingHorizonDays: 45,
      })
    );

    const alpha = await request(app)
      .get("/api/tengaagent/owner/availability")
      .set(ownerHeaders(ownerA))
      .expect(200);
    const beta = await request(app)
      .get("/api/tengaagent/owner/availability")
      .set(ownerHeaders(ownerB))
      .expect(200);

    expect(alpha.body.schedule.enabled).toBe(true);
    expect(beta.body.schedule.enabled).toBe(false);
  });

  it("rejects invalid availability configuration with a 400", async () => {
    const owner = await createOwner("Invalid Calendar");

    const response = await request(app)
      .put("/api/tengaagent/owner/availability")
      .set(ownerHeaders(owner))
      .send({
        enabled: true,
        timezone: "Not/A_Timezone",
        weeklyHours: [
          {
            dayOfWeek: 1,
            startMinutes: 540,
            endMinutes: 720,
          },
        ],
      })
      .expect(400);

    expect(response.body.message).toMatch(
      /timezone/i
    );
  });

  it("publishes real slots only after the business agent is public", async () => {
    const owner = await createOwner("Public Calendar");
    const date = futureDate();

    await request(app)
      .put("/api/tengaagent/owner/availability")
      .set(ownerHeaders(owner))
      .send({
        enabled: true,
        timezone: "UTC",
        minimumNoticeMinutes: 0,
        bookingHorizonDays: 30,
        slotStepMinutes: 30,
        defaultDurationMinutes: 30,
        weeklyHours: [
          {
            dayOfWeek: date.getUTCDay(),
            startMinutes: 540,
            endMinutes: 720,
          },
        ],
      })
      .expect(200);

    const path =
      `/api/tengaagent/public/${owner.organization.slug}/${owner.agent.key}/availability?durationMinutes=30`;

    await request(app)
      .get(path)
      .expect(404);

    await setOwnerAgentPublication({
      userId: owner.userId,
      published: true,
    });

    const response = await request(app)
      .get(path)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        enabled: true,
        source: "internal_schedule",
        timezone: "UTC",
        durationMinutes: 30,
      })
    );
    expect(Array.isArray(response.body.slots)).toBe(
      true
    );
    expect(response.body.slots.length).toBeGreaterThan(0);
  });
});
