import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { SEO_PAGEVIEW_EVENT, trackPageView } from "../lib/analytics";

const PAGEVIEW_FALLBACK_DELAY_MS = 250;

export default function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    let tracked = false;

    const sendPageView = ({ path = currentPath, title } = {}) => {
      const resolvedPath = String(path || currentPath).trim() || currentPath;
      if (resolvedPath !== currentPath || tracked) {
        return;
      }

      tracked = true;
      void trackPageView({
        path: resolvedPath,
        title: String(title || document.title || "").trim() || document.title,
      });
    };

    const handleSeoReady = (event) => {
      sendPageView({
        path: event?.detail?.path,
        title: event?.detail?.title,
      });
    };

    const fallbackTimer = window.setTimeout(() => {
      sendPageView();
    }, PAGEVIEW_FALLBACK_DELAY_MS);

    window.addEventListener(SEO_PAGEVIEW_EVENT, handleSeoReady);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener(SEO_PAGEVIEW_EVENT, handleSeoReady);
    };
  }, [location.hash, location.key, location.pathname, location.search]);
}
