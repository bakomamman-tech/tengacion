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

export const getTengaAgentOwnerBilling = async () => {
  const token = getSessionAccessToken();
  if (!token) {
    const error = new Error(
      "Please sign in to view your TengaAgent billing status."
    );
    error.status = 401;
    throw error;
  }

  const response = await fetch(
    `${API_BASE}/tengaagent/owner/billing`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const data = await parseJson(response);

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error ||
        "TengaAgent billing status could not be loaded."
    );
    error.status = response.status;
    throw error;
  }

  return data;
};
