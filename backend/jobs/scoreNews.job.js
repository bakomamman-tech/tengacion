const NewsCluster = require("../models/NewsCluster");
const NewsStory = require("../models/NewsStory");
const { scoreCluster, scoreStory } = require("../services/newsRankingService");

const runScoreNewsJob = async ({ limit = 400 } = {}) => {
  const stories = await NewsStory.find({})
    .sort({ publishedAt: -1 })
    .limit(Math.max(1, Number(limit) || 400))
    .populate("sourceId");

  for (const story of stories) {
    story.scoring = scoreStory(story.toObject ? story.toObject() : story, {
      source: story.sourceId || null,
    });
    await story.save();
  }

  const clusters = await NewsCluster.find({})
    .sort({ lastPublishedAt: -1 })
    .limit(Math.max(1, Number(limit) || 400))
    .populate({
      path: "representativeStoryId",
      populate: { path: "sourceId" },
    });

  for (const cluster of clusters) {
    const representativeStory = cluster.representativeStoryId || null;
    cluster.scoring = scoreCluster(
      cluster.toObject ? cluster.toObject() : cluster,
      representativeStory ? [representativeStory] : [],
      {
        source: representativeStory?.sourceId || null,
      }
    );
    cluster.importanceScore = Number(
      cluster.scoring?.importanceScore || cluster.importanceScore || 0
    );
    cluster.freshnessScore = Number(
      cluster.scoring?.freshnessScore || cluster.freshnessScore || 0
    );
    cluster.coverageDiversityScore = Number(
      cluster.scoring?.coverageDiversityScore || cluster.coverageDiversityScore || 0
    );
    await cluster.save();
  }

  return {
    storyCount: stories.length,
    clusterCount: clusters.length,
  };
};

module.exports = {
  runScoreNewsJob,
};
