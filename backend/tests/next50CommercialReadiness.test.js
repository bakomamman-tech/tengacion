const fs = require("fs");
const path = require("path");

const established = require("../config/externalReadinessPackages.json");
const nextFifty = require("../config/externalReadinessNext50");
const catalog = require("../config/externalReadinessCatalog");

const countByCycle = (rows) =>
  rows.reduce((counts, row) => {
    counts[row.cycle] = (counts[row.cycle] || 0) + 1;
    return counts;
  }, {});

test("registers exactly 50 consecutive post-CAPITAL-011 packages", () => {
  expect(nextFifty).toHaveLength(50);
  expect(nextFifty[0].key).toBe("CAPITAL-012");
  expect(nextFifty.at(-1).key).toBe("COMMERCIAL-010");
  expect(countByCycle(nextFifty)).toEqual({
    capital: 4,
    distribution: 18,
    revenue: 18,
    commercial: 10,
  });

  const keys = nextFifty.map((row) => row.key);
  expect(new Set(keys).size).toBe(50);
});

test("extends the governed readiness catalog from 48 to 98 unique packages", () => {
  expect(established).toHaveLength(48);
  expect(catalog).toHaveLength(98);
  expect(new Set(catalog.map((row) => row.key)).size).toBe(98);
});

test("every next-50 contract traces to checked-in roadmap text and has evidence gates", () => {
  for (const packageSpec of nextFifty) {
    const source = fs
      .readFileSync(path.resolve(__dirname, "../..", packageSpec.source), "utf8")
      .toLowerCase();

    expect(source).toContain(packageSpec.title.toLowerCase());
    expect(packageSpec.requirements.length).toBeGreaterThan(0);
    expect(packageSpec.acceptanceCriteria.length).toBeGreaterThan(0);
    expect(packageSpec.requirements.join(" ")).toMatch(/evidence/i);
    expect(packageSpec.acceptanceCriteria.join(" ")).toMatch(/independent review/i);
  }
});

test("decision packages remain advisory and explicitly non-executing", () => {
  const decisions = nextFifty.filter((row) => row.kind === "decision");
  expect(decisions.map((row) => row.key)).toEqual([
    "CAPITAL-015",
    "DISTRIBUTION-013",
    "DISTRIBUTION-017",
    "REVENUE-013",
    "REVENUE-017",
    "COMMERCIAL-010",
  ]);

  for (const packageSpec of decisions) {
    expect(packageSpec.requirements.join(" ")).toMatch(/human-selected decision/i);
    expect(packageSpec.acceptanceCriteria.join(" ")).toMatch(/cannot execute/i);
  }
});

test("all next-50 packages preserve explicit human authority boundaries", () => {
  for (const packageSpec of nextFifty) {
    const contractText = packageSpec.requirements.join(" ");
    expect(contractText).toMatch(/human authority boundaries/i);
    expect(contractText).toMatch(/money movement/i);
  }
});
