const NewsCluster = require("../models/NewsCluster");
const NewsStory = require("../models/NewsStory");

const runExpireNewsRightsJob = async ({ now = new Date() } = {}) => {
  const filter = {
    "rights.expiresAt": { $ne: null, $lte: now },
    "rights.isExpired": { $ne: true },
  };

  const [storiesResult, clustersResult] = await Promise.all([
    NewsStory.updateMany(filter, {
      $set: {
        "rights.isExpired": true,
        "rights.allowBodyHtml": false,
      },
    }),
    NewsCluster.updateMany(filter, {
      $set: {
        "rights.isExpired": true,
        "rights.allowBodyHtml": false,
      },
    }),
  ]);

  return {
    storiesUpdated: Number(storiesResult?.modifiedCount || 0),
    clustersUpdated: Number(clustersResult?.modifiedCount || 0),
  };
};

module.exports = {
  runExpireNewsRightsJob,
};
