const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");

const {
  MongoMemoryServer,
} = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-appointment-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-appointment-test-secret";

jest.mock(
  "../middleware/auth",
  () =>
    (req, res, next) => {
      const userId =
        req.headers[
          "x-test-user-id"
        ];

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

require("../../apps/api/config/env");

const publicRoutes = require("../routes/tengaAgent");
const ownerRoutes = require("../routes/tengaAgentOwner");
const errorHandler = require(
  "../../apps/api/middleware/errorHandler"
);

const Organization = require(
  "../models/tengaAgent/Organization"
);
const Agent = require(
  "../models/tengaAgent/Agent"
);
const Conversation = require(
  "../models/tengaAgent/Conversation"
);
const Appointment = require(
  "../models/tengaAgent/Appointment"
);

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: {
      launchTimeout: 60000,
    },
  });

  await mongoose.connect(
    mongod.getUri(),
    {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    }
  );

  app = express();
  app.use(express.json());
  app.use(
    "/api/tengaagent/owner",
    ownerRoutes
  );
  app.use(
    "/api/tengaagent",
    publicRoutes
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

const createConversation = async (
  sessionId
) =>
  request(app)
    .post(
      "/api/tengaagent/chat/tengacion-demo/message"
    )
    .send({
      message:
        "I would like to book a meeting with the team.",
      sessionId,
    })
    .expect(200);

describe(
  "TengaAgent appointment requests",
  () => {
    it(
      "offers a booking action without claiming the appointment is confirmed",
      async () => {
        const response =
          await createConversation(
            "appointment-intent-001"
          );

        expect(
          response.body.actions
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type:
                "book_appointment",
            }),
          ])
        );

        expect(
          response.body.reply
        ).toMatch(
          /not confirmed until the team approves/i
        );
      }
    );

    it(
      "persists a future appointment request and marks the conversation for follow-up",
      async () => {
        const sessionId =
          "appointment-session-001";

        await createConversation(
          sessionId
        );

        const response =
          await request(app)
            .post(
              "/api/tengaagent/chat/tengacion-demo/appointment"
            )
            .send({
              sessionId,
              name: "Ada Visitor",
              email:
                "ADA@example.com",
              company:
                "Northstar Labs",
              purpose:
                "Discuss an AI receptionist.",
              preferredStartAt:
                "2030-01-10T10:00:00.000Z",
              timezone:
                "Africa/Lagos",
              durationMinutes: 30,
              consentToContact: true,
            })
            .expect(201);

        expect(
          response.body
        ).toEqual(
          expect.objectContaining({
            ok: true,
            appointment:
              expect.objectContaining({
                status:
                  "requested",
                timezone:
                  "Africa/Lagos",
                durationMinutes:
                  30,
              }),
            conversation:
              expect.objectContaining({
                status:
                  "handoff_requested",
              }),
          })
        );

        const appointments =
          await Appointment.find({})
            .lean();

        expect(appointments)
          .toHaveLength(1);
        expect(appointments[0])
          .toEqual(
            expect.objectContaining({
              name:
                "Ada Visitor",
              email:
                "ada@example.com",
              company:
                "Northstar Labs",
              status:
                "requested",
              consentToContact:
                true,
            })
          );

        const conversation =
          await Conversation.findOne({
            sessionKey: sessionId,
          }).lean();

        expect(
          conversation.status
        ).toBe(
          "handoff_requested"
        );
      }
    );

    it(
      "rejects appointment requests without contact consent or a future time",
      async () => {
        const sessionId =
          "appointment-session-002";

        await createConversation(
          sessionId
        );

        await request(app)
          .post(
            "/api/tengaagent/chat/tengacion-demo/appointment"
          )
          .send({
            sessionId,
            email:
              "visitor@example.com",
            preferredStartAt:
              "2030-01-10T10:00:00.000Z",
            timezone:
              "Africa/Lagos",
            consentToContact: false,
          })
          .expect(400);

        await request(app)
          .post(
            "/api/tengaagent/chat/tengacion-demo/appointment"
          )
          .send({
            sessionId,
            preferredStartAt:
              "2030-01-10T10:00:00.000Z",
            timezone:
              "Africa/Lagos",
            consentToContact: true,
          })
          .expect(400);

        await request(app)
          .post(
            "/api/tengaagent/chat/tengacion-demo/appointment"
          )
          .send({
            sessionId,
            email:
              "visitor@example.com",
            preferredStartAt:
              "2020-01-10T10:00:00.000Z",
            timezone:
              "Africa/Lagos",
            consentToContact: true,
          })
          .expect(400);
      }
    );

    it(
      "lists and updates only the authenticated owner's appointments",
      async () => {
        const ownerA =
          new mongoose.Types.ObjectId();
        const ownerB =
          new mongoose.Types.ObjectId();

        const orgA =
          await Organization.create({
            name:
              "Owner A Business",
            slug:
              "appointment-owner-a",
            ownerUser:
              ownerA,
            plan: "starter",
            status: "pilot",
          });

        const orgB =
          await Organization.create({
            name:
              "Owner B Business",
            slug:
              "appointment-owner-b",
            ownerUser:
              ownerB,
            plan: "starter",
            status: "pilot",
          });

        const agentA =
          await Agent.create({
            organizationId:
              orgA._id,
            key: "receptionist",
            name: "TengaAgent",
            status: "active",
          });

        const agentB =
          await Agent.create({
            organizationId:
              orgB._id,
            key: "receptionist",
            name: "TengaAgent",
            status: "active",
          });

        const conversationA =
          await Conversation.create({
            organizationId:
              orgA._id,
            agentId:
              agentA._id,
            sessionKey:
              "appointment-owner-a-session",
          });

        const conversationB =
          await Conversation.create({
            organizationId:
              orgB._id,
            agentId:
              agentB._id,
            sessionKey:
              "appointment-owner-b-session",
          });

        const appointmentA =
          await Appointment.create({
            organizationId:
              orgA._id,
            agentId:
              agentA._id,
            conversationId:
              conversationA._id,
            sessionKey:
              "appointment-owner-a-session",
            email:
              "a@example.com",
            preferredStartAt:
              "2030-01-10T10:00:00.000Z",
            timezone:
              "Africa/Lagos",
            consentToContact: true,
          });

        const appointmentB =
          await Appointment.create({
            organizationId:
              orgB._id,
            agentId:
              agentB._id,
            conversationId:
              conversationB._id,
            sessionKey:
              "appointment-owner-b-session",
            email:
              "b@example.com",
            preferredStartAt:
              "2030-01-11T10:00:00.000Z",
            timezone:
              "Africa/Lagos",
            consentToContact: true,
          });

        const listResponse =
          await request(app)
            .get(
              "/api/tengaagent/owner/appointments"
            )
            .set(
              "x-test-user-id",
              String(ownerA)
            )
            .expect(200);

        expect(
          listResponse.body.appointments
        ).toHaveLength(1);
        expect(
          listResponse.body.appointments[0].email
        ).toBe(
          "a@example.com"
        );

        const updated =
          await request(app)
            .patch(
              `/api/tengaagent/owner/appointments/${appointmentA._id}/status`
            )
            .set(
              "x-test-user-id",
              String(ownerA)
            )
            .send({
              status: "confirmed",
            })
            .expect(200);

        expect(
          updated.body.appointment.status
        ).toBe(
          "confirmed"
        );

        await request(app)
          .patch(
            `/api/tengaagent/owner/appointments/${appointmentB._id}/status`
          )
          .set(
            "x-test-user-id",
            String(ownerA)
          )
          .send({
            status: "confirmed",
          })
          .expect(404);

        const untouchedB =
          await Appointment.findById(
            appointmentB._id
          ).lean();

        expect(
          untouchedB.status
        ).toBe(
          "requested"
        );
      }
    );
  }
);
