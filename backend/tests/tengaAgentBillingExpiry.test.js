const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-billing-expiry-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-billing-expiry-test-secret-not-for-production";

require("../../apps/api/config/env");

const Organization = require("../models/tengaAgent/Organization");
const Subscription = require("../models/tengaAgent/Subscription");
const {
  assertSubscriptionAccess,
  getBillingAccess,
  isPrepaidPeriodExpired,
} = require("../services/tengaAgent/billingService");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });

  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });
});

beforeEach(async () => {
  await Promise.all([
    Organization.deleteMany({}),
    Subscription.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

const createStarterOrganization = () =>
  Organization.create({
    name: "Prepaid Billing Limited",
    slug: `prepaid-billing-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    plan: "starter",
    status: "active",
  });

describe("TengaAgent prepaid billing expiry", () => {
  it("keeps an active prepaid subscription available before its period end", async () => {
    const organization = await createStarterOrganization();
    const now = new Date("2026-09-17T12:00:00.000Z");

    const subscription = await Subscription.create({
      organizationId: organization._id,
      planCode: "starter",
      status: "active",
      billingProvider: "paystack",
      renewalMode: "prepaid",
      currentPeriodStart: new Date("2026-09-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z"),
      cancelAtPeriodEnd: true,
    });

    expect(isPrepaidPeriodExpired(subscription, now)).toBe(false);

    const access = await getBillingAccess(organization, now);
    expect(access.allowed).toBe(true);
    expect(access.reason).toBeNull();
  });

  it("denies an active prepaid subscription once its paid period has ended", async () => {
    const organization = await createStarterOrganization();
    const now = new Date("2026-09-17T12:00:00.000Z");

    const subscription = await Subscription.create({
      organizationId: organization._id,
      planCode: "starter",
      status: "active",
      billingProvider: "paystack",
      renewalMode: "prepaid",
      currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
      cancelAtPeriodEnd: true,
    });

    expect(isPrepaidPeriodExpired(subscription, now)).toBe(true);

    const access = await getBillingAccess(organization, now);
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe("subscription_expired");
  });

  it("fails closed when a prepaid subscription has no paid period end", async () => {
    const organization = await createStarterOrganization();

    await Subscription.create({
      organizationId: organization._id,
      planCode: "starter",
      status: "active",
      billingProvider: "stripe",
      renewalMode: "prepaid",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: true,
    });

    const access = await getBillingAccess(organization);
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe("subscription_expired");

    await expect(assertSubscriptionAccess(organization)).rejects.toMatchObject({
      code: "TENGAAGENT_SUBSCRIPTION_EXPIRED",
      status: 402,
    });
  });

  it("does not impose prepaid expiry rules on active manual subscriptions", async () => {
    const organization = await createStarterOrganization();

    await Subscription.create({
      organizationId: organization._id,
      planCode: "starter",
      status: "active",
      billingProvider: "manual",
      renewalMode: "manual",
      currentPeriodEnd: null,
    });

    const access = await getBillingAccess(organization);
    expect(access.allowed).toBe(true);
    expect(access.reason).toBeNull();
  });
});
