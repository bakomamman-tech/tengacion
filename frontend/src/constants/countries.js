import countryList from "country-list";
import { allCountries } from "country-region-data";

const { getCodes, getName } = countryList;

const regionNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const getCountryLabel = (code) => {
  const label = regionNames?.of(code) || getName(code) || "";
  return typeof label === "string" ? label.trim() : "";
};

const COUNTRY_ENTRIES = getCodes()
  .map((code) => ({
    code,
    label: getCountryLabel(code),
    fallbackName: (getName(code) || "").trim(),
  }))
  .filter(({ label }) => Boolean(label))
  .sort((left, right) => left.label.localeCompare(right.label))
  .filter((entry, index, list) => entry.label !== list[index - 1]?.label);

const COUNTRY_CODE_BY_NAME = new Map();

COUNTRY_ENTRIES.forEach(({ code, label, fallbackName }) => {
  COUNTRY_CODE_BY_NAME.set(label, code);
  if (fallbackName && !COUNTRY_CODE_BY_NAME.has(fallbackName)) {
    COUNTRY_CODE_BY_NAME.set(fallbackName, code);
  }
});

const REGIONS_BY_COUNTRY_CODE = new Map(
  allCountries.map((entry) => {
    const code = String(entry?.[1] || "").trim().toUpperCase();
    const regions = Array.isArray(entry?.[2]) ? entry[2] : [];
    const regionOptions = regions
      .map((region) => {
        const name = Array.isArray(region) ? region[0] : region?.name;
        return typeof name === "string" ? name.trim() : "";
      })
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .filter((name, index, list) => name !== list[index - 1]);

    const countryName = typeof entry?.[0] === "string" ? entry[0].trim() : "";
    if (countryName && code && !COUNTRY_CODE_BY_NAME.has(countryName)) {
      COUNTRY_CODE_BY_NAME.set(countryName, code);
    }

    return [code, regionOptions];
  })
);

export const COUNTRY_OPTIONS = COUNTRY_ENTRIES.map(({ label }) => label);

export const getCountryCodeByName = (countryName = "") =>
  COUNTRY_CODE_BY_NAME.get(String(countryName || "").trim()) || "";

export const getRegionsForCountry = (countryName = "") => {
  const code = getCountryCodeByName(countryName);
  if (!code) {
    return [];
  }
  return REGIONS_BY_COUNTRY_CODE.get(code) || [];
};
