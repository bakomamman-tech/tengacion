process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-knowledge-lifecycle-route-test";
process.env.JWT_SECRET =
  "tengaagent-knowledge-lifecycle-route-test-secret";
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
const KnowledgeSource = require(
  "../models/tengaAgent/KnowledgeSource"
);
const KnowledgeChunk = require(
  "../models/tengaAgent/KnowledgeChunk"
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

const createOwner = async (name, website) => {
  const userId = new mongoose.Types.ObjectId();
  const workspace = await createOrUpdateOwnerWorkspace({
    userId,
    name,
    website,
    industry: "Services",
    countryCode: "NG",
    timezone: "Africa/Lagos",
  });

  return { userId, ...workspace };
};

const createSource = async ({ organizationId, title }) => {
  const source = await KnowledgeSource.create({
    organizationId,
    type: "faq",
    title,
    contentHash: new mongoose.Types.ObjectId().toString(),
    status: "ready",
    chunkCount: 1,
  });

  await KnowledgeChunk.create({
    organizationId,
    sourceId: source._id,
    chunkIndex: 0,
    text: `${title} approved information`,
    contentHash: new mongoose.Types.ObjectId().toString(),
    tokenEstimate: 4,
    embedding: [0.1, 0.2],
    embeddingModel: "test",
    embeddingDimensions: 2,
  });

  return source;
};

describe("TengaAgent owner profile and knowledge lifecycle routes", () => {
  it("updates the authenticated owner's profile without changing its public slug", async () => {
    const owner = await createOwner(
      "Northstar Academy",
      "https://northstar.example.com"
    );
    const originalSlug = owner.organization.slug;

    owner.agent.status = "active";
    await owner.agent.save();

    const response = await request(app)
      .patch("/api/tengaagent/owner/profile")
      .set("x-test-user-id", owner.userId.toString())
      .send({
        name: "Northstar Learning Academy",
        website: "https://northstar.example.com",
        industry: "Education Technology",
        countryCode: "NG",
        timezone: "Africa/Lagos",
      })
      .expect(200);

    expect(response.body.organization).toEqual(
      expect.objectContaining({
        name: "Northstar Learning Academy",
        slug: originalSlug,
        industry: "Education Technology",
      })
    );
    expect(response.body.publicationPaused).toBe(true);
    expect(response.body.agent).toEqual(
      expect.objectContaining({
        status: "paused",
        published: false,
      })
    );
  });

  it("archives only a source owned by the authenticated tenant", async () => {
    const ownerA = await createOwner(
      "Alpha Consulting",
      "https://alpha.example.com"
    );
    const ownerB = await createOwner(
      "Beta Consulting",
      "https://beta.example.com"
    );

    const sourceA = await createSource({
      organizationId: ownerA.organization._id,
      title: "Alpha FAQ",
    });
    const sourceB = await createSource({
      organizationId: ownerB.organization._id,
      title: "Beta FAQ",
    });

    const archived = await request(app)
      .delete(
        `/api/tengaagent/owner/knowledge/${sourceA._id}`
      )
      .set("x-test-user-id", ownerA.userId.toString())
      .expect(200);

    expect(archived.body).toEqual(
      expect.objectContaining({
        ok: true,
        chunksRemoved: 1,
        source: expect.objectContaining({
          id: sourceA._id.toString(),
          status: "archived",
        }),
      })
    );

    await request(app)
      .delete(
        `/api/tengaagent/owner/knowledge/${sourceB._id}`
      )
      .set("x-test-user-id", ownerA.userId.toString())
      .expect(404);

    const untouched = await KnowledgeSource.findById(
      sourceB._id
    );
    expect(untouched.status).toBe("ready");
    expect(
      await KnowledgeChunk.countDocuments({
        sourceId: sourceB._id,
      })
    ).toBe(1);
  });
});
