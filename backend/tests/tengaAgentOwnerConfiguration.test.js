process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-owner-configuration-test";
process.env.JWT_SECRET =
  "tengaagent-owner-configuration-test-secret";
process.env.OPENAI_API_KEY = "";

const mongoose = require("mongoose");
const {
  MongoMemoryServer,
} = require("mongodb-memory-server");

const KnowledgeSource = require(
  "../models/tengaAgent/KnowledgeSource"
);
const {
  createOrUpdateOwnerWorkspace,
} = require(
  "../services/tengaAgent/ownerWorkspaceService"
);
const {
  setOwnerAgentPublicationPreservingTools,
  updateOwnerAgentConfiguration,
} = require(
  "../services/tengaAgent/ownerAgentConfigurationService"
);
const {
  fetchOwnerWebsiteText,
  syncOwnerWebsiteKnowledge,
  validateOwnerWebsiteUrl,
} = require(
  "../services/tengaAgent/ownerWebsiteKnowledgeService"
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

const createOwner = async () => {
  const userId = new mongoose.Types.ObjectId();
  const workspace =
    await createOrUpdateOwnerWorkspace({
      userId,
      name: "Northstar Academy",
      website: "https://northstar.example.com",
      industry: "Education",
      countryCode: "NG",
      timezone: "Africa/Lagos",
    });

  return { userId, ...workspace };
};

describe("TengaAgent owner agent configuration", () => {
  it("pauses a published agent after configuration changes and preserves selected tools", async () => {
    const owner = await createOwner();

    owner.agent.enabledTools = ["lead_capture"];
    owner.agent.status = "active";
    await owner.agent.save();

    const updated =
      await updateOwnerAgentConfiguration({
        userId: owner.userId,
        name: "Northstar Assistant",
        role: "Admissions Receptionist",
        greeting: "Welcome to Northstar Academy. How can I help?",
        tone: "warm",
        languages: ["English", "Hausa"],
        systemInstructions:
          "Represent Northstar Academy accurately. Use only approved school knowledge and escalate when uncertain.",
        enabledTools: ["lead_capture"],
      });

    expect(updated.publicationPaused).toBe(true);
    expect(updated.agent.status).toBe("paused");
    expect(updated.agent.enabledTools).toEqual([
      "lead_capture",
    ]);
    expect(updated.agent.languages).toEqual([
      "English",
      "Hausa",
    ]);

    const republished =
      await setOwnerAgentPublicationPreservingTools({
        userId: owner.userId,
        published: true,
      });

    expect(republished.agent.status).toBe("active");
    expect(republished.agent.enabledTools).toEqual([
      "lead_capture",
    ]);
  });

  it("rejects unsupported tools and empty language configuration", async () => {
    const owner = await createOwner();

    await expect(
      updateOwnerAgentConfiguration({
        userId: owner.userId,
        languages: [],
      })
    ).rejects.toThrow(/at least one agent language/i);

    await expect(
      updateOwnerAgentConfiguration({
        userId: owner.userId,
        enabledTools: ["unsafe_tool"],
      })
    ).rejects.toThrow(/unsupported tengaagent tool/i);
  });
});

describe("TengaAgent owner website knowledge", () => {
  it("allows only the registered business hostname and its www counterpart", async () => {
    const website = "https://northstar.example.com";

    expect(
      validateOwnerWebsiteUrl({
        value:
          "https://www.northstar.example.com/admissions",
        website,
      }).hostname
    ).toBe("www.northstar.example.com");

    expect(() =>
      validateOwnerWebsiteUrl({
        value: "https://evil.example/phish",
        website,
      })
    ).toThrow(/must match the business website hostname/i);
  });

  it("revalidates redirects against the business hostname allowlist", async () => {
    const fetchImpl = async () => ({
      status: 302,
      ok: false,
      headers: {
        get: (name) =>
          name.toLowerCase() === "location"
            ? "https://evil.example/redirected"
            : "",
      },
      text: async () => "",
    });

    await expect(
      fetchOwnerWebsiteText({
        url: "https://northstar.example.com",
        website: "https://northstar.example.com",
        fetchImpl,
      })
    ).rejects.toThrow(/must match the business website hostname/i);
  });

  it("ingests website text into only the authenticated owner's knowledge base", async () => {
    const owner = await createOwner();

    const fetchImpl = async () => ({
      status: 200,
      ok: true,
      headers: {
        get: (name) => {
          if (name.toLowerCase() === "content-type") {
            return "text/html; charset=utf-8";
          }
          return "";
        },
      },
      text: async () =>
        "<html><body><h1>Northstar Academy</h1><p>Admissions are open Monday to Friday. We support primary and secondary learners.</p></body></html>",
    });

    const embedder = async (chunks) =>
      chunks.map(() => [0.1, 0.2, 0.3]);

    const result = await syncOwnerWebsiteKnowledge({
      userId: owner.userId,
      url: "https://northstar.example.com/admissions",
      title: "Admissions website",
      fetchImpl,
      embedder,
    });

    expect(result.source).toEqual(
      expect.objectContaining({
        type: "website",
        title: "Admissions website",
        status: "ready",
      })
    );
    expect(result.source.organizationId.toString()).toBe(
      owner.organization._id.toString()
    );
    expect(result.source.sourceUrl).toBe(
      "https://northstar.example.com/admissions"
    );

    const sources = await KnowledgeSource.find({});
    expect(sources).toHaveLength(1);
    expect(sources[0].organizationId.toString()).toBe(
      owner.organization._id.toString()
    );
  });
});
