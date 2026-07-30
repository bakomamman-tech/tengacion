import { API_BASE, apiRequest } from "../api";

export const fetchTeacherTrainingStatus = () =>
  apiRequest(`${API_BASE}/teacher-training/status`);

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
