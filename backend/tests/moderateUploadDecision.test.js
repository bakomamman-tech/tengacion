const {
  allowTechnicalInspectionFailure,
} = require("../middleware/moderateUpload");

describe("upload moderation technical failure handling", () => {
  test("allows a quarantined upload when inspection infrastructure is unavailable", () => {
    expect(allowTechnicalInspectionFailure({
      decision: "quarantine",
      labels: ["inspection_failed", "visual_provider_unavailable"],
      reason: "Provider unavailable",
      confidence: 0.2,
    })).toMatchObject({
      decision: "approve",
      labels: ["inspection_failed", "visual_provider_unavailable"],
      confidence: 0,
    });
  });

  test("does not override an upload with an enforced safety signal", () => {
    expect(allowTechnicalInspectionFailure({
      decision: "quarantine",
      labels: ["inspection_failed", "explicit_pornography"],
      reason: "Safety signal",
      confidence: 0.94,
    })).toMatchObject({
      decision: "quarantine",
      labels: ["inspection_failed", "explicit_pornography"],
      confidence: 0.94,
    });
  });
});
