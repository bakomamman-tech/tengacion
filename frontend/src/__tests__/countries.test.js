import { describe, expect, it } from "vitest";

import { COUNTRY_OPTIONS, getRegionsForCountry } from "../constants/countries";

describe("COUNTRY_OPTIONS", () => {
  it("ships a complete deduplicated country list for the profile dropdown", () => {
    expect(COUNTRY_OPTIONS.length).toBeGreaterThan(200);
    expect(COUNTRY_OPTIONS).toContain("Nigeria");
    expect(COUNTRY_OPTIONS).toContain("United States");
    expect(new Set(COUNTRY_OPTIONS).size).toBe(COUNTRY_OPTIONS.length);
  });
});

describe("getRegionsForCountry", () => {
  it("returns states for Nigeria", () => {
    expect(getRegionsForCountry("Nigeria")).toContain("Lagos");
    expect(getRegionsForCountry("Nigeria")).toContain("Abuja Federal Capital Territory");
  });

  it("returns states for the United States display label", () => {
    expect(getRegionsForCountry("United States")).toContain("California");
    expect(getRegionsForCountry("United States")).toContain("New York");
  });

  it("returns an empty list for unknown countries", () => {
    expect(getRegionsForCountry("Atlantis")).toEqual([]);
  });
});
