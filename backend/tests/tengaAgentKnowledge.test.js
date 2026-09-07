process.env.NODE_ENV =
  "test";

process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-knowledge-test";

process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-knowledge-test-secret";

process.env.OPENAI_API_KEY =
  "";

require(
  "../../apps/api/config/env"
);

const mongoose =
  require("mongoose");

const {
  MongoMemoryServer,
} = require(
  "mongodb-memory-server"
);

const KnowledgeSource =
  require(
    "../models/tengaAgent/KnowledgeSource"
  );

const KnowledgeChunk =
  require(
    "../models/tengaAgent/KnowledgeChunk"
  );

const {
  chunkKnowledgeText,
} = require(
  "../services/tengaAgent/knowledgeChunkingService"
);

const {
  ingestKnowledgeSource,
} = require(
  "../services/tengaAgent/knowledgeIngestionService"
);

const {
  retrieveKnowledge,
} = require(
  "../services/tengaAgent/knowledgeRetrievalService"
);

let mongod;

beforeAll(async () => {
  mongod =
    await MongoMemoryServer.create();

  await mongoose.connect(
    mongod.getUri()
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

describe(
  "TengaAgent knowledge foundation",
  () => {
    it(
      "chunks long business knowledge into bounded overlapping sections",
      () => {
        const text =
          Array.from(
            {
              length: 80,
            },
            (_, index) =>
              `Course ${index + 1} registration opens every Monday. Students can ask about schedules and fees.`
          ).join("\n\n");

        const chunks =
          chunkKnowledgeText(
            text,
            {
              maxChars: 700,
              overlapChars: 100,
            }
          );

        expect(
          chunks.length
        ).toBeGreaterThan(1);

        expect(
          chunks.every(
            (chunk) =>
              chunk.length <=
              720
          )
        ).toBe(true);
      }
    );

    it(
      "ingests knowledge with embeddings and marks the source ready",
      async () => {
        const organizationId =
          new mongoose.Types.ObjectId();

        const fakeEmbedder =
          jest.fn(
            async (texts) =>
              texts.map(
                (_, index) =>
                  index % 2 === 0
                    ? [1, 0]
                    : [0.8, 0.2]
              )
          );

        const result =
          await ingestKnowledgeSource({
            organizationId,
            title:
              "Training FAQ",
            type: "faq",
            text:
              "We run professional training courses. Registration opens on Monday. Course schedules are published before each cohort.",
            embedder:
              fakeEmbedder,
          });

        expect(
          result.source.status
        ).toBe("ready");

        expect(
          result.chunksCreated
        ).toBeGreaterThan(0);

        const chunks =
          await KnowledgeChunk.find({
            organizationId,
          }).lean();

        expect(
          chunks
        ).toHaveLength(
          result.chunksCreated
        );

        expect(
          chunks[0].embedding.length
        ).toBe(2);
      }
    );

    it(
      "never retrieves another organization's knowledge",
      async () => {
        const organizationA =
          new mongoose.Types.ObjectId();

        const organizationB =
          new mongoose.Types.ObjectId();

        const sourceA =
          await KnowledgeSource.create({
            organizationId:
              organizationA,
            title: "A",
            status: "ready",
          });

        const sourceB =
          await KnowledgeSource.create({
            organizationId:
              organizationB,
            title: "B",
            status: "ready",
          });

        await KnowledgeChunk.create([
          {
            organizationId:
              organizationA,
            sourceId:
              sourceA._id,
            chunkIndex: 0,
            text:
              "Training course registration and student schedules.",
            contentHash: "a",
            embedding:
              [1, 0],
            embeddingDimensions:
              2,
          },
          {
            organizationId:
              organizationB,
            sourceId:
              sourceB._id,
            chunkIndex: 0,
            text:
              "PRIVATE OTHER TENANT KNOWLEDGE",
            contentHash: "b",
            embedding:
              [1, 0],
            embeddingDimensions:
              2,
          },
        ]);

        const results =
          await retrieveKnowledge({
            organizationId:
              organizationA,

            query:
              "course registration",

            embedder:
              async () =>
                [1, 0],
          });

        expect(
          results
        ).toHaveLength(1);

        expect(
          results[0].text
        ).toMatch(
          /training course/i
        );

        expect(
          results
            .map(
              (entry) =>
                entry.text
            )
            .join(" ")
        ).not.toContain(
          "PRIVATE OTHER TENANT"
        );
      }
    );

    it(
      "marks a source failed when embeddings cannot be created",
      async () => {
        const organizationId =
          new mongoose.Types.ObjectId();

        await expect(
          ingestKnowledgeSource({
            organizationId,
            title:
              "Broken source",
            text:
              "Some business knowledge.",

            embedder:
              async () =>
                null,
          })
        ).rejects.toThrow(
          /embeddings were unavailable/i
        );

        const source =
          await KnowledgeSource.findOne({
            organizationId,
          }).lean();

        expect(
          source.status
        ).toBe("failed");

        expect(
          source.chunkCount
        ).toBe(0);
      }
    );
  }
);