import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();
const THEME_KEY = "tengacion_theme";
const LEGACY_THEME_KEY = "tengacion-theme";

const readStoredTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY);
    if (stored === "dark" || stored === "light") {
      return stored;
    }
  } catch {
    // Ignore storage access errors and fall back to dark.
  }
  return "dark";
};

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    return readStoredTheme() === "dark";
  });

  useEffect(() => {
    const nextTheme = isDark ? "dark" : "light";
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
      localStorage.removeItem(LEGACY_THEME_KEY);
    } catch {
      // Ignore storage access errors.
    }

    document.documentElement.dataset.theme = nextTheme;
    if (isDark) {
      document.documentElement.classList.add("dark-mode");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark-mode");
      document.documentElement.style.colorScheme = "light";
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
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
