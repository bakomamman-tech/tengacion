const trimTextValue = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const clearPlaceholderValue = (value, prefix) => {
  const nextValue = trimTextValue(value);
  if (!nextValue) {
    return "";
  }
  return nextValue.startsWith(prefix) ? "" : nextValue;
};

const sanitizePhoneValue = (value) => clearPlaceholderValue(value, "tmp_phone_");

const sanitizeCountryValue = (value) => clearPlaceholderValue(value, "tmp_country_");

module.exports = {
  trimTextValue,
  sanitizePhoneValue,
  sanitizeCountryValue,
};
