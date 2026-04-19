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

export const initializeMarketplacePayment = (payload = {}) =>
  apiRequest(`${API_BASE}/marketplace/orders/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

export const verifyMarketplacePayment = (reference) =>
  apiRequest(`${API_BASE}/marketplace/orders/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference }),
  });

export const fetchBuyerMarketplaceOrders = (params = {}) =>
  apiRequest(withQuery(`${API_BASE}/marketplace/orders/buyer`, params));

export const fetchSellerMarketplaceOrders = (params = {}) =>
  apiRequest(withQuery(`${API_BASE}/marketplace/orders/seller`, params));

export const updateMarketplaceOrderStatus = (orderId, payload = {}) =>
  apiRequest(`${API_BASE}/marketplace/orders/${encodeURIComponent(orderId || "")}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
