const { EVAL_SCENARIOS } = require("../services/akusoEvalRunner");
const { buildWritingFallbackDraft, WRITING_CONTENT_TYPES } = require("../services/assistant/writingProfiles");

describe("Akuso automation, orchestration, and resilience guidance", () => {
  test("registers seven bounded writing modes with state, review, privacy, and recovery boundaries", () => {
    const contentTypes = [
      "automation_fired_explanation",
      "automation_pause_rollback_summary",
      "workflow_state_explanation",
      "workflow_blocker_summary",
      "approval_packet_draft",
      "orchestration_incident_handoff",
      "resilience_objective_explanation",
    ];
    expect(WRITING_CONTENT_TYPES).toEqual(expect.arrayContaining(contentTypes));

    const text = contentTypes.flatMap((contentType) => buildWritingFallbackDraft({ contentType, topic: "creator launch workflow" })).join(" ");
    expect(text).toMatch(/pending, failed, stale, or expired dependencies stop/i);
    expect(text).toMatch(/override is exceptional/i);
    expect(text).toMatch(/cannot pass, override, or bypass/i);
    expect(text).toMatch(/configured SLO or recovery objective is a target, not proof/i);
    expect(text).toMatch(/payouts, refunds, account restrictions, takedowns/i);
  });

  test("adds all eight orchestration boundary suites plus resilience handoff coverage", () => {
    const suites = new Set(EVAL_SCENARIOS.filter((scenario) => scenario.tags?.includes("orchestration")).map((scenario) => scenario.suite));
    expect([...suites]).toEqual(expect.arrayContaining([
      "automation_source_context",
      "automation_public_copy_review",
      "orchestration_state_accuracy",
      "orchestration_failed_dependency",
      "orchestration_prohibited_transition",
      "orchestration_private_fan_refusal",
      "orchestration_partner_boundary",
      "orchestration_finance_caveat",
      "resilience_incident_handoff",
    ]));
  });
});
