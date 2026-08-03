import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(testDir, "../pages/trending.css"), "utf8").replace(/\r\n/g, "\n");
const source = readFileSync(resolve(testDir, "../pages/Trending.jsx"), "utf8");

describe("modern Trending page", () => {
  it("uses shared semantic theme colors for every app theme", () => {
    expect(css).toContain("--trending-panel: color-mix(in srgb, var(--surface)");
    expect(css).toContain("color: var(--text);");
    expect(css).toContain("color: var(--muted);");
    expect(css).toContain("background: var(--brand);");
    expect(css).toContain("color: var(--btn-text);");
  });

  it("fills the desktop shell and adapts its rails and controls at smaller widths", () => {
    expect(css).toContain(".app-shell.trending-shell {");
    expect(css).toContain("grid-template-columns: 280px minmax(0, 1fr) 320px;");
    expect(css).toContain("@media (max-width: 1100px)");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain("@media (max-width: 500px)");
  });

  it("provides reduced-motion and forced-color fallbacks", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@media (forced-colors: active)");
  });

  it("does not ship corrupted emoji text from the legacy page", () => {
    expect(source).not.toMatch(/\u00f0\u0178|\u00e2\u0153|\u00e2\u00ad/);
  });
});
