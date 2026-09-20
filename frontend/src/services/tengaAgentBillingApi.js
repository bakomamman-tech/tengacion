import { getSessionAccessToken } from "../authSession";
import { API_BASE } from "../config/apiBase";

const parseJson = async (response) => {
  const raw = await response.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("TengaAgent billing returned an invalid response.");
  }
};

const requireBillingToken = () => {
  const token = getSessionAccessToken();
  if (!token) {
    const error = new Error(
      "Please sign in to manage your TengaAgent billing."
    );
    error.status = 401;
    throw error;
  }
  return token;
};

const requestBillingJson = async (path, options = {}) => {
  const token = requireBillingToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await parseJson(response);

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error ||
        "TengaAgent billing request could not be completed."
    );
    error.status = response.status;
    error.code = data?.code || "";
    throw error;
  }

  return data;
};

export const getTengaAgentBillingPlans = () =>
  requestBillingJson("/tengaagent/billing/plans");

export const getTengaAgentOwnerBilling = () =>
  requestBillingJson("/tengaagent/owner/billing");

export const startTengaAgentPlanCheckout = ({
  planCode,
  currency,
}) =>
  requestBillingJson("/tengaagent/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ planCode, currency }),
  });

export const verifyTengaAgentPlanCheckout = (reference) =>
  requestBillingJson("/tengaagent/billing/checkout/verify", {
    method: "POST",
    body: JSON.stringify({ reference }),
  });

export const redirectToTengaAgentCheckout = (checkoutUrl) => {
  const url = String(checkoutUrl || "").trim();
  if (!url) {
    throw new Error("TengaAgent checkout did not return a payment URL.");
  }

  window.location.assign(url);
};
