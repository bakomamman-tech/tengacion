import React, { createContext, useContext, useState, useEffect } from "react";
import {
  THEME_KEY,
  LEGACY_THEME_KEY,
  applyThemeToDocument,
  getNextTheme,
  isSupportedTheme,
  normalizeThemeValue,
  readStoredTheme,
} from "../themeConfig";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => readStoredTheme());
  const isDark = theme === "dark" || theme === "neon-purple";

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.removeItem(LEGACY_THEME_KEY);
    } catch {
      // Ignore storage access errors.
    }

    applyThemeToDocument(theme, document.documentElement);
  }, [theme]);

  const setTheme = (nextTheme) => {
    if (isSupportedTheme(nextTheme)) {
      setThemeState(normalizeThemeValue(nextTheme));
    }
  };

  const toggleTheme = () => {
    setThemeState((current) => getNextTheme(current));
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
