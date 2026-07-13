import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(testDir, "../admin-users.css");

const hexToRgb = (hex) => {
  const normalized = hex.replace("#", "");
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16) / 255);
};

const relativeLuminance = (hex) => {
  const channels = hexToRgb(hex).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (foreground, background) => {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

describe("Admin user detail styles", () => {
  it("keeps emergency contact surfaces readable and above floating application controls", () => {
    const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");

    expect(css).toContain("position: fixed;");
    expect(css).toContain("inset: 0;");
    expect(css).toContain("z-index: 1400;");
    expect(css).toContain("max-height: calc(100dvh - 32px);");
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("--admin-user-text: #f3fff7;");
    expect(css).toContain("color: #102319;");
    expect(css).toContain("#f2fff6;");
    expect(css).toContain("user-select: text;");

    expect(contrastRatio("#f3fff7", "#0b2117")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#b4d8c1", "#0b2117")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#102319", "#f2fff6")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#42614c", "#f2fff6")).toBeGreaterThanOrEqual(4.5);
  });

  it("stacks contact information and controls on narrow screens", () => {
    const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
    const mobileStyles = css.slice(css.indexOf("@media (max-width: 640px)"));

    expect(mobileStyles).toContain(".adminx-user-modal__contact-row");
    expect(mobileStyles).toContain("grid-template-columns: 1fr;");
    expect(mobileStyles).toContain(".adminx-user-modal__details-grid");
    expect(mobileStyles).toContain("width: 100%;");
  });
});
