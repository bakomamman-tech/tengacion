const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

export const formatCountry = (code) => {
  if (!code) {
    return "Country not listed";
  }
  try {
    return REGION_NAMES.of(String(code).trim().toUpperCase()) || code;
  } catch {
    return code;
  }
};

export const formatNumber = (value) =>
  new Intl.NumberFormat("en").format(Number(value) || 0);
