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

  it("applies the dark-like royalty document classes", () => {
    const root = document.createElement("div");

    applyThemeToDocument("royalty", root);

    expect(root.dataset.theme).toBe("royalty");
    expect(root).toHaveClass("dark-mode", "royalty-mode");
    expect(root).not.toHaveClass("neon-purple-mode");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("applies the light-like peaceful document classes", () => {
    const root = document.createElement("div");

    applyThemeToDocument("peaceful", root);

    expect(root.dataset.theme).toBe("peaceful");
    expect(root).toHaveClass("peaceful-mode");
    expect(root).not.toHaveClass("dark-mode", "royalty-mode", "neon-purple-mode");
    expect(root.style.colorScheme).toBe("light");
  });

  it("includes Royalty Mode in the theme cycle", () => {
    expect(getNextTheme("neon-purple")).toBe("royalty");
    expect(getNextTheme("royalty")).toBe("light");
  });

  it("includes Peaceful Mode after Light Mode in the theme cycle", () => {
    expect(getNextTheme("light")).toBe("peaceful");
    expect(getNextTheme("peaceful")).toBe("dark");
  });
});
