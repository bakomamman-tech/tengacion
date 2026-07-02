import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));

function readCss(fileName) {
  return readFileSync(resolve(testDir, `../${fileName}`), "utf8").replace(/\r\n/g, "\n");
}

function getRule(css, selector) {
  const start = css.indexOf(`${selector} {`);

  if (start === -1) {
    return "";
  }

  return css.slice(start, css.indexOf("\n}", start));
}

describe("dark-theme account menu caret", () => {
  it.each([
    [
      "Dark Mode",
      "button-system.css",
      "html.dark-mode:not(.royalty-mode):not(.afro-gold-mode) .nav-avatar-caret",
      "#245b43",
    ],
    ["Afro Gold", "nature-afro-themes.css", "html.afro-gold-mode .nav-avatar-caret", "#825119"],
    ["Royalty Mode", "royalty-theme.css", "html.royalty-mode .nav-avatar-caret", "#89571d"],
  ])("keeps the V-shaped trigger visible in %s", (_theme, fileName, selector, background) => {
    const rule = getRule(readCss(fileName), selector);

    expect(rule).toContain("width: 28px;");
    expect(rule).toContain("border-radius: 50%;");
    expect(rule).toContain(`background: ${background};`);
    expect(rule).toContain("color: #ffffff;");
  });
});
