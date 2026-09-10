const { buildWritingFallbackDraft, WRITING_CONTENT_TYPES } = require("../services/assistant/writingProfiles");
test.each(["certification_readiness_summary", "institutional_decision_brief", "capital_scenario_explanation", "diligence_response_draft"])("%s preserves evidence and human authority boundaries", (contentType) => {
  expect(WRITING_CONTENT_TYPES).toContain(contentType);
  const text = buildWritingFallbackDraft({ contentType, topic: "Current review" }).join(" ");
  expect(text).toContain("stale, disputed, untested or withdrawn");
  expect(text).toContain("cannot approve claims"); expect(text).toContain("contact investors"); expect(text).toContain("human reviewer");
});

test("explicit writing mode is preserved when audit wording also matches app guidance", () => {
  const { config } = require("../config/env");
  const { selectAkusoModel } = require("../services/akusoModelRouter");
  const original = config.akuso;
  try {
    config.akuso = { enabled: true, hasOpenAI: true, models: { fast: "fast", writing: "writing" } };
    const policyResult = { shouldCallModel: true, mode: "creator_writing", categoryBucket: "APP_GUIDANCE", taskType: "creator_writing" };
    expect(selectAkusoModel({ policyResult }).task).toBe("creator_writing");
    expect(selectAkusoModel({ policyResult, routePurpose: "hints" }).task).toBe("app_guidance");
    expect(selectAkusoModel({ policyResult: { ...policyResult, shouldCallModel: false } }).useModel).toBe(false);
  } finally { config.akuso = original; }
});
