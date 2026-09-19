process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-knowledge-lifecycle-test";
process.env.JWT_SECRET =
  "tengaagent-knowledge-lifecycle-test-secret";
process.env.OPENAI_API_KEY = "";

const mongoose = require("mongoose");
const {
  MongoMemoryServer,
} = require("mongodb-memory-server");

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
const {
  archiveOwnerKnowledgeSource,
  normalizeWebsite,
  updateOwnerBusinessProfile,
} = require(
  "../services/tengaAgent/ownerKnowledgeLifecycleService"
);

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
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
  const workspace =
    await createOrUpdateOwnerWorkspace({
      userId,
      name,
      website,
      industry: "Professional Services",
      countryCode: "NG",
      timezone: "Africa/Lagos",
    });

  return { userId, ...workspace };
};

const createReadySource = async ({
  organizationId,
  type = "faq",
  title = "Knowledge",
  sourceUrl = "",
}) => {
  const source = await KnowledgeSource.create({
    organizationId,
    agentId: null,
    type,
    title,
    sourceUrl,
    contentHash: new mongoose.Types.ObjectId().toString(),
    status: "ready",
    chunkCount: 1,
    metadata: { sourceKind: "test" },
  });

  await KnowledgeChunk.create({
    organizationId,
    agentId: null,
    sourceId: source._id,
    chunkIndex: 0,
    text: `${title} approved business information`,
    contentHash: new mongoose.Types.ObjectId().toString(),
    tokenEstimate: 5,
    embedding: [0.1, 0.2, 0.3],
    embeddingModel: "test-embedding",
    embeddingDimensions: 3,
    metadata: {},
  });

  return source;
};

describe("TengaAgent owner business profile lifecycle", () => {
  it("keeps the public slug stable, pauses a live agent and retires old website knowledge after a website change", async () => {
    const owner = await createOwner(
      "Northstar Academy",
      "https://northstar.example.com"
    );
    const originalSlug = owner.organization.slug;

    owner.agent.status = "active";
    await owner.agent.save();

    const source = await createReadySource({
      organizationId: owner.organization._id,
      type: "website",
      title: "Old website",
      sourceUrl: "https://northstar.example.com/about",
    });

    const updated = await updateOwnerBusinessProfile({
      userId: owner.userId,
      name: "Northstar Learning Academy",
      website: "https://northstar-learning.example.com",
      industry: "Education",
      countryCode: "NG",
      timezone: "Africa/Lagos",
    });

    expect(updated.organization.slug).toBe(originalSlug);
    expect(updated.organization.name).toBe(
      "Northstar Learning Academy"
    );
    expect(updated.organization.website).toBe(
      "https://northstar-learning.example.com/"
    );
    expect(updated.publicationPaused).toBe(true);
    expect(updated.agent.status).toBe("paused");
    expect(updated.archivedWebsiteSources).toBe(1);

    const archived = await KnowledgeSource.findById(source._id);
    expect(archived.status).toBe("archived");
    expect(archived.metadata.archivedReason).toBe(
      "business-website-changed"
    );
    expect(
      await KnowledgeChunk.countDocuments({
        sourceId: source._id,
      })
    ).toBe(0);
  });

  it("rejects insecure business website values", () => {
    expect(() =>
      normalizeWebsite("http://northstar.example.com")
    ).toThrow(/must use https/i);

    expect(() =>
      normalizeWebsite(
        "https://user:pass@northstar.example.com"
      )
    ).toThrow(/credentials/i);
  });
});

describe("TengaAgent owner knowledge lifecycle", () => {
  it("archives only the authenticated owner's source, removes its chunks and pauses a live agent", async () => {
    const ownerA = await createOwner(
      "Alpha Consulting",
      "https://alpha.example.com"
    );
    const ownerB = await createOwner(
      "Beta Consulting",
      "https://beta.example.com"
    );

    ownerA.agent.status = "active";
    await ownerA.agent.save();

    const sourceA = await createReadySource({
      organizationId: ownerA.organization._id,
      title: "Alpha pricing",
    });
    const sourceB = await createReadySource({
      organizationId: ownerB.organization._id,
      title: "Beta pricing",
    });

    const archived = await archiveOwnerKnowledgeSource({
      userId: ownerA.userId,
      sourceId: sourceA._id,
    });

    expect(archived.source.status).toBe("archived");
    expect(archived.chunksRemoved).toBe(1);
    expect(archived.publicationPaused).toBe(true);
    expect(archived.agent.status).toBe("paused");

    expect(
      await KnowledgeChunk.countDocuments({
        sourceId: sourceA._id,
      })
    ).toBe(0);

    const untouchedSource = await KnowledgeSource.findById(
      sourceB._id
    );
    expect(untouchedSource.status).toBe("ready");
    expect(
      await KnowledgeChunk.countDocuments({
        sourceId: sourceB._id,
      })
    ).toBe(1);
  });

  it("does not allow one owner to archive another tenant's source", async () => {
    const ownerA = await createOwner(
      "Alpha Academy",
      "https://alpha-academy.example.com"
    );
    const ownerB = await createOwner(
      "Beta Academy",
      "https://beta-academy.example.com"
    );

    const sourceB = await createReadySource({
      organizationId: ownerB.organization._id,
      title: "Beta admissions",
    });

    const result = await archiveOwnerKnowledgeSource({
      userId: ownerA.userId,
      sourceId: sourceB._id,
    });

    expect(result.source).toBeNull();
    expect(result.chunksRemoved).toBe(0);

    const source = await KnowledgeSource.findById(sourceB._id);
    expect(source.status).toBe("ready");
    expect(
      await KnowledgeChunk.countDocuments({
        sourceId: sourceB._id,
      })
    ).toBe(1);
  });
});
