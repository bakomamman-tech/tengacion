import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(testDir, "../pages/creator/creator-workspace.css");
const themes = [
  "light",
  "nature-green",
  "peaceful",
  "dark",
  "royalty",
  "afro-gold",
  "terra-minimal",
];

function getRule(css, selector) {
  const marker = `${selector} {`;
  const matchedLineStart = css.lastIndexOf(`\n${marker}`);
  const ruleStart = matchedLineStart >= 0 ? matchedLineStart + 1 : css.indexOf(marker);
  if (ruleStart === -1) {
    return "";
  }

  const ruleEnd = css.indexOf("\n}", ruleStart);
  return css.slice(ruleStart, ruleEnd);
}

describe("creator workspace theme contrast CSS", () => {
  it.each(themes)("defines a complete %s workspace palette", (theme) => {
    const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
    const selector =
      theme === "light"
        ? ".creator-shell"
        : `html[data-theme="${theme}"] .creator-shell`;
    const rule = getRule(css, selector);

    expect(rule).toContain("--creator-text:");
    expect(rule).toContain("--creator-muted:");
    expect(rule).toContain("--creator-panel-strong:");
    expect(rule).toContain("--creator-surface-soft:");
    expect(rule).toContain("--creator-control-surface:");
    expect(rule).toContain("--creator-control-active:");
    expect(rule).toContain("--creator-focus-ring:");
  });

  it("pairs dashboard controls and inner cards with theme-aware surfaces", () => {
    const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");

    expect(css).toContain("background: var(--creator-control-surface);");
    expect(css).toContain("background: var(--creator-control-active);");
    expect(css).toContain("background: var(--creator-surface-soft);");
    expect(css).toContain("color: var(--creator-text);");
    expect(css).toContain("color: var(--creator-muted);");
  });
});
