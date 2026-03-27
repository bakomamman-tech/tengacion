import { apiRequest, API_BASE } from "../api";

export const fetchStorageOverview = () =>
  apiRequest(`${API_BASE}/admin/storage/overview`, {
    method: "GET",
  });

export const previewStorageCleanup = (actions = []) =>
  apiRequest(`${API_BASE}/admin/storage/cleanup/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actions }),
  });

export const runStorageCleanup = (actions = []) =>
  apiRequest(`${API_BASE}/admin/storage/cleanup/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actions }),
  });
