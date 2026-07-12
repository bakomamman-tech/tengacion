const VALID_VISIBILITIES = new Set(["private", "friends", "public"]);

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

module.exports = { birthdayFromDob, hasBirthdayDate, VALID_VISIBILITIES };
