import { describe, expect, test } from "vitest";
import { formatCountry, formatNumber } from "./gsiFormatters";

describe("GSI record formatters", () => {
  test("expands ISO country codes for institutional readers", () => {
    expect(formatCountry("NG")).toBe("Nigeria");
    expect(formatCountry("")).toBe("Country not listed");
  });

  test("formats record counts with grouping separators", () => {
    expect(formatNumber(12620)).toBe("12,620");
  });
});
