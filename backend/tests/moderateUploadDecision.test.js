const {
  resolvePostUploadDecision,
} = require("../../apps/api/services/postService");

describe("upload moderation publication handling", () => {
  test("publishes an upload when no prohibited category was confirmed", () => {
    expect(resolvePostUploadDecision({
      decision: "quarantine",
      labels: ["inspection_failed", "visual_provider_unavailable"],
      reason: "Provider unavailable",
      confidence: 0.2,
    })).toMatchObject({
      decision: "approve",
      labels: ["inspection_failed", "visual_provider_unavailable"],
      confidence: 0.2,
    });
  });

  test("does not downgrade a rejected upload with an enforced safety signal", () => {
    expect(resolvePostUploadDecision({
      decision: "reject",
      labels: ["inspection_failed", "explicit_pornography"],
      reason: "Safety signal",
      confidence: 0.94,
    })).toMatchObject({
      decision: "reject",
      labels: ["inspection_failed", "explicit_pornography"],
      confidence: 0.94,
    });
  });
});
