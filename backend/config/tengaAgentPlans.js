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

const TENGAAGENT_PLAN_PRICING = Object.freeze({
  solo: Object.freeze({
    NGN: 9900,
  }),
  starter: Object.freeze({
    NGN: 19900,
    USD: 49,
  }),
  growth: Object.freeze({
    NGN: 59900,
    USD: 149,
  }),
  business: Object.freeze({
    NGN: 149900,
    USD: 399,
  }),
});

const TENGAAGENT_PLAN_CODES = Object.freeze(
  Object.keys(TENGAAGENT_PLAN_ENTITLEMENTS)
);

const TENGAAGENT_SELF_SERVICE_PLAN_CODES = Object.freeze(
  Object.keys(TENGAAGENT_PLAN_PRICING)
);

const toPlanLabel = (planCode) =>
  String(planCode || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

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

const getTengaAgentPlanPrice = (planCode, currency) => {
  const normalizedPlan = String(planCode || "")
    .trim()
    .toLowerCase();
  const normalizedCurrency = String(currency || "")
    .trim()
    .toUpperCase();

  const planPricing = TENGAAGENT_PLAN_PRICING[normalizedPlan];
  if (!planPricing) {
    const error = new Error(
      "This TengaAgent plan is not available for self-service checkout."
    );
    error.code = "TENGAAGENT_PLAN_NOT_SELF_SERVICE";
    error.status = 400;
    throw error;
  }

  const amount = planPricing[normalizedCurrency];
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error(
      `The ${normalizedPlan} TengaAgent plan is not available in ${normalizedCurrency || "that currency"}.`
    );
    error.code = "TENGAAGENT_PLAN_CURRENCY_UNAVAILABLE";
    error.status = 400;
    throw error;
  }

  return amount;
};

const getTengaAgentSelfServicePlanCatalog = () =>
  TENGAAGENT_SELF_SERVICE_PLAN_CODES.map((code) => ({
    code,
    label: toPlanLabel(code),
    prices: { ...TENGAAGENT_PLAN_PRICING[code] },
    entitlements: { ...TENGAAGENT_PLAN_ENTITLEMENTS[code] },
  }));

module.exports = {
  TENGAAGENT_PLAN_CODES,
  TENGAAGENT_PLAN_ENTITLEMENTS,
  TENGAAGENT_PLAN_PRICING,
  TENGAAGENT_SELF_SERVICE_PLAN_CODES,
  getTengaAgentPlanEntitlements,
  getTengaAgentPlanPrice,
  getTengaAgentSelfServicePlanCatalog,
};
