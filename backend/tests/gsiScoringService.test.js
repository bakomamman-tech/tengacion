const { scoreJournal } = require("../services/gsiScoringService");

const completeWork = (overrides = {}) => ({
  id: "W1",
  title: "A complete research record",
  publicationDate: "2025-01-10",
  publicationYear: 2025,
  doi: "https://doi.org/10.1000/example",
  citedByCount: 10,
  isOpenAccess: true,
  hasAbstract: true,
  topics: [{ id: "T1", displayName: "Public health" }],
  authors: [
    {
      id: "A1",
      displayName: "Ada Researcher",
      institutions: [
        {
          id: "I1",
          displayName: "University of Example",
          countryCode: "NG",
          isGlobalSouth: true,
        },
      ],
    },
  ],
  ...overrides,
});

describe("GSI scoring service", () => {
  test("produces a fully transparent 100-point score for complete evidence", () => {
    const score = scoreJournal({
      source: {
        issnL: "1234-5678",
        worksCount: 100,
        countsByYear: [2021, 2022, 2023, 2024, 2025].map((year) => ({
          year,
          worksCount: 1,
        })),
      },
      publications: [completeWork(), completeWork({ id: "W2" })],
      now: new Date("2026-08-10T00:00:00.000Z"),
    });

    expect(score.total).toBe(100);
    expect(score.components.reduce((sum, component) => sum + component.weight, 0)).toBe(100);
    expect(score.components.reduce((sum, component) => sum + component.score, 0)).toBe(100);
    expect(score.components.every((component) => component.explanation.length > 20)).toBe(true);
    expect(score.fairnessNote).toMatch(/does not use impact factor/i);
  });

  test("reports missing evidence instead of inventing a placeholder score", () => {
    const score = scoreJournal({
      source: {},
      publications: [],
      now: new Date("2026-08-10T00:00:00.000Z"),
    });

    expect(score.total).toBe(0);
    expect(score.sampleSize).toBe(0);
    expect(score.summary).toMatch(/No publications were returned/i);
    score.components.forEach((component) => {
      expect(component.score).toBeGreaterThanOrEqual(0);
      expect(component.score).toBeLessThanOrEqual(component.weight);
    });
  });

  test("measures identity coverage rather than geographic prestige or breadth", () => {
    const score = scoreJournal({
      source: { issnL: "1234-5678", worksCount: 2 },
      publications: [completeWork(), completeWork({ id: "W2" })],
      now: new Date("2026-08-10T00:00:00.000Z"),
    });
    const identity = score.components.find((component) => component.key === "researchIdentity");

    expect(identity.score).toBe(15);
    expect(score.context.countries).toEqual(["NG"]);
    expect(identity.explanation).toMatch(/not prestige/i);
  });
});
