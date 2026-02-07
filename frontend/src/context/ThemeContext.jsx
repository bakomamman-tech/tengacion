import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage first
    const saved = localStorage.getItem("tengacion-theme");
    if (saved) return saved === "dark";
    
    // Check system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    // Save preference
    localStorage.setItem("tengacion-theme", isDark ? "dark" : "light");
    
    // Update document class
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

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
