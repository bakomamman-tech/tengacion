import API_BASE from "./config/apiBase";
import { getSessionAccessToken } from "./authSession";

const STATUS_RETRY_DELAYS_MS = [800, 1800];

const requestDiagnostic = async (path, options = {}) => {
  const token = getSessionAccessToken();
  if (!token) {
    const error = new Error("Admin session is still loading. Please try again in a moment.");
    error.status = 401;
    error.sessionPending = true;
    throw error;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || payload?.message || "Diagnostic request failed.");
    error.status = response.status;
    throw error;
  }
  return payload;
};

const formatTimestamp = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

export const createVoicebridgeDiagnosticControls = () => {
  const details = document.createElement("details");
  details.className = "vb-at-diagnostics";

  const summary = document.createElement("summary");
  summary.textContent = "Admin transcript verification";

  const help = document.createElement("p");
  help.className = "vb-at-diagnostics__help";
  help.textContent =
    "Capture is off by default. Admin authentication is required. Enable it for 30 minutes before a demo call. Each Sahara transcript is automatically deleted after 30 minutes.";

  const actions = document.createElement("div");
  actions.className = "vb-at-diagnostics__actions";

  const enableButton = document.createElement("button");
  enableButton.type = "button";
  enableButton.textContent = "Enable 30 min";

  const latestButton = document.createElement("button");
  latestButton.type = "button";
  latestButton.textContent = "Show latest";

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.textContent = "Delete now";

  const status = document.createElement("p");
  status.className = "vb-at-diagnostics__status";
  status.textContent = "Checking admin diagnostic status…";

  const transcript = document.createElement("pre");
  transcript.className = "vb-at-diagnostics__transcript";
  transcript.hidden = true;

  const setStatus = (text, isError = false) => {
    status.textContent = text;
    status.dataset.error = isError ? "true" : "false";
  };

  const renderCaptureStatus = (diagnostics) => {
    if (diagnostics?.active) {
      setStatus(`Capture ON until ${formatTimestamp(diagnostics.enabledUntil)}.`);
    } else {
      setStatus("Capture OFF. No new call transcripts will be retained.");
    }
  };

  const loadStatus = async (retryIndex = 0) => {
    try {
      const payload = await requestDiagnostic(
        "/codeswitch/africastalking/voice/diagnostics/status"
      );
      renderCaptureStatus(payload.diagnostics);
    } catch (error) {
      if (error?.sessionPending && retryIndex < STATUS_RETRY_DELAYS_MS.length) {
        setStatus("Restoring admin session…");
        window.setTimeout(
          () => loadStatus(retryIndex + 1),
          STATUS_RETRY_DELAYS_MS[retryIndex]
        );
        return;
      }

      if (error?.status === 401) {
        setStatus("Admin sign-in is required to use transcript verification.", true);
        return;
      }

      if (error?.status === 403) {
        setStatus("This account does not have admin permission for transcript verification.", true);
        return;
      }

      setStatus(error.message, true);
    }
  };

  enableButton.addEventListener("click", async () => {
    enableButton.disabled = true;
    try {
      const payload = await requestDiagnostic(
        "/codeswitch/africastalking/voice/diagnostics/enable",
        {
          method: "POST",
          body: JSON.stringify({ minutes: 30 }),
        }
      );
      renderCaptureStatus(payload.diagnostics);
    } catch (error) {
      if (error?.status === 403) {
        setStatus("This account does not have admin permission for transcript verification.", true);
      } else {
        setStatus(error.message, true);
      }
    } finally {
      enableButton.disabled = false;
    }
  });

  latestButton.addEventListener("click", async () => {
    latestButton.disabled = true;
    try {
      const payload = await requestDiagnostic(
        "/codeswitch/africastalking/voice/diagnostics/latest"
      );
      renderCaptureStatus(payload.diagnostics);
      if (!payload.available || !payload.diagnostic) {
        transcript.hidden = true;
        setStatus("No unexpired transcript has been captured yet.");
        return;
      }

      const item = payload.diagnostic;
      transcript.textContent = [
        `Sahara heard: ${item.transcript}`,
        `Language pair: ${item.languagePair}`,
        `Audio duration: ${item.processedAudioDurationSeconds ?? "—"} s`,
        `Intent: ${item.intent || "Pending / not classified"}`,
        `Action: ${item.executedAction || "Pending / not executed"}`,
        `Case: ${item.caseId || "—"}`,
        `Captured: ${formatTimestamp(item.createdAt)}`,
        `Deletes: ${formatTimestamp(item.expiresAt)}`,
        "Money movement performed: No",
      ].join("\n");
      transcript.hidden = false;
    } catch (error) {
      transcript.hidden = true;
      if (error?.status === 403) {
        setStatus("This account does not have admin permission for transcript verification.", true);
      } else {
        setStatus(error.message, true);
      }
    } finally {
      latestButton.disabled = false;
    }
  });

  clearButton.addEventListener("click", async () => {
    clearButton.disabled = true;
    try {
      const payload = await requestDiagnostic(
        "/codeswitch/africastalking/voice/diagnostics",
        { method: "DELETE" }
      );
      transcript.hidden = true;
      setStatus(`Temporary diagnostics deleted (${payload.deletedCount || 0}). Capture is OFF.`);
    } catch (error) {
      if (error?.status === 403) {
        setStatus("This account does not have admin permission for transcript verification.", true);
      } else {
        setStatus(error.message, true);
      }
    } finally {
      clearButton.disabled = false;
    }
  });

  loadStatus();

  actions.append(enableButton, latestButton, clearButton);
  details.append(summary, help, actions, status, transcript);
  return details;
};
