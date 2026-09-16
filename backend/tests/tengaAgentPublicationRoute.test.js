process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-publication-route-test";
process.env.JWT_SECRET =
  "tengaagent-publication-route-test-secret";
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

describe("TengaAgent owner publication route", () => {
  it("requires authentication", async () => {
    await request(app)
      .patch(
        "/api/tengaagent/owner/agent/publication"
      )
      .send({ published: true })
      .expect(401);
  });

  it("publishes and pauses only the authenticated owner's agent", async () => {
    const ownerA = new mongoose.Types.ObjectId();
    const ownerB = new mongoose.Types.ObjectId();

    const workspaceA =
      await createOrUpdateOwnerWorkspace({
        userId: ownerA,
        name: "Alpha Academy",
      });

    const workspaceB =
      await createOrUpdateOwnerWorkspace({
        userId: ownerB,
        name: "Beta Academy",
      });

    const published = await request(app)
      .patch(
        "/api/tengaagent/owner/agent/publication"
      )
      .set(
        "x-test-user-id",
        ownerA.toString()
      )
      .send({ published: true })
      .expect(200);

    expect(published.body.agent).toEqual(
      expect.objectContaining({
        key: "receptionist",
        status: "active",
        published: true,
        publicPath:
          `/tengaagent/${workspaceA.organization.slug}/receptionist`,
      })
    );

    const ownerBWorkspace = await request(app)
      .get("/api/tengaagent/owner/workspace")
      .set(
        "x-test-user-id",
        ownerB.toString()
      )
      .expect(200);

    expect(ownerBWorkspace.body.agent).toEqual(
      expect.objectContaining({
        id: workspaceB.agent._id.toString(),
        status: "draft",
        published: false,
      })
    );

    const paused = await request(app)
      .patch(
        "/api/tengaagent/owner/agent/publication"
      )
      .set(
        "x-test-user-id",
        ownerA.toString()
      )
      .send({ published: false })
      .expect(200);

    expect(paused.body.agent).toEqual(
      expect.objectContaining({
        status: "paused",
        published: false,
      })
    );
  });

  it("rejects ambiguous publication payloads", async () => {
    const owner = new mongoose.Types.ObjectId();

    await createOrUpdateOwnerWorkspace({
      userId: owner,
      name: "Payload Academy",
    });

    await request(app)
      .patch(
        "/api/tengaagent/owner/agent/publication"
      )
      .set(
        "x-test-user-id",
        owner.toString()
      )
      .send({ published: "yes" })
      .expect(400);
  });
});
