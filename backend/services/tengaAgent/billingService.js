const Agent = require("../../models/tengaAgent/Agent");
const Organization = require("../../models/tengaAgent/Organization");
const Subscription = require("../../models/tengaAgent/Subscription");
const Usage = require("../../models/tengaAgent/Usage");
const {
  getTengaAgentPlanEntitlements,
} = require("../../config/tengaAgentPlans");

const ACCESS_STATUSES = new Set(["trialing", "active"]);
const USAGE_METRICS = new Set([
  "conversationsStarted",
  "customerMessages",
  "aiReplies",
  "whatsappInboundMessages",
  "whatsappOutboundMessages",
  "voiceNotes",
]);

class TengaAgentBillingError extends Error {
  constructor(message, code, status = 402) {
    super(message);
    this.name = "TengaAgentBillingError";
    this.code = code;
    this.status = status;
  }
}

const getPeriodKey = (date = new Date()) => {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    throw new Error("Invalid TengaAgent usage date.");
  }

  return `${value.getUTCFullYear()}-${String(
    value.getUTCMonth() + 1
  ).padStart(2, "0")}`;
};

const resolveOrganization = async (organizationOrId) => {
  if (organizationOrId && typeof organizationOrId === "object" && organizationOrId._id) {
    return organizationOrId;
  }

  if (!organizationOrId) {
    return null;
  }

  return Organization.findById(organizationOrId);
};

const ensureSubscriptionForOrganization = async (organizationOrId) => {
  const organization = await resolveOrganization(organizationOrId);
  if (!organization) {
    return null;
  }

  let subscription = await Subscription.findOne({
    organizationId: organization._id,
  });

  if (subscription) {
    return subscription;
  }

  const initialStatus =
    organization.plan === "internal" || organization.status === "active"
      ? "active"
      : "trialing";

  try {
    subscription = await Subscription.create({
      organizationId: organization._id,
      planCode: organization.plan,
      status: initialStatus,
      billingProvider: "manual",
    });
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    subscription = await Subscription.findOne({
      organizationId: organization._id,
    });
  }

  return subscription;
};

const getBillingAccess = async (organizationOrId) => {
  const organization = await resolveOrganization(organizationOrId);
  if (!organization) {
    return {
      allowed: false,
      organization: null,
      subscription: null,
      entitlements: null,
      reason: "organization_missing",
    };
  }

  if (!["pilot", "active"].includes(organization.status)) {
    return {
      allowed: false,
      organization,
      subscription: null,
      entitlements: getTengaAgentPlanEntitlements(organization.plan),
      reason: "organization_inactive",
    };
  }

  const subscription = await ensureSubscriptionForOrganization(organization);
  if (!subscription) {
    return {
      allowed: false,
      organization,
      subscription: null,
      entitlements: null,
      reason: "subscription_missing",
    };
  }

  const entitlements = getTengaAgentPlanEntitlements(subscription.planCode);
  const allowed =
    organization.plan === "internal" || ACCESS_STATUSES.has(subscription.status);

  return {
    allowed,
    organization,
    subscription,
    entitlements,
    reason: allowed ? null : `subscription_${subscription.status}`,
  };
};

const assertSubscriptionAccess = async (organizationOrId) => {
  const access = await getBillingAccess(organizationOrId);
  if (!access.allowed) {
    throw new TengaAgentBillingError(
      "TengaAgent is unavailable because this subscription is not active.",
      "TENGAAGENT_SUBSCRIPTION_INACTIVE"
    );
  }

  return access;
};

const assertFeatureAccess = async ({ organization, feature }) => {
  const access = await assertSubscriptionAccess(organization);
  if (!Object.prototype.hasOwnProperty.call(access.entitlements, feature)) {
    throw new TengaAgentBillingError(
      "Unsupported TengaAgent feature entitlement.",
      "TENGAAGENT_FEATURE_UNKNOWN",
      500
    );
  }

  if (access.entitlements[feature] !== true) {
    throw new TengaAgentBillingError(
      `The ${feature} feature is not included in the current TengaAgent plan.`,
      "TENGAAGENT_FEATURE_NOT_INCLUDED"
    );
  }

  return access;
};

const getCurrentUsage = async (organizationId, date = new Date()) => {
  const periodKey = getPeriodKey(date);
  const usage = await Usage.findOne({ organizationId, periodKey }).lean();

  return (
    usage || {
      organizationId,
      periodKey,
      conversationsStarted: 0,
      customerMessages: 0,
      aiReplies: 0,
      whatsappInboundMessages: 0,
      whatsappOutboundMessages: 0,
      voiceNotes: 0,
    }
  );
};

const recordUsage = async ({
  organizationId,
  metric,
  amount = 1,
  date = new Date(),
}) => {
  if (!USAGE_METRICS.has(metric)) {
    throw new Error("Unsupported TengaAgent usage metric.");
  }

  const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (!organizationId || safeAmount === 0) {
    return getCurrentUsage(organizationId, date);
  }

  const periodKey = getPeriodKey(date);
  return Usage.findOneAndUpdate(
    { organizationId, periodKey },
    {
      $setOnInsert: { organizationId, periodKey },
      $inc: { [metric]: safeAmount },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    }
  );
};

const incrementConversationWithinLimit = async ({
  organizationId,
  periodKey,
  limit,
}) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existing = await Usage.findOne({ organizationId, periodKey })
      .select("_id conversationsStarted")
      .lean();

    if (!existing) {
      try {
        return await Usage.create({
          organizationId,
          periodKey,
          conversationsStarted: 1,
        });
      } catch (error) {
        if (error?.code === 11000) {
          continue;
        }
        throw error;
      }
    }

    const updated = await Usage.findOneAndUpdate(
      {
        _id: existing._id,
        conversationsStarted: { $lt: limit },
      },
      { $inc: { conversationsStarted: 1 } },
      { returnDocument: "after" }
    );

    if (updated) {
      return updated;
    }

    throw new TengaAgentBillingError(
      "The monthly TengaAgent conversation allowance has been reached.",
      "TENGAAGENT_CONVERSATION_LIMIT_REACHED"
    );
  }

  throw new TengaAgentBillingError(
    "TengaAgent could not reserve conversation capacity safely.",
    "TENGAAGENT_USAGE_RESERVATION_FAILED",
    503
  );
};

const reserveConversationStart = async ({
  organization,
  date = new Date(),
}) => {
  const access = await assertSubscriptionAccess(organization);
  const limit = access.entitlements.monthlyConversations;
  const periodKey = getPeriodKey(date);

  if (limit === null) {
    return recordUsage({
      organizationId: access.organization._id,
      metric: "conversationsStarted",
      date,
    });
  }

  return incrementConversationWithinLimit({
    organizationId: access.organization._id,
    periodKey,
    limit,
  });
};

const releaseConversationStart = async ({
  organizationId,
  date = new Date(),
}) => {
  if (!organizationId) {
    return null;
  }

  return Usage.findOneAndUpdate(
    {
      organizationId,
      periodKey: getPeriodKey(date),
      conversationsStarted: { $gt: 0 },
    },
    { $inc: { conversationsStarted: -1 } },
    { returnDocument: "after" }
  );
};

const assertAgentCapacity = async ({ organization, additional = 1 }) => {
  const access = await assertSubscriptionAccess(organization);
  const limit = access.entitlements.agents;
  if (limit === null) {
    return access;
  }

  const existingCount = await Agent.countDocuments({
    organizationId: access.organization._id,
    status: { $ne: "retired" },
  });

  if (existingCount + Math.max(1, Number(additional) || 1) > limit) {
    throw new TengaAgentBillingError(
      "The current TengaAgent plan has reached its agent limit.",
      "TENGAAGENT_AGENT_LIMIT_REACHED"
    );
  }

  return access;
};

const getBillingSummary = async (organizationOrId) => {
  const access = await getBillingAccess(organizationOrId);
  if (!access.organization || !access.subscription || !access.entitlements) {
    return null;
  }

  const [usage, agentsUsed] = await Promise.all([
    getCurrentUsage(access.organization._id),
    Agent.countDocuments({
      organizationId: access.organization._id,
      status: { $ne: "retired" },
    }),
  ]);

  const conversationLimit = access.entitlements.monthlyConversations;
  const conversationsRemaining =
    conversationLimit === null
      ? null
      : Math.max(0, conversationLimit - Number(usage.conversationsStarted || 0));

  return {
    allowed: access.allowed,
    reason: access.reason,
    planCode: access.subscription.planCode,
    subscriptionStatus: access.subscription.status,
    billingProvider: access.subscription.billingProvider,
    currentPeriodStart: access.subscription.currentPeriodStart,
    currentPeriodEnd: access.subscription.currentPeriodEnd,
    cancelAtPeriodEnd: access.subscription.cancelAtPeriodEnd,
    entitlements: access.entitlements,
    usage: {
      periodKey: usage.periodKey,
      conversationsStarted: Number(usage.conversationsStarted || 0),
      conversationsRemaining,
      customerMessages: Number(usage.customerMessages || 0),
      aiReplies: Number(usage.aiReplies || 0),
      whatsappInboundMessages: Number(usage.whatsappInboundMessages || 0),
      whatsappOutboundMessages: Number(usage.whatsappOutboundMessages || 0),
      voiceNotes: Number(usage.voiceNotes || 0),
      agentsUsed,
    },
  };
};

module.exports = {
  ACCESS_STATUSES,
  TengaAgentBillingError,
  USAGE_METRICS,
  assertAgentCapacity,
  assertFeatureAccess,
  assertSubscriptionAccess,
  ensureSubscriptionForOrganization,
  getBillingAccess,
  getBillingSummary,
  getCurrentUsage,
  getPeriodKey,
  recordUsage,
  releaseConversationStart,
  reserveConversationStart,
};
