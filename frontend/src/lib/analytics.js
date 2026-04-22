const GOOGLE_TAG_MANAGER_URL = "https://www.googletagmanager.com/gtag/js";
const GA_MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID || "").trim();
const GA_DEBUG_MODE = String(import.meta.env.VITE_GA_DEBUG_MODE || "").trim().toLowerCase() === "true";

let scriptPromise = null;
let initializedMeasurementId = "";
let lastTrackedKey = "";
let lastTrackedLocation = "";

const ensureDataLayer = () => {
  if (typeof window === "undefined") {
    return null;
  }

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
    if (typeof document === "undefined") {
      resolve(false);
      return;
    }

    const existingScript = document.head.querySelector('script[data-analytics="google-tag-manager"]');
    if (existingScript) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = `${GOOGLE_TAG_MANAGER_URL}?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
    script.setAttribute("data-analytics", "google-tag-manager");
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    document.head.appendChild(script);
  });

  return scriptPromise;
};

export const getGoogleAnalyticsMeasurementId = () => GA_MEASUREMENT_ID;

export const isGoogleAnalyticsEnabled = () =>
  Boolean(
    GA_MEASUREMENT_ID
    && typeof window !== "undefined"
    && typeof document !== "undefined"
  );

export const initializeGoogleAnalytics = async () => {
  if (!isGoogleAnalyticsEnabled()) {
    return false;
  }

  const gtag = ensureDataLayer();
  if (!gtag) {
    return false;
  }

  if (initializedMeasurementId !== GA_MEASUREMENT_ID) {
    initializedMeasurementId = GA_MEASUREMENT_ID;
    gtag("js", new Date());
    gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: false,
      ...(GA_DEBUG_MODE ? { debug_mode: true } : {}),
    });
  }

  void ensureGoogleAnalyticsScript();
  return true;
};

export const trackPageView = async ({ path = "", title = "", referrer = "" } = {}) => {
  if (!isGoogleAnalyticsEnabled()) {
    return false;
  }

  const initialized = await initializeGoogleAnalytics();
  if (!initialized || typeof window === "undefined") {
    return false;
  }

  const safePath =
    String(path || `${window.location.pathname}${window.location.search}${window.location.hash}`).trim()
    || "/";
  const safeTitle = String(title || document.title || "Tengacion").trim() || "Tengacion";
  const pageLocation = new URL(safePath, window.location.origin).toString();
  const pageReferrer = String(referrer || lastTrackedLocation || document.referrer || "").trim();
  const trackingKey = `${safePath}::${safeTitle}`;

  if (trackingKey === lastTrackedKey) {
    return false;
  }

  window.gtag?.("event", "page_view", {
    page_title: safeTitle,
    page_path: safePath,
    page_location: pageLocation,
    ...(pageReferrer ? { page_referrer: pageReferrer } : {}),
    ...(GA_DEBUG_MODE ? { debug_mode: true } : {}),
  });

  lastTrackedKey = trackingKey;
  lastTrackedLocation = pageLocation;
  return true;
};
