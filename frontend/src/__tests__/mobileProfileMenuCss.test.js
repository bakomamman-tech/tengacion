import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../index.css");

function getBaseProfileMenuRule() {
  const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
  const ruleStart = css.indexOf(".profile-menu {\n  position: absolute;");

  if (ruleStart === -1) {
    return "";
  }

  const ruleEnd = css.indexOf("\n}", ruleStart);

  return css.slice(ruleStart, ruleEnd);
}

function getMobileProfileMenuRule() {
  const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
  const anchor = css.indexOf("  .nav-actions-shell {\n    padding: 5px 8px;");
  const ruleStart = css.indexOf("  .profile-menu {", anchor);

  if (anchor === -1 || ruleStart === -1) {
    return "";
  }

  const ruleEnd = css.indexOf("\n  }", ruleStart);

  return css.slice(ruleStart, ruleEnd);
}

describe("mobile profile menu CSS", () => {
  it("keeps the desktop account menu scrollable so laptop users can reach every theme", () => {
    const rule = getBaseProfileMenuRule();

    expect(rule).toContain("position: absolute;");
    expect(rule).toContain("top: calc(100% + 8px);");
    expect(rule).toContain("max-height:");
    expect(rule).toContain("overflow-y: auto;");
    expect(rule).toContain("-webkit-overflow-scrolling: touch;");
    expect(rule).not.toContain("position: fixed;");
  });

  it("keeps the mobile account menu anchored and scrollable so all display themes are reachable", () => {
    const rule = getMobileProfileMenuRule();

    expect(rule).toContain("position: absolute;");
    expect(rule).toContain("top: calc(100% + 8px);");
    expect(rule).toContain("right: 0;");
    expect(rule).toContain("left: auto;");
    expect(rule).toContain("max-height:");
    expect(rule).toContain("overflow-y: auto;");
    expect(rule).toContain("-webkit-overflow-scrolling: touch;");
    expect(rule).not.toContain("position: fixed;");
  });
});
