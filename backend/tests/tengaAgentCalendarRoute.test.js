process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-calendar-route-test";
process.env.JWT_SECRET =
  "tengaagent-calendar-route-test-secret";
process.env.OPENAI_API_KEY = "";
process.env.TENGAAGENT_CALENDAR_ENCRYPTION_KEY =
  "tengaagent-calendar-route-encryption-key-2026";
process.env.GOOGLE_CALENDAR_CLIENT_ID =
  "google-calendar-route-client";
process.env.GOOGLE_CALENDAR_CLIENT_SECRET =
  "google-calendar-route-secret";
process.env.GOOGLE_CALENDAR_REDIRECT_URI =
  "http://localhost:5173/tengaagent";
process.env.MICROSOFT_CALENDAR_CLIENT_ID =
  "microsoft-calendar-route-client";
process.env.MICROSOFT_CALENDAR_CLIENT_SECRET =
  "microsoft-calendar-route-secret";
process.env.MICROSOFT_CALENDAR_REDIRECT_URI =
  "http://localhost:5173/tengaagent";

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

const CalendarConnection = require(
  "../models/tengaAgent/CalendarConnection"
);
const ownerRoutes = require(
  "../routes/tengaAgentOwner"
);
const {
  encryptJson,
} = require(
  "../services/tengaAgent/calendarCryptoService"
);
const {
  createOrUpdateOwnerWorkspace,
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

const ownerHeaders = (owner) => ({
  "x-test-user-id": owner.userId.toString(),
});

describe("TengaAgent calendar connection routes", () => {
  it("requires authenticated owner identity", async () => {
    await request(app)
      .get(
        "/api/tengaagent/owner/calendar-connections"
      )
      .expect(401);
  });

  it("returns configured providers and an owner-bound authorization URL", async () => {
    const owner = await createOwner(
      "Route Calendar"
    );

    const status = await request(app)
      .get(
        "/api/tengaagent/owner/calendar-connections"
      )
      .set(ownerHeaders(owner))
      .expect(200);

    expect(status.body.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "google",
          configured: true,
          connected: false,
        }),
        expect.objectContaining({
          provider: "microsoft",
          configured: true,
          connected: false,
        }),
      ])
    );

    const connect = await request(app)
      .post(
        "/api/tengaagent/owner/calendar-connections/google/connect"
      )
      .set(ownerHeaders(owner))
      .expect(200);

    const url = new URL(
      connect.body.authorizationUrl
    );

    expect(connect.body.provider).toBe("google");
    expect(url.origin).toBe(
      "https://accounts.google.com"
    );
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(
      url.searchParams.get("code_challenge")
    ).toBeTruthy();
  });

  it("disconnects only the authenticated tenant's provider connection", async () => {
    const ownerA = await createOwner(
      "Calendar Alpha"
    );
    const ownerB = await createOwner(
      "Calendar Beta"
    );
    const expiresAt = new Date(
      Date.now() + 60 * 60 * 1000
    );

    await CalendarConnection.create({
      organizationId: ownerA.organization._id,
      agentId: ownerA.agent._id,
      provider: "google",
      status: "active",
      encryptedCredentials: encryptJson({
        accessToken: "alpha-access-token",
        refreshToken: "alpha-refresh-token",
        expiresAt: expiresAt.toISOString(),
      }),
      tokenExpiresAt: expiresAt,
    });

    await request(app)
      .delete(
        "/api/tengaagent/owner/calendar-connections/google"
      )
      .set(ownerHeaders(ownerB))
      .expect(200);

    expect(
      await CalendarConnection.countDocuments({
        organizationId: ownerA.organization._id,
        provider: "google",
      })
    ).toBe(1);

    await request(app)
      .delete(
        "/api/tengaagent/owner/calendar-connections/google"
      )
      .set(ownerHeaders(ownerA))
      .expect(200);

    expect(
      await CalendarConnection.countDocuments({
        organizationId: ownerA.organization._id,
        provider: "google",
      })
    ).toBe(0);
  });
});
