import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const indexCss = readFileSync(resolve(testDir, "../index.css"), "utf8").replace(/\r\n/g, "\n");
const buttonCss = readFileSync(resolve(testDir, "../button-system.css"), "utf8").replace(/\r\n/g, "\n");

function getRule(css, selector) {
  const ruleStart = css.indexOf(`${selector} {`);

  if (ruleStart === -1) {
    return "";
  }

  const ruleEnd = css.indexOf("\n}", ruleStart);

  return css.slice(ruleStart, ruleEnd);
}

describe("In-feed people button theme CSS", () => {
  it("uses the selected theme's primary palette in every interaction state", () => {
    const buttonRule = getRule(indexCss, ".in-feed-people-add");
    const hoverRule = getRule(indexCss, ".in-feed-people-add:hover:not(:disabled)");
    const activeRule = getRule(indexCss, ".in-feed-people-add:active:not(:disabled)");

    expect(buttonRule).toContain("border: 1px solid var(--tg-btn-primary-border);");
    expect(buttonRule).toContain("color: var(--tg-btn-primary-text);");
    expect(buttonRule).toContain("background: var(--tg-btn-primary-bg);");
    expect(buttonRule).toContain("box-shadow: var(--tg-btn-shadow-primary);");
    expect(hoverRule).toContain("background: var(--tg-btn-primary-bg-hover);");
    expect(hoverRule).toContain("box-shadow: var(--tg-btn-shadow-primary-hover);");
    expect(activeRule).toContain("background: var(--tg-btn-primary-bg-active);");
  });

  it("keeps Light Mode's primary action green", () => {
    const lightModeTokens = getRule(buttonCss, ":root");

    expect(lightModeTokens).toContain(
      "--tg-btn-primary-bg: linear-gradient(180deg, #478a66 0%, #2a6f4f 100%);"
    );
  });
});
