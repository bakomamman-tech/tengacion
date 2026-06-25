import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(testDir, "../nature-afro-themes.css");
const leafAssetPath = resolve(testDir, "../../public/assets/nature-green-leaf-background.png");

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
    expect(css).toContain('--nature-green-leaf-bg: url("/assets/nature-green-leaf-background.png");');
    expect(natureBodyRule).toContain("var(--nature-green-leaf-bg)");
    expect(natureBodyRule).toContain("background-size:");
    expect(natureBodyRule).toContain("background-attachment: fixed;");
    expect(afroBodyRule).not.toContain("nature-green-leaf-background.png");
  });
});
