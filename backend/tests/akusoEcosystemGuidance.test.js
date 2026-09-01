const { EVAL_SCENARIOS } = require("../services/akusoEvalRunner");
const { buildWritingFallbackDraft, WRITING_CONTENT_TYPES } = require("../services/assistant/writingProfiles");

describe("Akuso ecosystem guidance", () => {
  test("registers every ecosystem writing mode with deterministic authority boundaries", () => {
    const contentTypes = [
      "creator_service_explanation",
      "community_loop_guidance",
      "partner_integration_summary",
      "ecosystem_finance_explanation",
      "market_readiness_guidance",
      "ecosystem_governance_summary",
    ];
    expect(WRITING_CONTENT_TYPES).toEqual(expect.arrayContaining(contentTypes));

    const drafts = contentTypes.flatMap((contentType) => buildWritingFallbackDraft({ contentType, topic: "controlled pilot" }));
    expect(drafts.join(" ")).toMatch(/cannot grant access/i);
    expect(drafts.join(" ")).toMatch(/cannot approve.*market/i);
    expect(drafts.join(" ")).toMatch(/never reveal private fan rows/i);
    expect(drafts.join(" ")).toMatch(/ledger reconciliation/i);
  });

  test("adds all six ecosystem eval suites", () => {
    const suites = new Set(EVAL_SCENARIOS.filter((scenario) => scenario.tags?.includes("ecosystem")).map((scenario) => scenario.suite));
    expect([...suites]).toEqual(expect.arrayContaining([
      "creator_service_claims",
      "fan_community_messaging",
      "partner_privacy_boundary",
      "finance_and_payout_escalation",
      "multi_market_readiness",
      "api_or_export_refusal",
    ]));
  });
});
