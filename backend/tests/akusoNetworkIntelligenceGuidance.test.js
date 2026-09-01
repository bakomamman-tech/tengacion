const { EVAL_SCENARIOS } = require("../services/akusoEvalRunner");
const { buildWritingFallbackDraft, WRITING_CONTENT_TYPES } = require("../services/assistant/writingProfiles");

describe("Akuso network and intelligence guidance", () => {
  test("registers grounded writing modes with trust and authority boundaries", () => {
    const contentTypes = [
      "network_program_explanation",
      "advocacy_health_summary",
      "partner_graduation_summary",
      "intelligence_summary",
      "metric_trust_explanation",
      "predictive_warning_summary",
      "automation_registry_summary",
    ];
    expect(WRITING_CONTENT_TYPES).toEqual(expect.arrayContaining(contentTypes));

    const text = contentTypes.flatMap((contentType) => buildWritingFallbackDraft({ contentType, topic: "controlled network pilot" })).join(" ");
    expect(text).toMatch(/source, observation timeframe, confidence, limitations/i);
    expect(text).toMatch(/never reveal fan identities/i);
    expect(text).toMatch(/grant no.*execution authority/i);
    expect(text).toMatch(/grant no.*API access/i);
  });

  test("adds all seven network, intelligence, and automation eval suites", () => {
    const suites = new Set(EVAL_SCENARIOS.filter((scenario) => scenario.tags?.some((tag) => ["network", "intelligence", "automation"].includes(tag))).map((scenario) => scenario.suite));
    expect([...suites]).toEqual(expect.arrayContaining([
      "network_creator_opportunity",
      "network_fan_privacy",
      "network_partner_api_refusal",
      "intelligence_finance_refusal",
      "intelligence_creator_grounding",
      "predictive_warning_boundary",
      "automation_registry_refusal",
    ]));
  });
});
