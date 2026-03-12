import { describe, expect, it } from "vitest";

import { COUNTRY_OPTIONS } from "../constants/countries";

describe("COUNTRY_OPTIONS", () => {
  it("ships a complete deduplicated country list for the profile dropdown", () => {
    expect(COUNTRY_OPTIONS.length).toBeGreaterThan(200);
    expect(COUNTRY_OPTIONS).toContain("Nigeria");
    expect(COUNTRY_OPTIONS).toContain("United States");
    expect(new Set(COUNTRY_OPTIONS).size).toBe(COUNTRY_OPTIONS.length);
  });
});
