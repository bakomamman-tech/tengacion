import { API_BASE, apiRequest } from "../../api";

export const getMyGroups = () => apiRequest(`${API_BASE}/groups?scope=mine`);

export const createGroup = (draft = {}) =>
  apiRequest(`${API_BASE}/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: draft.name,
      description: draft.description,
      privacy: draft.privacy,
      coverImage: draft.coverImage,
    }),
  });

export const createGroupPost = (groupId, text) =>
  apiRequest(`${API_BASE}/groups/${encodeURIComponent(groupId)}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
