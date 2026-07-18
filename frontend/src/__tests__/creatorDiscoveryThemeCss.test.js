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

  it("keeps creator names complete and metadata pills compact", () => {
    const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
    const bodyRule = getRule(css, ".creator-summary-card__body");
    const topRule = getRule(css, ".creator-summary-card__top");
    const nameRule = getRule(css, ".creator-summary-card__creator-copy strong");
    const metaRule = getRule(css, ".creator-summary-card__meta");
    const metaPillRule = getRule(css, ".creator-summary-card__meta span");

    expect(bodyRule).toContain("align-content: start;");
    expect(bodyRule).toContain("grid-auto-rows: max-content;");
    expect(topRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(104px, 142px);");
    expect(nameRule).toContain("overflow: visible;");
    expect(nameRule).toContain("white-space: normal;");
    expect(nameRule).not.toContain("text-overflow: ellipsis;");
    expect(metaRule).toContain("align-self: start;");
    expect(metaRule).toContain("align-items: center;");
    expect(metaPillRule).toContain("display: inline-flex;");
    expect(metaPillRule).toContain("align-items: center;");
    expect(metaPillRule).toContain("justify-content: center;");
    expect(metaPillRule).toContain("min-height: 36px;");
  });
});
