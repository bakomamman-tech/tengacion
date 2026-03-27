const normalizePhoneNumber = (value = "") => String(value || "").trim();

const isValidPhoneNumber = (value = "") => {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) {
    return false;
  }

  if (!/^\+?[0-9\s().-]+$/.test(normalized)) {
    return false;
  }

  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
};

module.exports = {
  normalizePhoneNumber,
  isValidPhoneNumber,
};
