import { API_BASE } from "../../config/apiBase";

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload?.message || "We could not complete that request. Please try again."
    );
    error.code = payload?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return payload;
};

const request = async (path, options = {}) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 30000);
  try {
    const response = await fetch(`${API_BASE}/gsi${path}`, {
      ...options,
      timeoutMs: undefined,
      signal: controller.signal,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    return await parseResponse(response);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("The request took too long. Please check your connection and try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

export const searchGsiJournals = (query) =>
  request(`/journals/search?q=${encodeURIComponent(query)}`);

export const importGsiJournal = (sourceId) =>
  request(`/journals/${encodeURIComponent(sourceId)}/import`);

export const calculateGsiJournalScore = (sourceId, impactEvidence) =>
  request(`/journals/${encodeURIComponent(sourceId)}/score`, {
    method: "POST",
    body: JSON.stringify({ impactEvidence }),
  });

export const publishGsiJournal = (sourceId, editorialReview, impactEvidence) =>
  request(`/journals/${encodeURIComponent(sourceId)}/publish`, {
    method: "POST",
    timeoutMs: 60000,
    body: JSON.stringify({ confirmed: true, editorialReview, impactEvidence }),
  });

export const getGsiRecord = (recordId) =>
  request(`/records/${encodeURIComponent(recordId)}`, { timeoutMs: 20000 });

export const calculateGsiPaperScore = (paper, impactEvidence) =>
  request("/papers/score", {
    method: "POST",
    body: JSON.stringify({ paper, impactEvidence }),
  });

export const publishGsiPaper = (paper, impactEvidence) =>
  request("/papers/publish", {
    method: "POST",
    body: JSON.stringify({ confirmed: true, paper, impactEvidence }),
  });

export const getGsiPaperRecord = (recordId) =>
  request(`/papers/${encodeURIComponent(recordId)}`, { timeoutMs: 20000 });

export const listGsiResearch = (filters = {}) => {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      query.set(key, value);
    }
  });
  return request(`/registry?${query.toString()}`, { timeoutMs: 20000 });
};
