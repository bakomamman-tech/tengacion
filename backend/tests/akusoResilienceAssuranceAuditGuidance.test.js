const { EVAL_SCENARIOS } = require("../services/akusoEvalRunner");
const { buildWritingFallbackDraft, WRITING_CONTENT_TYPES } = require("../services/assistant/writingProfiles");
const { AKUSO_RESILIENCE_ASSURANCE_AUDIT_POLICY } = require("../services/resilienceAssuranceAuditOperatingService");

describe("Akuso resilience, assurance, and audit guidance", () => {
  test("registers reviewed writing modes with evidence, sharing, closure, and authority boundaries", () => {
    const contentTypes = ["resilience_status_summary", "assurance_evidence_summary", "audit_findings_summary"];
    expect(WRITING_CONTENT_TYPES).toEqual(expect.arrayContaining(contentTypes));

    const text = contentTypes.flatMap((contentType) => buildWritingFallbackDraft({ contentType, topic: "checkout evidence" })).join(" ");
    expect(text).toMatch(/planned drill.*not proof of recovery/i);
    expect(text).toMatch(/cannot support an external assurance claim/i);
    expect(text).toMatch(/owner statement is not closure/i);
    expect(text).toMatch(/cannot change a result, close a finding, accept risk/i);
    expect(AKUSO_RESILIENCE_ASSURANCE_AUDIT_POLICY).toMatchObject({ executionAuthority: "none" });
  });

  test("adds all seven release-eval suites", () => {
    const expectedSuites = [
      "incident_source_grounding", "recovery_claim_boundary", "evidence_freshness",
      "external_pack_privacy", "audit_result_accuracy", "risk_acceptance_refusal",
      "high_risk_workflow_refusal",
    ];
    const suites = new Set(EVAL_SCENARIOS.map((scenario) => scenario.suite));
    expect([...suites]).toEqual(expect.arrayContaining(expectedSuites));
  });
});
