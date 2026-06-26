import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(testDir, "../terra-minimal-theme.css");
const studioAssetPath = resolve(testDir, "../../public/assets/terra-minimal-studio-background.jpg");

function getRule(css, selector) {
  const ruleStart = css.indexOf(`${selector} {`);

  if (ruleStart === -1) {
    return "";
  }

  const ruleEnd = css.indexOf("\n}", ruleStart);

  return css.slice(ruleStart, ruleEnd);
}

describe("Terra Minimal theme CSS", () => {
  it("keeps the warm studio background attached to Terra Minimal", () => {
    const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
    const bodyRule = getRule(css, "html.terra-minimal-mode body");

    expect(existsSync(studioAssetPath)).toBe(true);
    expect(css).toContain('--terra-minimal-studio-bg: url("/assets/terra-minimal-studio-background.jpg");');
    expect(bodyRule).toContain("var(--terra-minimal-studio-bg)");
    expect(bodyRule).toContain("background-size:");
    expect(bodyRule).toContain("background-attachment: fixed;");
  });
});
