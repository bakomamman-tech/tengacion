import { API_BASE, apiRequest } from "../../api";

export const getMyGroups = () => apiRequest(`${API_BASE}/groups?scope=mine`);

export const createGroup = (draft = {}) => {
  const form = new FormData();
  form.append("name", draft.name || "");
  form.append("description", draft.description || "");
  form.append("privacy", draft.privacy || "public");
  if (draft.coverImage) {
    form.append("coverImage", draft.coverImage);
  }
  return apiRequest(`${API_BASE}/groups`, {
    method: "POST",
    body: form,
    timeoutMs: 60000,
  });
};

export const createGroupPost = (groupId, text) =>
  apiRequest(`${API_BASE}/groups/${encodeURIComponent(groupId)}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
