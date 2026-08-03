import { getSessionAccessToken } from "../authSession";
import { API_BASE } from "../config/apiBase";
import {
  ROUTE_ANALYTICS_CONTRACT,
  buildRouteAnalyticsEvent,
  getRouteTruthMatch,
} from "../config/routeTruth";

const GOOGLE_TAG_MANAGER_URL = "https://www.googletagmanager.com/gtag/js";
const GA_MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID || "").trim();
const GA_DEBUG_MODE =
  String(import.meta.env.VITE_GA_DEBUG_MODE || "").trim().toLowerCase() === "true";
export const SEO_PAGEVIEW_EVENT = "tengacion:seo-updated";

let scriptPromise = null;
let initialized = false;
let lastTrackedNavigation = "";

const canUseBrowser = () =>
  typeof window !== "undefined" && typeof document !== "undefined";

export const getGoogleAnalyticsMeasurementId = () => GA_MEASUREMENT_ID;

export const isGoogleAnalyticsEnabled = () =>
  Boolean(GA_MEASUREMENT_ID) && canUseBrowser();

const ensureDataLayer = () => {
  if (!canUseBrowser()) {return null;}

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };

  return window.gtag;
};

const ensureGoogleAnalyticsScript = () => {
  if (!isGoogleAnalyticsEnabled()) {
    return Promise.resolve(false);
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve) => {
    const existingScript = document.head.querySelector(
      'script[data-analytics="google-tag-manager"]'
    );

    if (existingScript) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = `${GOOGLE_TAG_MANAGER_URL}?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
    script.setAttribute("data-analytics", "google-tag-manager");

    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.head.appendChild(script);
  });

  return scriptPromise;
};

export const initializeGoogleAnalytics = async () => {
  if (!isGoogleAnalyticsEnabled()) {
    return false;
  }

  const gtag = ensureDataLayer();
  if (!gtag) {
    return false;
  }

  const scriptLoaded = await ensureGoogleAnalyticsScript();
  if (!scriptLoaded) {
    return false;
  }

  if (!initialized) {
    gtag("js", new Date());
    gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: false,
      ...(GA_DEBUG_MODE ? { debug_mode: true } : {}),
    });
    initialized = true;
  }

  return true;
};

export const initAnalytics = () => initializeGoogleAnalytics();

const sendInternalRouteView = async (event) => {
  if (!event || !canUseBrowser() || typeof fetch !== "function") {
    return false;
  }

  const token = getSessionAccessToken();

  try {
    const response = await fetch(
      `${API_BASE}${ROUTE_ANALYTICS_CONTRACT.endpoint.replace(/^\/api/, "")}`,
      {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(event),
      }
    );

    return response.ok;
  } catch {
    return false;
  }
};

const sendGoogleRouteView = async ({ routePattern, featureTitle }) => {
  if (!isGoogleAnalyticsEnabled()) {
    return false;
  }

  const ok = await initializeGoogleAnalytics();
  if (!ok) {
    return false;
  }

  const pageLocation = new URL(routePattern, window.location.origin).toString();

  window.gtag("event", "page_view", {
    page_title: featureTitle,
    page_path: routePattern,
    page_location: pageLocation,
    ...(GA_DEBUG_MODE ? { debug_mode: true } : {}),
  });

  return true;
};

export const trackPageView = async ({
  path,
  navigationKey,
} = {}) => {
  if (!canUseBrowser()) {
    return false;
  }

  const resolvedPath = String(path || window.location.pathname).trim() || "/";
  const match = getRouteTruthMatch(resolvedPath);
  const event = buildRouteAnalyticsEvent(resolvedPath);
  if (!match || !event) {
    return false;
  }

  const dedupeKey = String(navigationKey || resolvedPath).trim();
  if (dedupeKey && dedupeKey === lastTrackedNavigation) {
    return false;
  }
  lastTrackedNavigation = dedupeKey;

  const [internalRecorded, googleRecorded] = await Promise.all([
    sendInternalRouteView(event),
    sendGoogleRouteView({
      routePattern: match.routePattern,
      featureTitle: match.feature.title,
    }),
  ]);

  return internalRecorded || googleRecorded;
};

export const trackEvent = async (eventName, params = {}) => {
  if (!eventName || !isGoogleAnalyticsEnabled()) {
    return false;
  }

  const ok = await initializeGoogleAnalytics();
  if (!ok) {
    return false;
  }

  window.gtag("event", eventName, {
    ...params,
    ...(GA_DEBUG_MODE ? { debug_mode: true } : {}),
  });

  return true;
};
