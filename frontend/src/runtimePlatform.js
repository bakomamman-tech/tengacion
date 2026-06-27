import { Capacitor } from "@capacitor/core";

export const isNativeApp = () => Capacitor.isNativePlatform();

export const getNativePlatform = () =>
  isNativeApp() ? Capacitor.getPlatform() : "web";

export const isMobileStoreBuild = () =>
  isNativeApp() || String(import.meta.env.VITE_MOBILE_STORE_BUILD || "").toLowerCase() === "true";

export const assertExternalDigitalCheckoutAllowed = () => {
  if (!isMobileStoreBuild()) {
    return;
  }

  throw new Error(
    "Purchases of digital content are temporarily unavailable in this app-store build. " +
      "You can still access content you already own."
  );
};
