import API_BASE from "../config/apiBase";

const readPayload = async (response) => response.json().catch(() => ({}));

const throwApiError = (response, payload, fallbackMessage) => {
  const errorPayload = payload?.error;
  const message =
    (typeof errorPayload === "object" ? errorPayload?.message : errorPayload) ||
    payload?.message ||
    fallbackMessage;
  const error = new Error(message);
  error.status = response.status;
  error.code = typeof errorPayload === "object" ? errorPayload?.code || "" : "";
  error.retryAfterSeconds = payload?.retryAfterSeconds ?? null;
  throw error;
};

export async function transcribeWithSahara({ audio, languagePair, signal } = {}) {
  const form = new FormData();
  form.append("audio", audio);
  form.append("languagePair", languagePair);

  const response = await fetch(`${API_BASE}/codeswitch/transcribe`, {
    method: "POST",
    credentials: "include",
    body: form,
    signal,
  });
  const payload = await readPayload(response);
  if (!response.ok) {
    throwApiError(response, payload, "Sahara transcription failed.");
  }
  return payload;
}

export async function calculateCodeswitchWer({ reference, hypothesis, signal } = {}) {
  const response = await fetch(`${API_BASE}/codeswitch/wer`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, hypothesis }),
    signal,
  });
  const payload = await readPayload(response);
  if (!response.ok) {
    throwApiError(response, payload, "Normalized WER could not be calculated.");
  }
  return payload;
}
