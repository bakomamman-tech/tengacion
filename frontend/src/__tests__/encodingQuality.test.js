import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { auditRepository, findEncodingDefects } = require("../../scripts/auditEncoding.cjs");

describe("repository encoding quality", () => {
  it("detects replacement characters, common mojibake leads and corrupt entities", () => {
    const brokenText = [
      "broken",
      String.fromCodePoint(0xfffd),
      `${String.fromCodePoint(0x00e2)}${String.fromCodePoint(0x20ac)}`,
      `${String.fromCodePoint(0x00f0)}${String.fromCodePoint(0x0178)}`,
      ["&A", "circ;"].join(""),
    ].join(" ");

    expect(findEncodingDefects(brokenText)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Unicode replacement character" }),
        expect.objectContaining({ label: "Windows-1252 mojibake sequence" }),
        expect.objectContaining({ label: "corrupted emoji sequence" }),
        expect.objectContaining({ label: "corrupted HTML entity" }),
      ])
    );
  });

  it("keeps repository UTF-8 text surfaces free from encoding defects", () => {
    const result = auditRepository();

    expect(result.filesScanned).toBeGreaterThan(500);
    expect(result.findings).toEqual([]);
  }, 60000);
});
