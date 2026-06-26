import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(testDir, "../peaceful-theme.css");
const studioAssetPath = resolve(testDir, "../../public/assets/peaceful-mode-leaf-studio-background.jpg");

function getRule(css, selector) {
  const ruleStart = css.indexOf(`${selector} {`);

  if (ruleStart === -1) {
    return "";
  }

  const ruleEnd = css.indexOf("\n}", ruleStart);

  return css.slice(ruleStart, ruleEnd);
}

describe("Peaceful theme CSS", () => {
  it("keeps the leafy studio background attached to Peaceful Mode", () => {
    const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
    const bodyRule = getRule(css, "html.peaceful-mode body");

    expect(existsSync(studioAssetPath)).toBe(true);
    expect(css).toContain('--peaceful-leaf-studio-bg: url("/assets/peaceful-mode-leaf-studio-background.jpg");');
    expect(bodyRule).toContain("var(--peaceful-leaf-studio-bg)");
    expect(bodyRule).toContain("background-size:");
    expect(bodyRule).toContain("background-attachment: fixed;");
  });
});
