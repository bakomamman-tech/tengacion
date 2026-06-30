import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SUPPORTED_THEMES } from "../themeConfig";

const testDir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(testDir, "../pages/admin-dashboard.css");
const analyticsChartPath = resolve(testDir, "../components/adminDashboard/AnalyticsChartCard.jsx");
const ageChartPath = resolve(testDir, "../components/adminDashboard/AudienceAgeCard.jsx");

const paletteTokens = [
  "--tdash-main-text",
  "--tdash-main-muted",
  "--tdash-sidebar-text",
  "--tdash-sidebar-muted",
  "--tdash-surface-text",
  "--tdash-surface-muted",
  "--tdash-summary-text",
  "--tdash-summary-muted",
  "--tdash-popover-text",
  "--tdash-popover-muted",
  "--tdash-control-text",
  "--tdash-control-muted",
  "--tdash-positive",
  "--tdash-negative",
  "--tdash-chart-axis",
  "--tdash-chart-grid",
];

function getRule(css, selector) {
  const marker = `${selector} {`;
  const ruleStart = css.indexOf(marker);
  if (ruleStart === -1) {
    return "";
  }
  const ruleEnd = css.indexOf("\n}", ruleStart);
  return css.slice(ruleStart, ruleEnd);
}

function getHexToken(rule, token) {
  return rule.match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, "i"))?.[1] || "";
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

describe("admin dashboard theme contrast CSS", () => {
  const css = readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
  const baseRule = getRule(css, ".tdash-page");

  it.each(SUPPORTED_THEMES)("provides a complete surface-aware palette for %s", (theme) => {
    const themeRule = getRule(css, `html[data-theme="${theme}"] .tdash-page`);
    const effectiveRule = `${baseRule}\n${themeRule}`;

    paletteTokens.forEach((token) => {
      expect(effectiveRule, `${theme} is missing ${token}`).toContain(`${token}:`);
    });
  });

  it.each([
    {
      name: "default dashboard surfaces",
      rule: baseRule,
      surfaces: { main: "#f8f9fd", sidebar: "#101b31", surface: "#121f3b" },
    },
    {
      name: "Nature Green surfaces",
      rule: getRule(css, 'html[data-theme="nature-green"] .tdash-page'),
      surfaces: { main: "#fbfaf1", sidebar: "#f1f8e7", surface: "#f1f8e7" },
    },
    {
      name: "Afro Gold surfaces",
      rule: getRule(css, 'html[data-theme="afro-gold"] .tdash-page'),
      surfaces: { main: "#0b0805", sidebar: "#14100b", surface: "#14100b" },
    },
  ])("keeps normal and muted text readable on $name", ({ rule, surfaces }) => {
    [
      ["--tdash-main-text", surfaces.main],
      ["--tdash-main-muted", surfaces.main],
      ["--tdash-sidebar-text", surfaces.sidebar],
      ["--tdash-sidebar-muted", surfaces.sidebar],
      ["--tdash-surface-text", surfaces.surface],
      ["--tdash-surface-muted", surfaces.surface],
    ].forEach(([token, background]) => {
      expect(contrast(getHexToken(rule, token), background), token).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("uses the surface tokens in navigation, cards, controls, and charts", () => {
    const analyticsChart = readFileSync(analyticsChartPath, "utf8");
    const ageChart = readFileSync(ageChartPath, "utf8");

    expect(getRule(css, ".tdash-sidebar__item")).toContain("color: var(--tdash-sidebar-text);");
    expect(getRule(css, ".tdash-panel,\n.tdash-stat-card")).toContain("color: var(--tdash-surface-text);");
    expect(getRule(css, ".tdash-header__profile-name")).toContain("color: var(--tdash-control-text);");
    expect(getRule(css, ".tdash-summary-card")).toContain("color: var(--tdash-surface-text);");
    expect(analyticsChart).toContain('stroke="var(--tdash-chart-axis)"');
    expect(ageChart).toContain('stroke="var(--tdash-chart-axis)"');
  });
});
