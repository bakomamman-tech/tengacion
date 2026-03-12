import countryList from "country-list";

const { getCodes, getName } = countryList;

const regionNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export const COUNTRY_OPTIONS = getCodes()
  .map((code) => {
    const label = regionNames?.of(code) || getName(code) || "";
    return typeof label === "string" ? label.trim() : "";
  })
  .filter(Boolean)
  .sort((left, right) => left.localeCompare(right))
  .filter((label, index, list) => label !== list[index - 1]);
