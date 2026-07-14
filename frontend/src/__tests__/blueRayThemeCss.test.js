import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(testDir, "../blue-ray-theme.css");

function getRule(css, selector) {
  const ruleStart = css.indexOf(`${selector} {`);

  if (ruleStart === -1) {
    return "";
  }

  const ruleEnd = css.indexOf("\n}", ruleStart);

  return css.slice(ruleStart, ruleEnd);
}

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrast(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));

  return (lighter + 0.05) / (darker + 0.05);
}

describe("Blue Ray theme CSS", () => {
  const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");

  it("uses a modern layered palette with accessible core colors", () => {
    const rootRule = getRule(css, "html.blue-ray-mode");
    const bodyRule = getRule(css, "html.blue-ray-mode body");

    expect(rootRule).toContain("color-scheme: light;");
    expect(rootRule).toContain("--bg-layer:");
    expect(rootRule).toContain("--brand: #2563eb;");
    expect(rootRule).toContain("--brand-strong: #1d4ed8;");
    expect(rootRule).toContain("--text: #12223d;");
    expect(rootRule).toContain("--muted: #53657e;");
    expect(rootRule).toContain("--ux-radius-card: 22px;");
    expect(bodyRule).toContain("background-image: var(--bg-layer);");
    expect(bodyRule).toContain("background-attachment: fixed;");
    expect(contrast("#2563eb", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#53657e", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(css).not.toContain("Facebook-inspired");
    expect(css).not.toContain("#1877f2");
  });

  it("keeps shared button behavior token-driven and covers every interaction state", () => {
    const rootRule = getRule(css, "html.blue-ray-mode");

    expect(rootRule).toContain("--tg-btn-primary-bg:");
    expect(rootRule).toContain("--tg-btn-primary-bg-hover:");
    expect(rootRule).toContain("--tg-btn-primary-bg-active:");
    expect(rootRule).toContain("--tg-btn-secondary-bg-active:");
    expect(rootRule).toContain("--tg-btn-ghost-bg-hover:");
    expect(rootRule).toContain("--tg-btn-outline-bg-active:");
    expect(rootRule).toContain("--tg-btn-tab-bg-active:");
    expect(rootRule).toContain("--tg-btn-icon-bg-active:");
    expect(css).toContain(":active:not(:disabled)");
    expect(css).toContain(":focus-visible");
    expect(css).not.toContain(".tg-btn--primary");
    expect(css).not.toContain(".tg-btn--secondary");
    expect(css).not.toContain(".tg-btn--outline");
  });

  it("themes the real navigation surfaces and preserves semantic action colors", () => {
    expect(css).toContain(".nav-messenger-dropdown");
    expect(css).not.toContain(".messenger-inbox-dropdown");
    expect(css).toContain(".post-menu-dropdown");
    expect(css).toContain(".create-post-quick-btn--media:hover");
    expect(css).toContain("rgba(34, 197, 94, 0.18)");
    expect(css).toContain(".create-post-quick-btn--live:hover");
    expect(css).toContain("rgba(239, 68, 68, 0.18)");
    expect(css).toContain(".create-post-quick-btn--reel:hover");
    expect(css).toContain("rgba(249, 115, 22, 0.18)");
    expect(css).not.toContain("html.blue-ray-mode .post-actions .action-btn.active-like");
  });

  it("keeps the raffle card and its controls readable", () => {
    const cardRule = getRule(css, "html.blue-ray-mode .sidebar-raffle-card");
    const copyRule = getRule(css, "html.blue-ray-mode .sidebar-raffle-copy");
    const toggleRule = getRule(css, "html.blue-ray-mode .sidebar-raffle-toggle");
    const buttonRule = getRule(css, "html.blue-ray-mode .sidebar-raffle-btn");

    expect(cardRule).toContain("linear-gradient(145deg, #173c7a");
    expect(cardRule).toContain("color: #f8fbff;");
    expect(copyRule).toContain("rgba(232, 241, 255, 0.86)");
    expect(toggleRule).toContain("color: #f8fbff;");
    expect(buttonRule).toContain("color: #17458e !important;");
  });

  it("provides complete Messenger and creator palettes", () => {
    const messengerRule = getRule(css, "html.blue-ray-mode .messenger--whatsapp-light");
    const discoveryRule = getRule(css, "html.blue-ray-mode .creator-discovery-theme");
    const workspaceRule = getRule(css, "html.blue-ray-mode .creator-shell");

    expect(messengerRule).toContain("--wa-green: #2563eb;");
    expect(messengerRule).toContain("--wa-chat-paper: #eef4ff;");
    expect(discoveryRule).toContain("--creator-discovery-bg:");
    expect(discoveryRule).toContain("--creator-discovery-control-active-bg:");
    expect(discoveryRule).toContain("--creator-summary-refresh-bg:");
    expect(workspaceRule).toContain("--creator-sidebar-surface:");
    expect(workspaceRule).toContain("--creator-surface-raised:");
    expect(workspaceRule).toContain("--creator-control-surface:");
    expect(workspaceRule).toContain("--creator-control-active:");
    expect(workspaceRule).toContain("--creator-focus-ring:");
  });
});
