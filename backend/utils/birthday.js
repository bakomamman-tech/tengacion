const VALID_VISIBILITIES = new Set(["private", "friends", "public"]);
const BIRTHDAY_TIME_ZONE = process.env.BIRTHDAY_TIME_ZONE || "Africa/Lagos";

const getDatePartsInTimeZone = (value = new Date(), timeZone = BIRTHDAY_TIME_ZONE) => {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
};

const birthdayFromDob = (dob, visibility = "friends") => {
  const date = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
    visibility: VALID_VISIBILITIES.has(String(visibility)) ? String(visibility) : "friends",
  };
};

const hasBirthdayDate = (birthday = {}) =>
  Number(birthday?.day) > 0 && Number(birthday?.month) > 0;

module.exports = {
  BIRTHDAY_TIME_ZONE,
  birthdayFromDob,
  getDatePartsInTimeZone,
  hasBirthdayDate,
  VALID_VISIBILITIES,
};
