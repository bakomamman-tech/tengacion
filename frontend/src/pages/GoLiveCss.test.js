import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(testDir, "./GoLive.css"), "utf8").replace(/\r\n/g, "\n");

describe("Go Live Meet-style layout", () => {
  it("provides a dark responsive stage and docked controls", () => {
    expect(css).toContain(".go-live-meet-page .go-live-meeting {");
    expect(css).toContain("background: #101112;");
    expect(css).toContain(".go-live-meet-page .live-controls-shell {");
    expect(css).toContain(".go-live-meeting__layout.has-chat {");
  });

  it("keeps the mobile control dock reachable", () => {
    const mobileStart = css.indexOf("@media (max-width: 560px)");
    const mobileCss = css.slice(mobileStart);

    expect(mobileCss).toContain("position: sticky;");
    expect(mobileCss).toContain("bottom: 8px;");
    expect(mobileCss).toContain("width: 48px;");
  });
});
