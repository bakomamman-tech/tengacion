import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import { ThemeProvider } from "./context/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";

import "./index.css";

const initializeThemeEarly = () => {
  if (typeof window === "undefined") {
    return;
  }

  const KEY = "tengacion_theme";
  const LEGACY_KEY = "tengacion-theme";
  let theme = "dark";

  try {
    const stored = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
    if (stored === "dark" || stored === "light") {
      theme = stored;
    } else {
      localStorage.setItem(KEY, theme);
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Ignore storage access issues and keep dark default.
  }

  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  if (theme === "dark") {
    root.classList.add("dark-mode");
  } else {
    root.classList.remove("dark-mode");
  }
};

initializeThemeEarly();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <NotificationsProvider>
            <BrowserRouter>
              <App />
              <Toaster />
            </BrowserRouter>
          </NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
