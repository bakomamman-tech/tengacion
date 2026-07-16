const mongoose = require("mongoose");

const connectDB = require("../config/db");
const TopUpPromoPlay = require("../models/TopUpPromoPlay");

const WINNER_INDEX_NAME = "campaignKey_1_userId_1_winner";

const isLegacyOneDiscoveryPerUserIndex = (index = {}) => {
  if (
    !index.unique
    || index.partialFilterExpression
    || !index.key
    || typeof index.key !== "object"
  ) {
    return false;
  }

  const keys = Object.keys(index.key);
  return keys.length === 2
    && index.key.campaignKey === 1
    && index.key.userId === 1;
};

const ensureCollection = async () => {
  try {
    await TopUpPromoPlay.createCollection();
  } catch (error) {
    if (!String(error?.message || "").includes("already exists")) {
      throw error;
    }
  }
};

async function repairTopUpPromoIndexes({ dryRun = false, logger = console } = {}) {
  await ensureCollection();
  const indexes = await TopUpPromoPlay.collection.indexes();
  const dropTargets = indexes.filter(isLegacyOneDiscoveryPerUserIndex);

  for (const index of dropTargets) {
    if (dryRun) {
      logger.info?.(`[repairTopUpPromoIndexes] would drop ${index.name}`);
      continue;
    }

    try {
      await TopUpPromoPlay.collection.dropIndex(index.name);
      logger.info?.(`[repairTopUpPromoIndexes] dropped ${index.name}`);
    } catch (error) {
      if (error?.codeName !== "IndexNotFound" && error?.code !== 27) {
        throw error;
      }
    }
  }

  if (!dryRun) {
    await TopUpPromoPlay.collection.createIndex(
      { campaignKey: 1, userId: 1 },
      {
        unique: true,
        partialFilterExpression: { outcome: "win" },
        name: WINNER_INDEX_NAME,
      }
    );
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
      await repairTopUpPromoIndexes({ dryRun, logger: console });
    } finally {
      await mongoose.disconnect();
    }
  })().catch((error) => {
    console.error("[repairTopUpPromoIndexes] failed", error);
    process.exit(1);
  });
}

module.exports = {
  WINNER_INDEX_NAME,
  isLegacyOneDiscoveryPerUserIndex,
  repairTopUpPromoIndexes,
};
