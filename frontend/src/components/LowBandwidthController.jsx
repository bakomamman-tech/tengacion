import { useEffect } from "react";
import { getStoredBandwidthMode, resolveLowBandwidthMode } from "../lib/bandwidthMode";

const applyMediaPolicy = (root, lowBandwidth) => {
  if (!root?.querySelectorAll) {
    return;
  }
  root.querySelectorAll("video, audio").forEach((media) => {
    if (!media.dataset.defaultPreload) {
      media.dataset.defaultPreload = media.getAttribute("preload") || "metadata";
    }
    media.setAttribute("preload", lowBandwidth ? "none" : media.dataset.defaultPreload);
  });
};

export default function LowBandwidthController() {
  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    let observer = null;

    const apply = () => {
      const lowBandwidth = resolveLowBandwidthMode({
        storedMode: getStoredBandwidthMode(),
        connection,
      });
      document.documentElement.dataset.bandwidthMode = lowBandwidth ? "low" : "full";
      applyMediaPolicy(document, lowBandwidth);
      observer?.disconnect();
      observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) {
              return;
            }
            if (node.matches?.("video, audio")) {
              applyMediaPolicy({ querySelectorAll: () => [node] }, lowBandwidth);
            }
            applyMediaPolicy(node, lowBandwidth);
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };

    apply();
    connection?.addEventListener?.("change", apply);
    window.addEventListener("tengacion:bandwidth-mode", apply);
    return () => {
      observer?.disconnect();
      connection?.removeEventListener?.("change", apply);
      window.removeEventListener("tengacion:bandwidth-mode", apply);
      delete document.documentElement.dataset.bandwidthMode;
    };
  }, []);

  return null;
}
