const { runClusterNewsJob } = require("../jobs/clusterNews.job");
const { runIngestNewsJob } = require("../jobs/ingestNews.job");
const { runScoreNewsJob } = require("../jobs/scoreNews.job");
const { syncNewsCatalog } = require("./newsCatalogService");

let schedulerStarted = false;
let schedulerHandle = null;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
};

const runNewsRefreshCycle = async ({ logger = console } = {}) => {
  await syncNewsCatalog();

  const ingestResult = await runIngestNewsJob({
    limitPerSource: parsePositiveInteger(process.env.NEWS_INGEST_LIMIT_PER_SOURCE, 12),
  });
  const clusterResult = await runClusterNewsJob({
    limit: parsePositiveInteger(process.env.NEWS_CLUSTER_LIMIT, 240),
  });
  const scoreResult = await runScoreNewsJob({
    limit: parsePositiveInteger(process.env.NEWS_SCORE_LIMIT, 240),
  });

  logger.log("News refresh cycle completed", {
    ingested: ingestResult?.ingestedCount || 0,
    sourceCount: ingestResult?.sourceCount || 0,
    clusterCount: clusterResult?.clusterCount || 0,
    storyCount: scoreResult?.storyCount || 0,
  });
};

const startNewsSchedulers = async ({ logger = console } = {}) => {
  if (schedulerStarted) {
    return schedulerHandle;
  }

  await syncNewsCatalog();
  schedulerStarted = true;

  const enabled = String(process.env.NEWS_AUTO_REFRESH_ENABLED || "false").toLowerCase() === "true";
  if (!enabled) {
    logger.log("News auto refresh disabled. Catalog sync completed.");
    return null;
  }

  const intervalMs = parsePositiveInteger(
    process.env.NEWS_REFRESH_INTERVAL_MS,
    15 * 60 * 1000
  );
  const runOnBoot =
    String(process.env.NEWS_RUN_REFRESH_ON_BOOT || "true").toLowerCase() !== "false";

  const scheduleTick = () =>
    runNewsRefreshCycle({ logger }).catch((error) => {
      logger.error("News refresh cycle failed:", error?.message || error);
    });

  if (runOnBoot) {
    await scheduleTick();
  }

  schedulerHandle = setInterval(scheduleTick, intervalMs);
  schedulerHandle.unref?.();
  logger.log(`News auto refresh scheduled every ${intervalMs}ms.`);
  return schedulerHandle;
};

module.exports = {
  runNewsRefreshCycle,
  startNewsSchedulers,
};
