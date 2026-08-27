const STORAGE_KEY = "tengacion-bandwidth-mode";
const VALID_MODES = new Set(["auto", "low", "full"]);

export const getStoredBandwidthMode = () => {
  try {
    const value = String(window.localStorage.getItem(STORAGE_KEY) || "auto").toLowerCase();
    return VALID_MODES.has(value) ? value : "auto";
  } catch {
    return "auto";
  }
};

export const resolveLowBandwidthMode = ({ storedMode = "auto", connection = null } = {}) => {
  if (storedMode === "low") {
    return true;
  }
  if (storedMode === "full") {
    return false;
  }
  return Boolean(connection?.saveData || ["slow-2g", "2g"].includes(String(connection?.effectiveType || "").toLowerCase()));
};

export const setBandwidthMode = (mode = "auto") => {
  const normalized = String(mode || "auto").toLowerCase();
  if (!VALID_MODES.has(normalized)) {
    return false;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, normalized);
    window.dispatchEvent(new CustomEvent("tengacion:bandwidth-mode", { detail: normalized }));
    return true;
  } catch {
    return false;
  }
};
