process.env.NODE_ENV =
  "test";

process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-owner-test";

process.env.JWT_SECRET =
  "tengaagent-owner-test-secret";

process.env.OPENAI_API_KEY =
  "";

jest.mock(
  "../middleware/auth",
  () =>
    (
      req,
      res,
      next
    ) => {
      const userId =
        req.headers[
          "x-test-user-id"
        ];

      if (!userId) {
        return res
          .status(401)
          .json({
            error:
              "No token",
          });
      }

      req.user = {
        id:
          userId,
        _id:
          userId,
      };

      req.userId =
        userId;

      return next();
    }
);

const express =
  require("express");

const request =
  require("supertest");

const mongoose =
  require("mongoose");

const {
  MongoMemoryServer,
} = require(
  "mongodb-memory-server"
);

const routes =
  require(
    "../routes/tengaAgentOwner"
  );

const Organization =
  require(
    "../models/tengaAgent/Organization"
  );

const Agent =
  require(
    "../models/tengaAgent/Agent"
  );

const Lead =
  require(
    "../models/tengaAgent/Lead"
  );

const Conversation =
  require(
    "../models/tengaAgent/Conversation"
  );

const {
  createOrUpdateOwnerWorkspace,
  listOwnerKnowledge,
  syncOwnerKnowledge,
} = require(
  "../services/tengaAgent/ownerWorkspaceService"
);

let mongod;
let app;

beforeAll(async () => {
  mongod =
    await MongoMemoryServer.create();

  await mongoose.connect(
    mongod.getUri()
  );

  app =
    express();

  app.use(
    express.json()
  );

  app.use(
    "/api/tengaagent/owner",
    routes
  );
});

beforeEach(async () => {
  await mongoose
    .connection
    .db
    .dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();

  if (mongod) {
    await mongod.stop();
  }
});

describe(
  "TengaAgent owner workspace",
  () => {
    it(
      "requires authenticated owner identity",
      async () => {
        await request(app)
          .get(
            "/api/tengaagent/owner/workspace"
          )
          .expect(401);
      }
    );

    it(
      "creates one stable private workspace and receptionist per owner",
      async () => {
        const userId =
          new mongoose
            .Types
            .ObjectId();

        const first =
          await createOrUpdateOwnerWorkspace({
            userId,

            name:
              "Acme Training Limited",

            industry:
              "Professional Training",

            countryCode:
              "NG",
          });

        const second =
          await createOrUpdateOwnerWorkspace({
            userId,

            name:
              "Acme Training Limited Updated",
          });

        expect(
          String(
            first.organization._id
          )
        ).toBe(
          String(
            second.organization._id
          )
        );

        expect(
          await Organization.countDocuments({
            ownerUser:
              userId,
          })
        ).toBe(1);

        expect(
          await Agent.countDocuments({
            organizationId:
              first.organization._id,

            key:
              "receptionist",
          })
        ).toBe(1);

        expect(
          second.agent.isPublicDemo
        ).toBe(false);

        expect(
          second.agent.status
        ).toBe(
          "draft"
        );
      }
    );

    it(
      "creates and reads the owner's workspace through the authenticated API",
      async () => {
        const userId =
          new mongoose
            .Types
            .ObjectId()
            .toString();

        const created =
          await request(app)
            .post(
              "/api/tengaagent/owner/workspace"
            )
            .set(
              "x-test-user-id",
              userId
            )
            .send({
              name:
                "Northstar Academy",

              industry:
                "Training",

              countryCode:
                "NG",

              timezone:
                "Africa/Lagos",
            })
            .expect(201);

        expect(
          created.body
        ).toEqual(
          expect.objectContaining({
            ok: true,
            created: true,
          })
        );

        expect(
          created.body.organization.name
        ).toBe(
          "Northstar Academy"
        );

        expect(
          created.body.agent.key
        ).toBe(
          "receptionist"
        );

        const fetched =
          await request(app)
            .get(
              "/api/tengaagent/owner/workspace"
            )
            .set(
              "x-test-user-id",
              userId
            )
            .expect(200);

        expect(
          fetched.body.organization.name
        ).toBe(
          "Northstar Academy"
        );
      }
    );

    it(
      "stores FAQ, service, and hours knowledge for the authenticated owner",
      async () => {
        const userId =
          new mongoose
            .Types
            .ObjectId();

        await createOrUpdateOwnerWorkspace({
          userId,

          name:
            "Northstar Academy",
        });

        const embedder =
          async (texts) =>
            texts.map(
              () => [
                1,
                0,
              ]
            );

        await syncOwnerKnowledge({
          userId,

          type:
            "faq",

          title:
            "Registration FAQ",

          text:
            "Registration opens every Monday.",

          embedder,
        });

        await syncOwnerKnowledge({
          userId,

          type:
            "service",

          title:
            "Data Analytics Course",

          text:
            "The Data Analytics course runs for eight weeks.",

          embedder,
        });

        await syncOwnerKnowledge({
          userId,

          type:
            "hours",

          title:
            "Business Hours",

          text:
            "The office is open Monday to Friday from 9 AM to 5 PM.",

          embedder,
        });

        const result =
          await listOwnerKnowledge({
            userId,
          });

        expect(
          result.sources
        ).toHaveLength(3);

        expect(
          new Set(
            result.sources.map(
              (source) =>
                source.type
            )
          )
        ).toEqual(
          new Set([
            "faq",
            "service",
            "hours",
          ])
        );
      }
    );

    it(
      "never exposes another owner's knowledge",
      async () => {
        const ownerA =
          new mongoose
            .Types
            .ObjectId();

        const ownerB =
          new mongoose
            .Types
            .ObjectId();

        await createOrUpdateOwnerWorkspace({
          userId:
            ownerA,

          name:
            "Owner A Business",
        });

        await createOrUpdateOwnerWorkspace({
          userId:
            ownerB,

          name:
            "Owner B Business",
        });

        const embedder =
          async (texts) =>
            texts.map(
              () => [
                1,
                0,
              ]
            );

        await syncOwnerKnowledge({
          userId:
            ownerA,

          type:
            "manual",

          title:
            "Owner A Fact",

          text:
            "This belongs only to owner A.",

          embedder,
        });

        await syncOwnerKnowledge({
          userId:
            ownerB,

          type:
            "manual",

          title:
            "Owner B Private Fact",

          text:
            "PRIVATE OWNER B KNOWLEDGE",

          embedder,
        });

        const resultA =
          await listOwnerKnowledge({
            userId:
              ownerA,
          });

        const serialized =
          JSON.stringify(
            resultA.sources
          );

        expect(
          serialized
        ).toContain(
          "Owner A Fact"
        );

        expect(
          serialized
        ).not.toContain(
          "Owner B Private Fact"
        );

        expect(
          serialized
        ).not.toContain(
          "PRIVATE OWNER B KNOWLEDGE"
        );
      }
    );

    it(
      "updates only a lead owned by the authenticated tenant",
      async () => {
        const ownerA =
          new mongoose
            .Types
            .ObjectId();
        const ownerB =
          new mongoose
            .Types
            .ObjectId();

        const orgA =
          await Organization.create({
            name:
              "Lead Owner A",
            slug:
              "lead-owner-a",
            ownerUser:
              ownerA,
            plan:
              "starter",
            status:
              "pilot",
          });

        const orgB =
          await Organization.create({
            name:
              "Lead Owner B",
            slug:
              "lead-owner-b",
            ownerUser:
              ownerB,
            plan:
              "starter",
            status:
              "pilot",
          });

        const agentA =
          await Agent.create({
            organizationId:
              orgA._id,
            key:
              "receptionist",
            name:
              "TengaAgent",
            status:
              "active",
          });

        const agentB =
          await Agent.create({
            organizationId:
              orgB._id,
            key:
              "receptionist",
            name:
              "TengaAgent",
            status:
              "active",
          });

        const conversationA =
          await Conversation.create({
            organizationId:
              orgA._id,
            agentId:
              agentA._id,
            sessionKey:
              "lead-owner-a-session",
          });

        const conversationB =
          await Conversation.create({
            organizationId:
              orgB._id,
            agentId:
              agentB._id,
            sessionKey:
              "lead-owner-b-session",
          });

        const leadA =
          await Lead.create({
            organizationId:
              orgA._id,
            agentId:
              agentA._id,
            conversationId:
              conversationA._id,
            sessionKey:
              "lead-owner-a-session",
            email:
              "owner-a@example.com",
            consentToContact:
              true,
          });

        const leadB =
          await Lead.create({
            organizationId:
              orgB._id,
            agentId:
              agentB._id,
            conversationId:
              conversationB._id,
            sessionKey:
              "lead-owner-b-session",
            email:
              "owner-b@example.com",
            consentToContact:
              true,
          });

        const updated =
          await request(app)
            .patch(
              `/api/tengaagent/owner/leads/${leadA._id}/status`
            )
            .set(
              "x-test-user-id",
              String(ownerA)
            )
            .send({
              status:
                "contacted",
            })
            .expect(200);

        expect(
          updated.body.lead.status
        ).toBe(
          "contacted"
        );

        await request(app)
          .patch(
            `/api/tengaagent/owner/leads/${leadB._id}/status`
          )
          .set(
            "x-test-user-id",
            String(ownerA)
          )
          .send({
            status:
              "won",
          })
          .expect(404);

        const untouchedB =
          await Lead.findById(
            leadB._id
          ).lean();

        expect(
          untouchedB.status
        ).toBe(
          "new"
        );
      }
    );
  }
);
