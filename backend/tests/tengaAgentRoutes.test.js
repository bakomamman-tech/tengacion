const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");

const {
  MongoMemoryServer,
} = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-test";

process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-local-test-secret-not-for-production";

require("../../apps/api/config/env");

const routes =
  require("../routes/tengaAgent");

const errorHandler =
  require("../../apps/api/middleware/errorHandler");

const Organization =
  require("../models/tengaAgent/Organization");

const Agent =
  require("../models/tengaAgent/Agent");

const Conversation =
  require("../models/tengaAgent/Conversation");

const Message =
  require("../models/tengaAgent/Message");

let mongod;
let app;

beforeAll(async () => {
  mongod =
    await MongoMemoryServer.create({
      instance: {
        launchTimeout: 60000,
      },
    });

  await mongoose.connect(
    mongod.getUri(),
    {
      serverSelectionTimeoutMS:
        60000,

      socketTimeoutMS:
        60000,
    }
  );

  app = express();

  app.use(express.json());

  app.use(
    "/api/tengaagent",
    routes
  );

  app.use(errorHandler);
});

beforeEach(async () => {
  await mongoose.connection.db
    .dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();

  if (mongod) {
    await mongod.stop();
  }
});

describe(
  "TengaAgent MVP routes",
  () => {
    it(
      "creates Tengacion Customer #0 and persists a safe web conversation",
      async () => {
        const response =
          await request(app)
            .post(
              "/api/tengaagent/chat/tengacion-demo/message"
            )
            .send({
              message:
                "Hello, I need a website. How much does it cost?",
              sessionId:
                "test-session-001",
            })
            .expect(200);

        expect(
          response.body
        ).toEqual(
          expect.objectContaining({
            ok: true,

            sessionId:
              "test-session-001",

            agent:
              expect.objectContaining({
                key:
                  "tengacion-demo",

                name:
                  "TengaAgent",
              }),
          })
        );

        expect(
          response.body.reply
        ).toEqual(
          expect.any(String)
        );

        const organization =
          await Organization.findOne({
            slug: "tengacion",
          }).lean();

        expect(
          organization
        ).toEqual(
          expect.objectContaining({
            name:
              "Tengacion Technologies Limited",

            plan:
              "internal",

            status:
              "active",
          })
        );

        const agent =
          await Agent.findOne({
            organizationId:
              organization._id,

            key:
              "tengacion-demo",
          }).lean();

        expect(
          agent.isPublicDemo
        ).toBe(true);

        const conversations =
          await Conversation.find({
            organizationId:
              organization._id,
          }).lean();

        expect(
          conversations
        ).toHaveLength(1);

        const messages =
          await Message.find({
            conversationId:
              conversations[0]._id,
          })
            .sort({
              createdAt: 1,
            })
            .lean();

        expect(
          messages
        ).toHaveLength(2);

        expect(
          messages.map(
            (entry) =>
              entry.sender
          )
        ).toEqual([
          "customer",
          "agent",
        ]);
      }
    );

    it(
      "continues the same conversation when the web session id is reused",
      async () => {
        const sessionId =
          "returning-visitor-001";

        await request(app)
          .post(
            "/api/tengaagent/chat/tengacion-demo/message"
          )
          .send({
            message:
              "Hello",
            sessionId,
          })
          .expect(200);

        await request(app)
          .post(
            "/api/tengaagent/chat/tengacion-demo/message"
          )
          .send({
            message:
              "Do you work on AI?",
            sessionId,
          })
          .expect(200);

        const conversations =
          await Conversation.find({
            sessionKey:
              sessionId,
          }).lean();

        expect(
          conversations
        ).toHaveLength(1);

        const messages =
          await Message.countDocuments({
            conversationId:
              conversations[0]._id,
          });

        expect(messages)
          .toBe(4);
      }
    );

    it(
      "rejects unknown public agents and invalid messages",
      async () => {
        await request(app)
          .post(
            "/api/tengaagent/chat/not-a-real-agent/message"
          )
          .send({
            message: "Hello",
          })
          .expect(404);

        await request(app)
          .post(
            "/api/tengaagent/chat/tengacion-demo/message"
          )
          .send({
            message: "   ",
          })
          .expect(400);

        await request(app)
          .post(
            "/api/tengaagent/chat/tengacion-demo/message"
          )
          .send({
            message:
              "x".repeat(2001),
          })
          .expect(400);
      }
    );
  }
);
