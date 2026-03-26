import { API_BASE, apiRequest } from "../api";

const MODERATION_BASE = `${API_BASE}/admin/moderation`;
const USERS_BASE = `${API_BASE}/admin/users`;

const jsonHeaders = {
  "Content-Type": "application/json",
};

const buildParams = (values = {}) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    params.set(key, String(value));
  });
  return params;
};

const postJson = (url, payload = {}) =>
  apiRequest(url, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload || {}),
  });

const userAction = (userId, action, reason = "") =>
  postJson(`${USERS_BASE}/${encodeURIComponent(userId || "")}/${action}`, { reason });

export const fetchModerationStats = () =>
  apiRequest(`${MODERATION_BASE}/stats`);

export const fetchModerationCases = ({
  page = 1,
  limit = 20,
  queue = "",
  status = "",
  workflowState = "",
  severity = "",
  search = "",
  critical = false,
} = {}) => {
  const params = buildParams({
    page,
    limit,
    queue,
    status,
    workflowState,
    severity,
    search,
    critical: critical ? "true" : "",
  });
  return apiRequest(`${MODERATION_BASE}/cases?${params.toString()}`);
};

export const fetchModerationCase = (caseId) =>
  apiRequest(`${MODERATION_BASE}/cases/${encodeURIComponent(caseId || "")}`);

export const fetchModerationUploader = (caseId) =>
  apiRequest(`${MODERATION_BASE}/cases/${encodeURIComponent(caseId || "")}/uploader`);

export const fetchModerationReviewUrl = (caseId, payload = {}) =>
  postJson(`${MODERATION_BASE}/cases/${encodeURIComponent(caseId || "")}/review-url`, payload);

const applyModerationAction = (caseId, action, payload = {}) =>
  postJson(`${MODERATION_BASE}/cases/${encodeURIComponent(caseId || "")}/actions`, {
    action,
    ...payload,
  });

export const applyModerationCaseAction = (caseId, action, payload = {}) =>
  applyModerationAction(caseId, action, payload);

export const approveModerationCase = (caseId, payload = {}) =>
  applyModerationAction(caseId, "approve", payload);

export const rejectModerationCase = (caseId, payload = {}) =>
  applyModerationAction(caseId, "reject", payload);

export const removeModeratedContent = (caseId, payload = {}) =>
  applyModerationAction(caseId, "delete_media", payload);

export const restoreModeratedContent = (caseId, payload = {}) =>
  applyModerationAction(caseId, "restore_content", payload);

export const holdModerationCase = (caseId, payload = {}) =>
  applyModerationAction(caseId, "hold_for_review", payload);

export const restrictModerationCase = (caseId, payload = {}) =>
  applyModerationAction(caseId, "restrict_with_warning", payload);

export const preserveModerationEvidence = (caseId, payload = {}) =>
  applyModerationAction(caseId, "preserve_evidence", payload);

export const escalateModerationCase = (caseId, payload = {}) =>
  applyModerationAction(caseId, "escalate_case", payload);

export const scanRecentMedia = (payload = {}) =>
  postJson(`${MODERATION_BASE}/scan/recent`, payload);

export const scanSearchMatches = (payload = {}) =>
  postJson(`${MODERATION_BASE}/scan/search`, payload);

export const fetchModerationAuditLogs = ({ page = 1, limit = 30, action = "", caseId = "" } = {}) => {
  const params = buildParams({ page, limit, action, caseId });
  return apiRequest(`${MODERATION_BASE}/audit-logs?${params.toString()}`);
};

export const fetchRepeatViolators = ({ page = 1, limit = 20, search = "" } = {}) => {
  const params = buildParams({ page, limit, search });
  return apiRequest(`${MODERATION_BASE}/repeat-violators?${params.toString()}`);
};

export const banUser = (userId, reason = "") => userAction(userId, "ban", reason);

export const suspendUser = (userId, reason = "") => userAction(userId, "suspend", reason);

export const unbanUser = (userId, reason = "") => userAction(userId, "unban", reason);

export const unsuspendUser = (userId, reason = "") => userAction(userId, "unsuspend", reason);

export const forceLogoutUser = (userId, reason = "") =>
  userAction(userId, "force-logout", reason);
