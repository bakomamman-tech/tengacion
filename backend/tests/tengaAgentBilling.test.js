const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Agent = require("../models/tengaAgent/Agent");
const Organization = require("../models/tengaAgent/Organization");
const Subscription = require("../models/tengaAgent/Subscription");
const Usage = require("../models/tengaAgent/Usage");
const {
  TengaAgentBillingError,
  assertAgentCapacity,
  assertFeatureAccess,
  ensureSubscriptionForOrganization,
  getBillingSummary,
  getCurrentUsage,
  recordUsage,
  reserveConversationStart,
} = require("../services/tengaAgent/billingService");

let mongod;

const createOrganization = async ({
  slug,
  plan = "starter",
  status = "pilot",
}) =>
  Organization.create({
    name: `${slug} Limited`,
    slug,
    plan,
    status,
  });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });

  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });

  await Promise.all([
    Agent.syncIndexes(),
    Organization.syncIndexes(),
    Subscription.syncIndexes(),
    Usage.syncIndexes(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    Agent.deleteMany({}),
    Organization.deleteMany({}),
    Subscription.deleteMany({}),
    Usage.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe("TengaAgent billing foundation", () => {
  it("provisions an explicit subscription from the tenant plan", async () => {
    const organization = await createOrganization({
      slug: "starter-pilot",
      plan: "starter",
      status: "pilot",
    });

    const subscription = await ensureSubscriptionForOrganization(
      organization
    );

    expect(subscription).toEqual(
      expect.objectContaining({
        planCode: "starter",
        status: "trialing",
        billingProvider: "manual",
      })
    );

    const summary = await getBillingSummary(organization);
    expect(summary).toEqual(
      expect.objectContaining({
        allowed: true,
        planCode: "starter",
        subscriptionStatus: "trialing",
        entitlements: expect.objectContaining({
          agents: 1,
          monthlyConversations: 300,
          whatsapp: false,
          voice: false,
        }),
      })
    );
  });

  it("fails closed when a subscription is suspended", async () => {
    const organization = await createOrganization({
      slug: "suspended-business",
      plan: "business",
      status: "active",
    });

    const subscription = await ensureSubscriptionForOrganization(
      organization
    );
    subscription.status = "suspended";
    await subscription.save();

    await expect(
      assertFeatureAccess({
        organization,
        feature: "whatsapp",
      })
    ).rejects.toMatchObject({
      code: "TENGAAGENT_SUBSCRIPTION_INACTIVE",
      status: 402,
    });
  });

  it("enforces channel feature gates from one canonical plan catalog", async () => {
    const starter = await createOrganization({
      slug: "starter-features",
      plan: "starter",
      status: "active",
    });
    const growth = await createOrganization({
      slug: "growth-features",
      plan: "growth",
      status: "active",
    });

    await expect(
      assertFeatureAccess({
        organization: starter,
        feature: "whatsapp",
      })
    ).rejects.toBeInstanceOf(TengaAgentBillingError);

    await expect(
      assertFeatureAccess({
        organization: starter,
        feature: "voice",
      })
    ).rejects.toBeInstanceOf(TengaAgentBillingError);

    await expect(
      assertFeatureAccess({
        organization: growth,
        feature: "whatsapp",
      })
    ).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );

    await expect(
      assertFeatureAccess({
        organization: growth,
        feature: "voice",
      })
    ).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
  });

  it("reserves monthly conversation capacity atomically at the plan limit", async () => {
    const organization = await createOrganization({
      slug: "solo-cap",
      plan: "solo",
      status: "active",
    });

    await ensureSubscriptionForOrganization(organization);

    await Usage.create({
      organizationId: organization._id,
      periodKey: new Date().toISOString().slice(0, 7),
      conversationsStarted: 99,
    });

    await reserveConversationStart({ organization });

    const usage = await getCurrentUsage(organization._id);
    expect(usage.conversationsStarted).toBe(100);

    await expect(
      reserveConversationStart({ organization })
    ).rejects.toMatchObject({
      code: "TENGAAGENT_CONVERSATION_LIMIT_REACHED",
      status: 402,
    });
  });

  it("enforces the active agent cap", async () => {
    const organization = await createOrganization({
      slug: "agent-cap",
      plan: "starter",
      status: "active",
    });

    await ensureSubscriptionForOrganization(organization);
    await Agent.create({
      organizationId: organization._id,
      key: "receptionist",
      name: "TengaAgent",
      status: "active",
    });

    await expect(
      assertAgentCapacity({ organization })
    ).rejects.toMatchObject({
      code: "TENGAAGENT_AGENT_LIMIT_REACHED",
      status: 402,
    });
  });

  it("tracks monthly channel and AI usage for the owner summary", async () => {
    const organization = await createOrganization({
      slug: "usage-summary",
      plan: "growth",
      status: "active",
    });

    await ensureSubscriptionForOrganization(organization);

    await recordUsage({
      organizationId: organization._id,
      metric: "customerMessages",
      amount: 4,
    });
    await recordUsage({
      organizationId: organization._id,
      metric: "aiReplies",
      amount: 3,
    });
    await recordUsage({
      organizationId: organization._id,
      metric: "whatsappInboundMessages",
      amount: 2,
    });
    await recordUsage({
      organizationId: organization._id,
      metric: "voiceNotes",
      amount: 1,
    });

    const summary = await getBillingSummary(organization);

    expect(summary.usage).toEqual(
      expect.objectContaining({
        customerMessages: 4,
        aiReplies: 3,
        whatsappInboundMessages: 2,
        voiceNotes: 1,
        conversationsStarted: 0,
        conversationsRemaining: 1500,
      })
    );
  });
});
