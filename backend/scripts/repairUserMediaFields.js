const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const { normalizeMediaValue } = require("../utils/userMedia");

const sameMedia = (left, right) =>
  String(left?.url || "") === String(right?.url || "") &&
  String(left?.public_id || "") === String(right?.public_id || "");

const needsRepair = (value) => {
  if (!value) return true;
  if (typeof value === "string") return true;
  if (typeof value !== "object" || Array.isArray(value)) return true;
  return typeof value.url !== "string" || typeof value.public_id !== "string";
};

const repairUserMediaFields = async ({ dryRun = false, logger = console } = {}) => {
  const cursor = User.find({}, { _id: 1, avatar: 1, cover: 1 }).cursor();
  let scanned = 0;
  let repaired = 0;

  for await (const user of cursor) {
    scanned += 1;
    const nextAvatar = normalizeMediaValue(user.avatar);
    const nextCover = normalizeMediaValue(user.cover);
    const avatarChanged = needsRepair(user.avatar) || !sameMedia(user.avatar, nextAvatar);
    const coverChanged = needsRepair(user.cover) || !sameMedia(user.cover, nextCover);

    if (!avatarChanged && !coverChanged) {
      continue;
    }

    repaired += 1;
    if (!dryRun) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            avatar: nextAvatar,
            cover: nextCover,
          },
        }
      );
    }
  }

  logger.info("[repairUserMediaFields] complete", {
    scanned,
    repaired,
    dryRun: Boolean(dryRun),
  });

  return { scanned, repaired, dryRun: Boolean(dryRun) };
};

if (require.main === module) {
  const dryRun = String(process.env.DRY_RUN || "").toLowerCase() === "true";

  (async () => {
    await connectDB();
    try {
      await repairUserMediaFields({ dryRun, logger: console });
    } finally {
      await mongoose.disconnect();
    }
  })().catch((err) => {
    console.error("[repairUserMediaFields] failed", err);
    process.exit(1);
  });
}

module.exports = {
  repairUserMediaFields,
};
