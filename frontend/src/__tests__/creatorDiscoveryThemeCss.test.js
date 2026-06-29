import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(testDir, "../components/creatorDiscovery/creatorDiscovery.css");
const themes = [
  "nature-green",
  "peaceful",
  "dark",
  "royalty",
  "afro-gold",
  "terra-minimal",
];

function getRule(css, selector) {
  const marker = `${selector} {`;
  const lineStart = css.lastIndexOf(`\n${marker}`);
  const ruleStart = lineStart >= 0 ? lineStart + 1 : css.indexOf(marker);
  if (ruleStart < 0) {
    return "";
  }
  const ruleEnd = css.indexOf("\n}", ruleStart);
  return css.slice(ruleStart, ruleEnd);
}

describe("creator discovery theme controls", () => {
  it("uses a saturated, contrast-safe refresh button by default", () => {
    const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
    const themeRule = getRule(css, ".creator-discovery-theme");
    const buttonRule = getRule(css, ".creator-summary-feed__refresh-btn");

    expect(themeRule).toContain("--creator-summary-refresh-bg: linear-gradient");
    expect(themeRule).toContain("--creator-summary-refresh-text: #fff8e9;");
    expect(buttonRule).toContain("background: var(--creator-summary-refresh-bg);");
  });

  it.each(themes)("defines a dedicated %s refresh palette", (theme) => {
    const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
    const rule = getRule(css, `html[data-theme="${theme}"] .creator-discovery-theme`);

    if (theme === "nature-green") {
      expect(rule).toContain("--creator-summary-refresh-bg: var(--nature-leaf-button-gradient);");
      expect(rule).toContain("--creator-summary-refresh-bg-hover: var(--nature-leaf-button-gradient-hover);");
    } else {
      expect(rule).toContain("--creator-summary-refresh-bg: linear-gradient");
      expect(rule).toContain("--creator-summary-refresh-bg-hover: linear-gradient");
    }
    expect(rule).toContain("--creator-summary-refresh-border:");
    expect(rule).toContain("--creator-summary-refresh-text:");
    expect(rule).toContain("--creator-summary-refresh-shadow:");
  });
});
