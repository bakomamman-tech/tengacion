process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-public-agent-test";
process.env.JWT_SECRET =
  "tengaagent-public-agent-test-secret";
process.env.OPENAI_API_KEY = "";

const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const {
  MongoMemoryServer,
} = require("mongodb-memory-server");

const publicRoutes = require(
  "../routes/tengaAgentPublic"
);
const Conversation = require(
  "../models/tengaAgent/Conversation"
);
const Lead = require(
  "../models/tengaAgent/Lead"
);
const Appointment = require(
  "../models/tengaAgent/Appointment"
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

const createWorkspace = async (name) => {
  const userId = new mongoose.Types.ObjectId();
  const workspace =
    await createOrUpdateOwnerWorkspace({
      userId,
      name,
      industry: "Professional Services",
      countryCode: "NG",
      timezone: "Africa/Lagos",
    });

  return {
    userId,
    ...workspace,
  };
};

const publicPath = (workspace) =>
  `/api/tengaagent/public/${workspace.organization.slug}/${workspace.agent.key}`;

describe("TengaAgent multi-tenant public agents", () => {
  it("keeps draft agents private, publishes explicitly, and revokes access when paused", async () => {
    const owner = await createWorkspace(
      "Northstar Academy"
    );

    await request(app)
      .get(publicPath(owner))
      .expect(404);

    const published =
      await setOwnerAgentPublication({
        userId: owner.userId,
        published: true,
      });

    expect(published.agent.status).toBe("active");
    expect(published.agent.enabledTools).toEqual(
      expect.arrayContaining([
        "lead_capture",
        "appointment_requests",
      ])
    );

    const visible = await request(app)
      .get(publicPath(published))
      .expect(200);

    expect(visible.body).toEqual(
      expect.objectContaining({
        ok: true,
        organization: expect.objectContaining({
          name: "Northstar Academy",
          slug: published.organization.slug,
        }),
        agent: expect.objectContaining({
          key: "receptionist",
          name: "TengaAgent",
        }),
      })
    );

    await setOwnerAgentPublication({
      userId: owner.userId,
      published: false,
    });

    await request(app)
      .get(publicPath(published))
      .expect(404);
  });

  it("keeps conversations and leads isolated even when tenants reuse the same session key", async () => {
    const ownerA = await createWorkspace(
      "Alpha Consulting"
    );
    const ownerB = await createWorkspace(
      "Beta Consulting"
    );

    const publishedA =
      await setOwnerAgentPublication({
        userId: ownerA.userId,
        published: true,
      });
    const publishedB =
      await setOwnerAgentPublication({
        userId: ownerB.userId,
        published: true,
      });

    const sessionId = "same-browser-session";

    const responseA = await request(app)
      .post(`${publicPath(publishedA)}/message`)
      .send({
        sessionId,
        message: "I want to speak with someone",
      })
      .expect(200);

    const responseB = await request(app)
      .post(`${publicPath(publishedB)}/message`)
      .send({
        sessionId,
        message: "I want to speak with someone",
      })
      .expect(200);

    expect(responseA.body.actions).toEqual([
      expect.objectContaining({
        type: "capture_lead",
      }),
    ]);
    expect(responseB.body.actions).toEqual([
      expect.objectContaining({
        type: "capture_lead",
      }),
    ]);

    expect(
      String(responseA.body.conversationId)
    ).not.toBe(
      String(responseB.body.conversationId)
    );

    await request(app)
      .post(`${publicPath(publishedA)}/lead`)
      .send({
        sessionId,
        name: "Alpha Visitor",
        email: "alpha@example.com",
        projectSummary: "Alpha-only enquiry",
        consentToContact: true,
      })
      .expect(201);

    await request(app)
      .post(`${publicPath(publishedB)}/lead`)
      .send({
        sessionId,
        name: "Beta Visitor",
        email: "beta@example.com",
        projectSummary: "Beta-only enquiry",
        consentToContact: true,
      })
      .expect(201);

    const conversations =
      await Conversation.find({
        sessionKey: sessionId,
      }).lean();
    expect(conversations).toHaveLength(2);

    const alphaLeads = await Lead.find({
      organizationId:
        publishedA.organization._id,
    }).lean();
    const betaLeads = await Lead.find({
      organizationId:
        publishedB.organization._id,
    }).lean();

    expect(alphaLeads).toHaveLength(1);
    expect(alphaLeads[0].email).toBe(
      "alpha@example.com"
    );
    expect(
      JSON.stringify(alphaLeads)
    ).not.toContain("beta@example.com");

    expect(betaLeads).toHaveLength(1);
    expect(betaLeads[0].email).toBe(
      "beta@example.com"
    );
    expect(
      JSON.stringify(betaLeads)
    ).not.toContain("alpha@example.com");
  });

  it("creates appointment requests only inside the resolved public tenant", async () => {
    const ownerA = await createWorkspace(
      "Alpha Appointments"
    );
    const ownerB = await createWorkspace(
      "Beta Appointments"
    );

    const publishedA =
      await setOwnerAgentPublication({
        userId: ownerA.userId,
        published: true,
      });
    const publishedB =
      await setOwnerAgentPublication({
        userId: ownerB.userId,
        published: true,
      });

    const sessionId = "appointment-session";

    const intent = await request(app)
      .post(`${publicPath(publishedA)}/message`)
      .send({
        sessionId,
        message: "I want to book a meeting",
      })
      .expect(200);

    expect(intent.body.actions).toEqual([
      expect.objectContaining({
        type: "book_appointment",
      }),
    ]);

    await request(app)
      .post(`${publicPath(publishedA)}/appointment`)
      .send({
        sessionId,
        name: "Meeting Visitor",
        email: "meeting@example.com",
        purpose: "Product discussion",
        preferredStartAt:
          "2030-01-10T10:00:00.000Z",
        timezone: "Africa/Lagos",
        durationMinutes: 30,
        consentToContact: true,
      })
      .expect(201);

    expect(
      await Appointment.countDocuments({
        organizationId:
          publishedA.organization._id,
      })
    ).toBe(1);

    expect(
      await Appointment.countDocuments({
        organizationId:
          publishedB.organization._id,
      })
    ).toBe(0);
  });

  it("does not resolve another tenant when the organization slug and agent key do not match", async () => {
    const ownerA = await createWorkspace(
      "Alpha Boundary"
    );
    const ownerB = await createWorkspace(
      "Beta Boundary"
    );

    const publishedA =
      await setOwnerAgentPublication({
        userId: ownerA.userId,
        published: true,
      });
    const publishedB =
      await setOwnerAgentPublication({
        userId: ownerB.userId,
        published: true,
      });

    await request(app)
      .get(
        `/api/tengaagent/public/${publishedA.organization.slug}/${publishedB.agent.key}-wrong`
      )
      .expect(404);

    const alpha = await request(app)
      .get(publicPath(publishedA))
      .expect(200);

    expect(alpha.body.organization.name).toBe(
      "Alpha Boundary"
    );
  });
});
