const {
  trimTextValue,
  sanitizePhoneValue,
  sanitizeCountryValue,
} = require("../utils/profileFields");

describe("profile field sanitizers", () => {
  test("trims plain profile text", () => {
    expect(trimTextValue("  Lagos  ")).toBe("Lagos");
    expect(trimTextValue(null)).toBe("");
  });

  test("clears legacy placeholder phone values", () => {
    expect(sanitizePhoneValue("tmp_phone_171597179488_y5kzo")).toBe("");
    expect(sanitizePhoneValue(" +2348000000000 ")).toBe("+2348000000000");
  });

  test("clears legacy placeholder country values", () => {
    expect(sanitizeCountryValue("tmp_country_171597179488_y5kzo")).toBe("");
    expect(sanitizeCountryValue(" Nigeria ")).toBe("Nigeria");
  });
});
