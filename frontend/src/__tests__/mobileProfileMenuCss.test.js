import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../index.css");

function getMobileProfileMenuRule() {
  const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
  const ruleStart = css.indexOf("  .profile-menu {\n    position: fixed;");

  if (ruleStart === -1) {
    return "";
  }

  const ruleEnd = css.indexOf("\n  }", ruleStart);

  return css.slice(ruleStart, ruleEnd);
}

describe("mobile profile menu CSS", () => {
  it("keeps the account menu scrollable so all display themes are reachable", () => {
    const rule = getMobileProfileMenuRule();

    expect(rule).toContain("position: fixed;");
    expect(rule).toContain("max-height:");
    expect(rule).toContain("overflow-y: auto;");
    expect(rule).toContain("-webkit-overflow-scrolling: touch;");
  });
});
