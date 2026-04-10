export const normalizeProfileUsername = (value = "") =>
  String(value || "").trim().replace(/^@+/, "").replace(/\s+/g, "");

export const getProfilePath = (username = "") => {
  const normalized = normalizeProfileUsername(username);
  return normalized ? `/profile/${encodeURIComponent(normalized)}` : "";
};
