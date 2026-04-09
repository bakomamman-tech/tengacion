export const THEME_KEY = "tengacion_theme";
export const LEGACY_THEME_KEY = "tengacion-theme";
export const DEFAULT_THEME = "light";
export const SUPPORTED_THEMES = ["light", "dark", "turquoise"];

const THEME_LABELS = {
  light: "Light Mode",
  dark: "Dark Mode",
  turquoise: "Turquoise Mode",
};

export function isSupportedTheme(value) {
  return SUPPORTED_THEMES.includes(value);
}

export function getThemeLabel(value) {
  return THEME_LABELS[value] || THEME_LABELS[DEFAULT_THEME];
}

export function getThemeColorScheme(value) {
  return value === "dark" ? "dark" : "light";
}

export function getNextTheme(value) {
  const currentIndex = SUPPORTED_THEMES.indexOf(value);
  const nextIndex =
    currentIndex >= 0 ? (currentIndex + 1) % SUPPORTED_THEMES.length : 0;
  return SUPPORTED_THEMES[nextIndex] || DEFAULT_THEME;
}

export function readStoredTheme() {
  try {
    const stored =
      localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY);
    if (isSupportedTheme(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage access errors and fall back to the default theme.
  }

  return DEFAULT_THEME;
}

export function applyThemeToDocument(theme, root = document.documentElement) {
  if (!root) {
    return;
  }

  const nextTheme = isSupportedTheme(theme) ? theme : DEFAULT_THEME;
  root.dataset.theme = nextTheme;
  root.classList.toggle("dark-mode", nextTheme === "dark");
  root.classList.toggle("turquoise-mode", nextTheme === "turquoise");
  root.style.colorScheme = getThemeColorScheme(nextTheme);
}
