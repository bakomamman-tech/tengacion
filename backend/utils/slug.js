const mongoose = require("mongoose");

const slugifyValue = (value = "", fallback = "item") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || fallback;
};

const generateUniqueSlug = async (
  model,
  value = "",
  { ignoreId = null, fallback = "item", field = "slug" } = {}
) => {
  const base = slugifyValue(value, fallback);
  let slug = base;
  let counter = 2;

  while (true) {
    const query = { [field]: slug };
    if (ignoreId && mongoose.Types.ObjectId.isValid(ignoreId)) {
      query._id = { $ne: ignoreId };
    }

    // eslint-disable-next-line no-await-in-loop
    const existing = await model.exists(query);
    if (!existing) {
      return slug;
    }

    slug = `${base}-${counter}`;
    counter += 1;
  }
};

module.exports = {
  generateUniqueSlug,
  slugifyValue,
};
