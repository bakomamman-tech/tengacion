import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(testDir, "./CalculatorPage.css"), "utf8").replace(/\r\n/g, "\n");

function getRule(selector, startAt = 0) {
  const start = css.indexOf(`${selector} {`, startAt);

  if (start === -1) {
    return "";
  }

  return css.slice(start, css.indexOf("\n}", start));
}

describe("Calculator viewport fit", () => {
  it("keeps the display visible while users operate the keypad", () => {
    const display = getRule(".calculator-neo .calculator-display");

    expect(display).toContain("position: sticky;");
    expect(display).toContain("top: 84px;");
    expect(display).toContain("z-index: 5;");
  });

  it("uses compact but touch-friendly controls", () => {
    const key = getRule(".calculator-neo .calculator-key");
    const mobileStart = css.indexOf("@media (max-width: 640px)");
    const mobileKey = getRule(".calculator-neo .calculator-key", mobileStart);

    expect(key).toContain("min-height: 48px;");
    expect(mobileKey).toContain("min-height: 44px;");
  });

  it("compacts nonessential information on smaller screens", () => {
    const tabletStart = css.indexOf("@media (max-width: 860px)");
    const tabletSection = css.slice(tabletStart, css.indexOf("@media (max-width: 640px)", tabletStart));
    const mobileStart = css.indexOf("@media (max-width: 640px)");
    const mobileExpression = getRule(".calculator-neo .calculator-expression", mobileStart);

    expect(tabletSection).toContain(".calculator-neo .calculator-chip-row");
    expect(tabletSection).toContain("display: none;");
    expect(mobileExpression).toContain("max-height: 70px;");
  });
});
