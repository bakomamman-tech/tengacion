import "./voicebridgeAtCallout.css";
import { createVoicebridgeDiagnosticControls } from "./voicebridgeTranscriptDiagnosticControls";

const CALLOUT_ID = "voicebridge-africastalking-callout";
const VOICE_NUMBER = "+2342017000692";
const DISPLAY_NUMBER = "+234 201 700 0692";

const removeCallout = () => {
  document.getElementById(CALLOUT_ID)?.remove();
};

const createCallout = () => {
  const callout = document.createElement("aside");
  callout.id = CALLOUT_ID;
  callout.setAttribute(
    "aria-label",
    "Africa's Talking Voice access for Tengacion VoiceBridge"
  );

  const kicker = document.createElement("p");
  kicker.className = "vb-at-kicker";
  kicker.textContent = "Live phone channel";

  const title = document.createElement("strong");
  title.className = "vb-at-title";
  title.textContent = "Africa's Talking Voice × Tengacion VoiceBridge";

  const phoneLink = document.createElement("a");
  phoneLink.className = "vb-at-number";
  phoneLink.href = `tel:${VOICE_NUMBER}`;
  phoneLink.setAttribute(
    "aria-label",
    `Call Tengacion VoiceBridge on ${DISPLAY_NUMBER}`
  );
  phoneLink.textContent = `☎ ${DISPLAY_NUMBER}`;

  const note = document.createElement("span");
  note.className = "vb-at-note";
  note.textContent =
    "Call the dedicated Nigeria number to enter the VoiceBridge phone flow. Africa's Talking provides telephony access; Sahara remains the speech-intelligence layer.";

  callout.append(kicker, title, phoneLink, note);

  const diagnostics = createVoicebridgeDiagnosticControls();
  if (diagnostics) {
    callout.appendChild(diagnostics);
  }

  return callout;
};

const syncVoiceBridgeCallout = () => {
  if (window.location.pathname !== "/codeswitch") {
    removeCallout();
    return;
  }

  if (document.getElementById(CALLOUT_ID)) {
    return;
  }

  document.body.appendChild(createCallout());
};

const patchHistoryMethod = (methodName) => {
  const original = window.history[methodName];

  if (typeof original !== "function" || original.__voiceBridgePatched) {
    return;
  }

  const patched = function patchedHistoryMethod(...args) {
    const result = original.apply(this, args);
    queueMicrotask(syncVoiceBridgeCallout);
    return result;
  };

  patched.__voiceBridgePatched = true;
  window.history[methodName] = patched;
};

if (typeof window !== "undefined" && typeof document !== "undefined") {
  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");

  window.addEventListener("popstate", syncVoiceBridgeCallout);
  window.addEventListener("pageshow", syncVoiceBridgeCallout);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncVoiceBridgeCallout, {
      once: true,
    });
  } else {
    syncVoiceBridgeCallout();
  }
}
