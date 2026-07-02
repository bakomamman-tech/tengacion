import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(testDir, "../index.css");
const messengerPath = resolve(testDir, "../Messenger.jsx");
const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
const messengerSource = readFileSync(messengerPath, "utf8").replace(/\r\n/g, "\n");

function getRule(selector, startAt = 0) {
  const ruleStart = css.indexOf(`${selector} {`, startAt);

  if (ruleStart === -1) {
    return "";
  }

  const ruleEnd = css.indexOf("\n}", ruleStart);

  return css.slice(ruleStart, ruleEnd);
}

describe("themed Messenger CSS", () => {
  it("uses the reduced Light Mode message and composer text sizes", () => {
    const messageRule = getRule([
      ".messenger--whatsapp-light .msg-text,",
      ".messenger--whatsapp-light .message-row.me .msg-text,",
      ".messenger--whatsapp-light .message-row.them .msg-text",
    ].join("\n"));
    const composerRule = getRule(".messenger--whatsapp-light .messenger-composer-entry textarea");

    expect(messageRule).toContain("font-size: 16.425px !important;");
    expect(composerRule).toContain("font-size: 17.4375px !important;");
  });

  it("keeps a long pill-shaped entry with media controls at the voice-button end", () => {
    const rowRule = getRule(".messenger--whatsapp-light .messenger-composer-row");
    const entryRule = getRule(".messenger--whatsapp-light .messenger-composer-entry");
    const pillRule = getRule(".messenger--whatsapp-light .messenger-composer-entry::after");
    const attachRule = getRule(".messenger--whatsapp-light .messenger-composer-attach-inline");

    expect(rowRule).toContain("grid-template-columns: minmax(0, 1fr) max-content !important;");
    expect(entryRule).toContain("border-radius: 999px !important;");
    expect(pillRule).toContain("inset: 0 0 0 40px;");
    expect(pillRule).toContain("border-radius: 999px;");
    expect(getRule(".messenger--whatsapp-light .messenger-composer-entry textarea")).toContain("flex: 1 1 auto;");
    expect(attachRule).toContain("margin-left: auto;");
  });

  it("uses the current Light Mode Messenger structure in every theme", () => {
    expect(messengerSource).toContain("`messenger messenger--whatsapp-light ${");
    expect(messengerSource).not.toContain('theme === "light"');
  });

  it.each([
    "nature-green",
    "peaceful",
    "dark",
    "royalty",
    "afro-gold",
    "terra-minimal",
  ])("provides a blended Messenger palette for %s", (theme) => {
    const palette = getRule(`html[data-theme="${theme}"] .messenger--whatsapp-light`);

    expect(palette).toContain("--wa-green:");
    expect(palette).toContain("--wa-outgoing:");
    expect(palette).toContain("--wa-incoming:");
    expect(palette).toContain("--wa-chat-paper:");
    expect(palette).toContain("--wa-header-bg:");
    expect(palette).toContain("--wa-composer-bg:");
    expect(palette).toContain("--wa-wallpaper-wash:");
  });

});
