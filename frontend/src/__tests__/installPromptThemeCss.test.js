import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(testDir, "../index.css");

function getRule(css, selector) {
  const ruleStart = css.indexOf(`${selector} {`);
  if (ruleStart === -1) {
    return "";
  }
  const ruleEnd = css.indexOf("\n}", ruleStart);
  return css.slice(ruleStart, ruleEnd);
}

describe("Install Tengacion theme CSS", () => {
  const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");

  it("uses the active theme's primary palette", () => {
    const buttonRule = getRule(css, ".install-prompt-btn");
    const hoverRule = getRule(css, ".install-prompt-btn:hover");
    const activeRule = getRule(css, ".install-prompt-btn:active");

    expect(buttonRule).toContain("background: var(--tg-btn-primary-bg) !important;");
    expect(buttonRule).toContain("border: 1px solid var(--tg-btn-primary-border) !important;");
    expect(buttonRule).toContain("color: var(--tg-btn-primary-text) !important;");
    expect(hoverRule).toContain("background: var(--tg-btn-primary-bg-hover) !important;");
    expect(activeRule).toContain("background: var(--tg-btn-primary-bg-active) !important;");
  });
});
