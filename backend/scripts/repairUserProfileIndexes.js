const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

const isLegacyUniqueProfileIndex = (index) => {
  if (!index?.unique || !index?.key || typeof index.key !== "object") {
    return false;
  }

  const keys = Object.keys(index.key);
  if (keys.length !== 1) {
    return false;
  }

  return keys[0] === "country" || keys[0] === "phone";
};

async function repairUserProfileIndexes({ dryRun = false, logger = console } = {}) {
  const indexes = await User.collection.indexes();
  const dropTargets = indexes.filter(isLegacyUniqueProfileIndex);

  for (const index of dropTargets) {
    if (dryRun) {
      logger.info(`[repairUserProfileIndexes] would drop ${index.name}`);
      continue;
    }
    await User.collection.dropIndex(index.name);
    logger.info(`[repairUserProfileIndexes] dropped ${index.name}`);
  }

  return {
    scanned: indexes.length,
    dropped: dropTargets.map((index) => index.name),
    dryRun: Boolean(dryRun),
  };
}

if (require.main === module) {
  const dryRun = String(process.env.DRY_RUN || "").toLowerCase() === "true";

  (async () => {
    await connectDB();
    try {
      await repairUserProfileIndexes({ dryRun, logger: console });
    } finally {
      await mongoose.disconnect();
    }
  })().catch((err) => {
    console.error("[repairUserProfileIndexes] failed", err);
    process.exit(1);
  });
}

module.exports = {
  repairUserProfileIndexes,
};
