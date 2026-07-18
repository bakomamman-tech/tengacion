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

describe("Sidebar friend suggestion theme CSS", () => {
  const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");

  it("uses the active theme's primary button palette with white text", () => {
    const buttonRule = getRule(css, ".sidebar-friend-suggestion__add");

    expect(buttonRule).toContain("border: 1px solid var(--tg-btn-primary-border);");
    expect(buttonRule).toContain("background: var(--tg-btn-primary-bg);");
    expect(buttonRule).toContain("color: #fff;");
    expect(buttonRule).toContain("box-shadow: var(--tg-btn-shadow-primary);");
  });

  it("keeps the same palette and position on hover", () => {
    const hoverRule = getRule(
      css,
      ".sidebar-friend-suggestion__add:hover:not(:disabled)"
    );

    expect(hoverRule).toContain("border-color: var(--tg-btn-primary-border);");
    expect(hoverRule).toContain("background: var(--tg-btn-primary-bg);");
    expect(hoverRule).toContain("color: #fff;");
    expect(hoverRule).toContain("box-shadow: var(--tg-btn-shadow-primary);");
    expect(hoverRule).toContain("transform: none;");
  });
});
