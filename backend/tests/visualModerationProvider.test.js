process.env.NODE_ENV = "test";

const {
  mapContextualVisionResult,
  mapOmniModerationResult,
  mapOmniModerationResults,
  mergeVisualDecisions,
} = require("../services/visualModerationProvider");

describe("visual moderation decision mapping", () => {
  test("ordinary low-risk images remain allowed", () => {
    expect(mapOmniModerationResult({
      categories: { sexual: false, "violence/graphic": false },
      category_scores: { sexual: 0.01, "violence/graphic": 0.02 },
    })).toMatchObject({ decision: "approve" });

    expect(mapContextualVisionResult({
      category: "none",
      confidence: 0.95,
      severity: "low",
      context: "ordinary",
      reason: "Ordinary family photo",
    })).toMatchObject({ decision: "approve" });
  });

  test("explicit pornography is rejected while uncertain sexual content is reviewed", () => {
    expect(mapOmniModerationResult({
      categories: { sexual: true },
      category_scores: { sexual: 0.96 },
    })).toMatchObject({ decision: "reject" });

    expect(mapOmniModerationResult({
      categories: { sexual: true },
      category_scores: { sexual: 0.55 },
    })).toMatchObject({ decision: "quarantine" });
  });

  test("suspected child exploitation is never approved", () => {
    expect(mapContextualVisionResult({
      category: "suspected_child_exploitation",
      confidence: 0.96,
      severity: "critical",
      context: "unknown",
      reason: "High-risk sexual exploitation signal",
    })).toMatchObject({
      decision: "reject",
      labels: expect.arrayContaining(["suspected_child_exploitation"]),
    });
  });

  test("context prevents overblocking rescue and medical material", () => {
    expect(mapContextualVisionResult({
      category: "animal_cruelty",
      confidence: 0.91,
      severity: "high",
      context: "rescue_conservation",
      reason: "Animal rescue documentation",
    })).toMatchObject({ decision: "quarantine" });

    expect(mapContextualVisionResult({
      category: "graphic_gore",
      confidence: 0.91,
      severity: "high",
      context: "educational_news_medical",
      reason: "Clinical training material",
    })).toMatchObject({ decision: "quarantine" });
  });

  test("severe glorified child abuse and animal cruelty are rejected", () => {
    expect(mapContextualVisionResult({
      category: "child_abuse",
      confidence: 0.94,
      severity: "critical",
      context: "glorifying_abuse",
      reason: "Visible abuse",
    })).toMatchObject({ decision: "reject" });

    expect(mapContextualVisionResult({
      category: "animal_cruelty",
      confidence: 0.92,
      severity: "high",
      context: "glorifying_abuse",
      reason: "Visible deliberate cruelty",
    })).toMatchObject({ decision: "reject" });
  });

  test("the worst result wins across a multi-image upload", () => {
    expect(mergeVisualDecisions([
      { decision: "approve", labels: ["safe"], confidence: 0.9, reason: "safe" },
      { decision: "quarantine", labels: ["graphic_gore"], confidence: 0.7, reason: "review" },
      { decision: "reject", labels: ["explicit_pornography"], confidence: 0.96, reason: "block" },
    ])).toMatchObject({
      decision: "reject",
      labels: expect.arrayContaining(["graphic_gore", "explicit_pornography"]),
      reason: "block",
    });
  });

  test("every image result from the moderation API contributes to the upload decision", () => {
    expect(mapOmniModerationResults([
      {
        categories: { sexual: false, "violence/graphic": false },
        category_scores: { sexual: 0.01, "violence/graphic": 0.01 },
      },
      {
        categories: { sexual: true, "violence/graphic": false },
        category_scores: { sexual: 0.97, "violence/graphic": 0.01 },
      },
    ])).toMatchObject({
      decision: "reject",
      labels: expect.arrayContaining(["explicit_pornography"]),
    });
  });
});
