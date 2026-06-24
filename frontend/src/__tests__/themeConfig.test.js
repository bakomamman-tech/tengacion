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

  it("applies the dark-like royalty document classes", () => {
    const root = document.createElement("div");

    applyThemeToDocument("royalty", root);

    expect(root.dataset.theme).toBe("royalty");
    expect(root).toHaveClass("dark-mode", "royalty-mode");
    expect(root).not.toHaveClass("neon-purple-mode");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("includes Royalty Mode in the theme cycle", () => {
    expect(getNextTheme("neon-purple")).toBe("royalty");
    expect(getNextTheme("royalty")).toBe("light");
  });
});
