import { API_BASE, apiRequest } from "../api";

export const fetchTeacherTrainingStatus = () =>
  apiRequest(`${API_BASE}/teacher-training/status`);

export const fetchTeacherTrainingAdminTracker = ({
  search = "",
  status = "all",
} = {}) => {
  const params = new URLSearchParams();
  if (String(search || "").trim()) {
    params.set("search", String(search).trim());
  }
  if (status && status !== "all") {
    params.set("status", status);
  }
  const query = params.toString();
  return apiRequest(
    `${API_BASE}/teacher-training/admin/tracker${query ? `?${query}` : ""}`
  );
};

export const startTeacherTrainingModule = (moduleCode) =>
  apiRequest(
    `${API_BASE}/teacher-training/modules/${encodeURIComponent(moduleCode || "")}/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );

export const answerTeacherTrainingQuestion = ({
  moduleCode,
  questionId,
  selectedIndex,
} = {}) =>
  apiRequest(
    `${API_BASE}/teacher-training/modules/${encodeURIComponent(moduleCode || "")}/answer`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        selectedIndex: Number.isInteger(selectedIndex) ? selectedIndex : null,
      }),
    }
  );
