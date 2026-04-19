import { API_BASE, apiRequest } from "../api";

const withQuery = (path, params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    query.set(key, String(value));
  });
  return `${path}${query.toString() ? `?${query.toString()}` : ""}`;
};

export const fetchMarketplacePayoutHistory = (params = {}) =>
  apiRequest(withQuery(`${API_BASE}/marketplace/payouts/me`, params));

export const fetchMarketplacePayoutSummary = () =>
  apiRequest(`${API_BASE}/marketplace/payouts/summary`);
