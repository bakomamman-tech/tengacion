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

import "./index.css";
import "./button-system.css";
import "./dialog-system.css";
import "./features/news/news.css";

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
            <CreatorPlayerProvider>
              <BrowserRouter>
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
              </BrowserRouter>
            </CreatorPlayerProvider>
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
