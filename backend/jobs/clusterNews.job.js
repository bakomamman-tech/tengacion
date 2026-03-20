const { rebuildClusters } = require("../services/newsClusterService");

const runClusterNewsJob = async ({ storyIds = [], since = null, limit = 300 } = {}) =>
  rebuildClusters({ storyIds, since, limit });

module.exports = {
  runClusterNewsJob,
};
