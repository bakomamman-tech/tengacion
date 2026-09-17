const TENGAAGENT_PLAN_ENTITLEMENTS = Object.freeze({
  internal: Object.freeze({
    agents: null,
    monthlyConversations: null,
    whatsapp: true,
    voice: true,
  }),
  solo: Object.freeze({
    agents: 1,
    monthlyConversations: 100,
    whatsapp: false,
    voice: false,
  }),
  starter: Object.freeze({
    agents: 1,
    monthlyConversations: 300,
    whatsapp: false,
    voice: false,
  }),
  growth: Object.freeze({
    agents: 3,
    monthlyConversations: 1500,
    whatsapp: true,
    voice: true,
  }),
  business: Object.freeze({
    agents: 10,
    monthlyConversations: 5000,
    whatsapp: true,
    voice: true,
  }),
  enterprise: Object.freeze({
    agents: null,
    monthlyConversations: null,
    whatsapp: true,
    voice: true,
  }),
});

const TENGAAGENT_PLAN_CODES = Object.freeze(
  Object.keys(TENGAAGENT_PLAN_ENTITLEMENTS)
);

const getTengaAgentPlanEntitlements = (planCode) => {
  const normalized = String(planCode || "")
    .trim()
    .toLowerCase();

  const entitlements = TENGAAGENT_PLAN_ENTITLEMENTS[normalized];
  if (!entitlements) {
    const error = new Error("Unsupported TengaAgent billing plan.");
    error.code = "TENGAAGENT_PLAN_UNSUPPORTED";
    error.status = 500;
    throw error;
  }

  return entitlements;
};

module.exports = {
  TENGAAGENT_PLAN_CODES,
  TENGAAGENT_PLAN_ENTITLEMENTS,
  getTengaAgentPlanEntitlements,
};
