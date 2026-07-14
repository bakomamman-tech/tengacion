import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(testDir, "../index.css");
const studioAssetPath = resolve(testDir, "../../public/assets/light-mode-leaf-studio-background.jpg");

function getRule(css, selector) {
  const ruleStart = css.indexOf(`${selector} {`);

  if (ruleStart === -1) {
    return "";
  }

  const ruleEnd = css.indexOf("\n}", ruleStart);

  return css.slice(ruleStart, ruleEnd);
}

describe("Light theme CSS", () => {
  it("keeps the leafy studio background attached to the default light theme", () => {
    const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
    const bodyRule = getRule(css, "html:not(.dark-mode):not(.peaceful-mode):not(.nature-green-mode):not(.terra-minimal-mode):not(.blue-ray-mode) body");

    expect(existsSync(studioAssetPath)).toBe(true);
    expect(css).toContain('--light-mode-studio-bg: url("/assets/light-mode-leaf-studio-background.jpg");');
    expect(bodyRule).toContain("var(--light-mode-studio-bg)");
    expect(bodyRule).toContain("background-size:");
    expect(bodyRule).toContain("background-attachment: fixed;");
  });
});
