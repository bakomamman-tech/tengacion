export const THEME_KEY = "tengacion_theme";
export const LEGACY_THEME_KEY = "tengacion-theme";
export const DEFAULT_THEME = "light";
export const SUPPORTED_THEMES = [
  "light",
  "nature-green",
  "peaceful",
  "dark",
  "neon-purple",
  "royalty",
  "afro-gold",
];

const THEME_LABELS = {
  light: "Light Mode",
  "nature-green": "Nature Green",
  peaceful: "Peaceful Mode",
  dark: "Dark Mode",
  "neon-purple": "Neon Purple Mode",
  royalty: "Royalty Mode",
  "afro-gold": "Afro Gold",
};

const DARK_LIKE_THEMES = ["dark", "neon-purple", "royalty", "afro-gold"];
const THEME_MODE_CLASSES = [
  "peaceful-mode",
  "neon-purple-mode",
  "royalty-mode",
  "nature-green-mode",
  "afro-gold-mode",
  "turquoise-mode",
];

export function normalizeThemeValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "turquoise") {
    return "neon-purple";
  }
  return normalized;
}

export function isSupportedTheme(value) {
  return SUPPORTED_THEMES.includes(normalizeThemeValue(value));
}

export function getThemeLabel(value) {
  return THEME_LABELS[normalizeThemeValue(value)] || THEME_LABELS[DEFAULT_THEME];
}

export function getThemeColorScheme(value) {
  return DARK_LIKE_THEMES.includes(normalizeThemeValue(value))
    ? "dark"
    : "light";
}

export function getNextTheme(value) {
  const currentIndex = SUPPORTED_THEMES.indexOf(normalizeThemeValue(value));
  const nextIndex =
    currentIndex >= 0 ? (currentIndex + 1) % SUPPORTED_THEMES.length : 0;
  return SUPPORTED_THEMES[nextIndex] || DEFAULT_THEME;
}

export function readStoredTheme() {
  try {
    const stored = normalizeThemeValue(
      localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY)
    );
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

  const nextTheme = isSupportedTheme(theme)
    ? normalizeThemeValue(theme)
    : DEFAULT_THEME;
  const isDarkLikeTheme = DARK_LIKE_THEMES.includes(nextTheme);
  root.dataset.theme = nextTheme;
  root.classList.toggle("dark-mode", isDarkLikeTheme);
  THEME_MODE_CLASSES.forEach((className) => root.classList.remove(className));
  root.classList.toggle("peaceful-mode", nextTheme === "peaceful");
  root.classList.toggle("neon-purple-mode", nextTheme === "neon-purple");
  root.classList.toggle("royalty-mode", nextTheme === "royalty");
  root.classList.toggle("nature-green-mode", nextTheme === "nature-green");
  root.classList.toggle("afro-gold-mode", nextTheme === "afro-gold");
  root.style.colorScheme = getThemeColorScheme(nextTheme);
}
