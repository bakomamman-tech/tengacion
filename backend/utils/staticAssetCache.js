const path = require("path");

const ONE_DAY_SECONDS = 24 * 60 * 60;
const ONE_WEEK_SECONDS = 7 * ONE_DAY_SECONDS;
const ONE_YEAR_SECONDS = 365 * ONE_DAY_SECONDS;

const normalizeRelativePath = (frontendPath, filePath) =>
  path.relative(frontendPath, filePath).split(path.sep).join("/");

const isHashedBuildAsset = (relativePath) =>
  /^assets\/.+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/i.test(relativePath);

const isVersionedCampaignAsset = (relativePath) =>
  /^assets\/campaigns\/.+-\d{4}(?:-[A-Za-z0-9]+)+\.[A-Za-z0-9]+$/i.test(relativePath);

const isStaticMediaAsset = (relativePath) =>
  /\.(?:avif|css|gif|ico|jpe?g|js|mjs|png|svg|webp|woff2?|ttf|otf)$/i.test(relativePath);

const getStaticCacheControl = (relativePath) => {
  if (relativePath === "sw.js" || relativePath === "manifest.json") {
    return "no-cache";
  }

  if (isHashedBuildAsset(relativePath) || isVersionedCampaignAsset(relativePath)) {
    return `public, max-age=${ONE_YEAR_SECONDS}, immutable`;
  }

  if (isStaticMediaAsset(relativePath)) {
    return `public, max-age=${ONE_DAY_SECONDS}, stale-while-revalidate=${ONE_WEEK_SECONDS}`;
  }

  return "no-cache";
};

const setStaticCacheHeaders = (response, filePath, frontendPath) => {
  const relativePath = normalizeRelativePath(frontendPath, filePath);
  response.setHeader("Cache-Control", getStaticCacheControl(relativePath));
};

module.exports = {
  getStaticCacheControl,
  isHashedBuildAsset,
  isVersionedCampaignAsset,
  normalizeRelativePath,
  setStaticCacheHeaders,
};
