import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import { ThemeProvider } from "./context/ThemeContext";
import { CreatorPlayerProvider } from "./context/CreatorPlayerContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { DialogProvider } from "./components/ui/DialogProvider";
import { initializeGoogleAnalytics } from "./lib/analytics";
import {
  DEFAULT_THEME,
  LEGACY_THEME_KEY,
  THEME_KEY,
  applyThemeToDocument,
  readStoredTheme,
} from "./themeConfig";

import "./index.css";
import "./button-system.css";
import "./dialog-system.css";
import "./features/news/news.css";

const initializeThemeEarly = () => {
  if (typeof window === "undefined") {
    return;
  }

  const theme = readStoredTheme();

  try {
    localStorage.setItem(THEME_KEY, theme || DEFAULT_THEME);
    localStorage.removeItem(LEGACY_THEME_KEY);
  } catch {
    // Ignore storage access issues and keep the document theme in sync.
  }

  applyThemeToDocument(theme, document.documentElement);
};

initializeThemeEarly();
void initializeGoogleAnalytics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <NotificationsProvider>
            <BrowserRouter>
              <CreatorPlayerProvider>
                <DialogProvider>
                  <App />
                  <Toaster
                    position="top-center"
                    toastOptions={{
                      duration: 3200,
                      style: {
                        borderRadius: "18px",
                        border: "1px solid var(--tg-toast-border)",
                        background: "var(--tg-toast-bg)",
                        color: "var(--tg-toast-text)",
                        boxShadow: "var(--tg-toast-shadow)",
                      },
                      success: {
                        iconTheme: {
                          primary: "#bb833f",
                          secondary: "#fff8ef",
                        },
                      },
                      error: {
                        iconTheme: {
                          primary: "#ab5849",
                          secondary: "#fff7f4",
                        },
                      },
                    }}
                  />
                </DialogProvider>
              </CreatorPlayerProvider>
            </BrowserRouter>
          </NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.update().catch(() => null);
      })
      .catch(() => null);
  });
}
