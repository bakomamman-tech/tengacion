import { beforeEach, describe, expect, it } from "vitest";

import {
  SUPPORTED_THEMES,
  THEME_KEY,
  applyThemeToDocument,
  getNextTheme,
  getThemeColorScheme,
  getThemeLabel,
  readStoredTheme,
} from "../themeConfig";

describe("themeConfig", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("supports and persists Royalty Mode", () => {
    localStorage.setItem(THEME_KEY, "royalty");

    expect(SUPPORTED_THEMES).toContain("royalty");
    expect(readStoredTheme()).toBe("royalty");
    expect(getThemeLabel("royalty")).toBe("Royalty Mode");
    expect(getThemeColorScheme("royalty")).toBe("dark");
  });

  it("supports and persists Peaceful Mode as a light theme", () => {
    localStorage.setItem(THEME_KEY, "peaceful");

    expect(SUPPORTED_THEMES).toContain("peaceful");
    expect(readStoredTheme()).toBe("peaceful");
    expect(getThemeLabel("peaceful")).toBe("Peaceful Mode");
    expect(getThemeColorScheme("peaceful")).toBe("light");
  });

  it("supports and persists Nature Green as a light theme", () => {
    localStorage.setItem(THEME_KEY, "nature-green");

    expect(SUPPORTED_THEMES).toContain("nature-green");
    expect(readStoredTheme()).toBe("nature-green");
    expect(getThemeLabel("nature-green")).toBe("Nature Green");
    expect(getThemeColorScheme("nature-green")).toBe("light");
  });

  it("supports and persists Afro Gold as a dark-like theme", () => {
    localStorage.setItem(THEME_KEY, "afro-gold");

    expect(SUPPORTED_THEMES).toContain("afro-gold");
    expect(readStoredTheme()).toBe("afro-gold");
    expect(getThemeLabel("afro-gold")).toBe("Afro Gold");
    expect(getThemeColorScheme("afro-gold")).toBe("dark");
  });

  it("applies the dark-like royalty document classes", () => {
    const root = document.createElement("div");

    applyThemeToDocument("royalty", root);

    expect(root.dataset.theme).toBe("royalty");
    expect(root).toHaveClass("dark-mode", "royalty-mode");
    expect(root).not.toHaveClass("nature-green-mode", "afro-gold-mode");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("applies the light-like peaceful document classes", () => {
    const root = document.createElement("div");

    applyThemeToDocument("peaceful", root);

    expect(root.dataset.theme).toBe("peaceful");
    expect(root).toHaveClass("peaceful-mode");
    expect(root).not.toHaveClass(
      "dark-mode",
      "royalty-mode",
      "nature-green-mode",
      "afro-gold-mode"
    );
    expect(root.style.colorScheme).toBe("light");
  });

  it("applies the light-like Nature Green document classes", () => {
    const root = document.createElement("div");

    applyThemeToDocument("nature-green", root);

    expect(root.dataset.theme).toBe("nature-green");
    expect(root).toHaveClass("nature-green-mode");
    expect(root).not.toHaveClass("dark-mode", "peaceful-mode", "royalty-mode", "afro-gold-mode");
    expect(root.style.colorScheme).toBe("light");
  });

  it("applies the dark-like Afro Gold document classes", () => {
    const root = document.createElement("div");

    applyThemeToDocument("afro-gold", root);

    expect(root.dataset.theme).toBe("afro-gold");
    expect(root).toHaveClass("dark-mode", "afro-gold-mode");
    expect(root).not.toHaveClass("peaceful-mode", "royalty-mode", "nature-green-mode");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("includes Royalty Mode in the theme cycle", () => {
    expect(getNextTheme("dark")).toBe("royalty");
    expect(getNextTheme("royalty")).toBe("afro-gold");
    expect(getNextTheme("afro-gold")).toBe("light");
  });

  it("includes Nature Green and Peaceful Mode after Light Mode in the theme cycle", () => {
    expect(getNextTheme("light")).toBe("nature-green");
    expect(getNextTheme("nature-green")).toBe("peaceful");
    expect(getNextTheme("peaceful")).toBe("dark");
  });

  it("falls back to Light Mode for unknown stored themes", () => {
    localStorage.setItem(THEME_KEY, "removed-theme");

    expect(readStoredTheme()).toBe("light");
    expect(getThemeLabel("removed-theme")).toBe("Light Mode");
    expect(getThemeColorScheme("removed-theme")).toBe("light");
  });
});
