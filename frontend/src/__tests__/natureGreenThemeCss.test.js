import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(testDir, "../nature-afro-themes.css");
const leafAssetPath = resolve(testDir, "../../public/assets/nature-green-leaf-background-v2.jpg");

function getRule(css, selector) {
  const ruleStart = css.indexOf(`${selector} {`);

  if (ruleStart === -1) {
    return "";
  }

  const ruleEnd = css.indexOf("\n}", ruleStart);

  return css.slice(ruleStart, ruleEnd);
}

describe("Nature Green theme CSS", () => {
  it("keeps the leafy background attached to Nature Green", () => {
    const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
    const natureBodyRule = getRule(css, "html.nature-green-mode body");
    const afroBodyRule = getRule(css, "html.afro-gold-mode body");

    expect(existsSync(leafAssetPath)).toBe(true);
    expect(css).toContain('--nature-green-leaf-bg: url("/assets/nature-green-leaf-background-v2.jpg");');
    expect(natureBodyRule).toContain("var(--nature-green-leaf-bg)");
    expect(natureBodyRule).toContain("background-size:");
    expect(natureBodyRule).toContain("background-attachment: fixed;");
    expect(afroBodyRule).not.toContain("nature-green-leaf-background");
  });

  it("keeps public landing and login text readable in Nature Green", () => {
    const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");

    expect(css).toContain("html.nature-green-mode .public-home__hero h1");
    expect(css).toContain("color: #f2ffd7;");
    expect(css).toContain("html.nature-green-mode .public-home__nav-actions a:not(:last-child)");
    expect(css).toContain("color: #173d20;");
    expect(css).toContain("html.nature-green-mode .login-container--luxury input.login-input");
    expect(css).toContain("color: #182315;");
    expect(css).toContain("html.nature-green-mode .login-container--luxury :is(");
    expect(css).toContain(".forgot-password,");
  });
});
