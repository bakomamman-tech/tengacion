import { describe, expect, it } from "vitest";
import { resolveLowBandwidthMode } from "../../lib/bandwidthMode";

describe("resolveLowBandwidthMode", () => {
  it("honors explicit low and full modes", () => {
    expect(resolveLowBandwidthMode({ storedMode: "low" })).toBe(true);
    expect(resolveLowBandwidthMode({ storedMode: "full", connection: { saveData: true } })).toBe(false);
  });

  it("uses Save-Data and constrained connection signals in auto mode", () => {
    expect(resolveLowBandwidthMode({ storedMode: "auto", connection: { saveData: true } })).toBe(true);
    expect(resolveLowBandwidthMode({ storedMode: "auto", connection: { effectiveType: "2g" } })).toBe(true);
    expect(resolveLowBandwidthMode({ storedMode: "auto", connection: { effectiveType: "4g" } })).toBe(false);
  });
});
