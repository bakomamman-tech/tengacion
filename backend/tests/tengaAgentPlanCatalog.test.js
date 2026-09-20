const {
  TENGAAGENT_PLAN_PRICING,
  TENGAAGENT_SELF_SERVICE_PLAN_CODES,
  getTengaAgentSelfServicePlanCatalog,
} = require("../config/tengaAgentPlans");

describe("TengaAgent self-service plan catalog", () => {
  it("mirrors the backend checkout pricing source exactly", () => {
    const catalog = getTengaAgentSelfServicePlanCatalog();

    expect(catalog.map((plan) => plan.code)).toEqual(
      TENGAAGENT_SELF_SERVICE_PLAN_CODES
    );

    for (const plan of catalog) {
      expect(plan.label).toBeTruthy();
      expect(plan.prices).toEqual(TENGAAGENT_PLAN_PRICING[plan.code]);
      expect(plan.entitlements).toBeTruthy();
    }
  });

  it("returns detached objects so consumers cannot mutate config", () => {
    const first = getTengaAgentSelfServicePlanCatalog();
    const second = getTengaAgentSelfServicePlanCatalog();

    first[0].prices.NGN = 1;
    first[0].entitlements.agents = 999;

    expect(second[0].prices).toEqual(TENGAAGENT_PLAN_PRICING[second[0].code]);
    expect(second[0].entitlements.agents).not.toBe(999);
  });
});
