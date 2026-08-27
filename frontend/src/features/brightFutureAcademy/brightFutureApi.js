import { apiRequest } from "../../api";
import { getSessionAccessToken } from "../../authSession";
import { API_BASE } from "../../config/apiBase";

const TOKEN_KEY = "brightFutureCandidateToken";

export const getCandidateToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

export const setCandidateToken = (token = "") => {
  try {
    if (token) {sessionStorage.setItem(TOKEN_KEY, token);}
    else {sessionStorage.removeItem(TOKEN_KEY);}
  } catch {
    // Session storage is only a convenience; the server remains authoritative.
  }
};

const parse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.message || "Request failed. Please try again.");
    error.status = response.status;
    error.code = data.code || "request_failed";
    error.details = data.details || null;
    error.payload = data;
    if (response.status === 401 && error.code?.startsWith("candidate_")) {setCandidateToken("");}
    throw error;
  }
  return data;
};

const candidateRequest = async (path, { method = "GET", body, auth = false } = {}) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("You appear to be offline. Reconnect and try again; your server attempt is safe.");
  }
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getCandidateToken();
    if (!token) {
      const error = new Error("Sign in with your Candidate ID to continue.");
      error.code = "candidate_session_required";
      throw error;
    }
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}/bright-future-academy${path}`, {
    method,
    credentials: "include",
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await parse(response);
  if (data.candidateToken) {setCandidateToken(data.candidateToken);}
  return data;
};

export const getBrightFutureSettings = () => candidateRequest("/settings");
export const registerBrightFutureCandidate = (body) => candidateRequest("/register", { method: "POST", body });
export const loginBrightFutureCandidate = (body) => candidateRequest("/login", { method: "POST", body });
export const getBrightFutureProfile = () => candidateRequest("/profile", { auth: true });
export const updateBrightFutureProfile = (body) => candidateRequest("/profile", { method: "PATCH", body, auth: true });
export const startBrightFutureExam = () => candidateRequest("/exam/start", { method: "POST", body: {}, auth: true });
export const getBrightFutureExam = () => candidateRequest("/exam/question", { auth: true });
export const answerBrightFutureExam = (body) => candidateRequest("/exam/answer", { method: "POST", body, auth: true });
export const recordBrightFutureViolation = (body) => candidateRequest("/exam/violation", { method: "POST", body, auth: true });
export const submitBrightFutureExam = (body = {}) => candidateRequest("/exam/submit", { method: "POST", body, auth: true });
export const getBrightFutureResult = () => candidateRequest("/result", { auth: true });
export const getBrightFutureLeaderboard = (params = {}) => candidateRequest(`/leaderboard?${new URLSearchParams(params)}`);
export const getBrightFutureParticipants = (params = {}) => candidateRequest(`/participants?${new URLSearchParams(params)}`);

const adminOptions = (method = "GET", body) => ({
  method,
  headers: { "Content-Type": "application/json", ...(getSessionAccessToken() ? { Authorization: `Bearer ${getSessionAccessToken()}` } : {}) },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

export const adminGetBrightFutureOverview = () => apiRequest(`${API_BASE}/admin/bright-future-academy/overview`, adminOptions());
export const adminGetBrightFutureStudents = (params = {}) => apiRequest(`${API_BASE}/admin/bright-future-academy/students?${new URLSearchParams(params)}`, adminOptions());
export const adminGetBrightFutureResults = (params = {}) => apiRequest(`${API_BASE}/admin/bright-future-academy/results?${new URLSearchParams(params)}`, adminOptions());
export const adminGetBrightFutureLeaderboard = () => apiRequest(`${API_BASE}/admin/bright-future-academy/leaderboard`, adminOptions());
export const adminGetBrightFutureControls = () => apiRequest(`${API_BASE}/admin/bright-future-academy/controls`, adminOptions());
export const adminUpdateBrightFutureControls = (body) => apiRequest(`${API_BASE}/admin/bright-future-academy/controls`, adminOptions("PATCH", body));
export const adminGetBrightFutureQuestions = () => apiRequest(`${API_BASE}/admin/bright-future-academy/questions`, adminOptions());
export const adminUpdateBrightFutureQuestion = (questionId, body) => apiRequest(`${API_BASE}/admin/bright-future-academy/questions/${encodeURIComponent(questionId)}`, adminOptions("PATCH", body));
export const adminUpdateBrightFutureStudent = (id, body) => apiRequest(`${API_BASE}/admin/bright-future-academy/students/${encodeURIComponent(id)}`, adminOptions("PATCH", body));
export const adminResetBrightFutureAttempt = (id, body = {}) => apiRequest(`${API_BASE}/admin/bright-future-academy/students/${encodeURIComponent(id)}/reset-attempt`, adminOptions("POST", body));
export const adminResetBrightFuturePassword = (id, body = {}) => apiRequest(`${API_BASE}/admin/bright-future-academy/students/${encodeURIComponent(id)}/reset-password`, adminOptions("POST", body));
