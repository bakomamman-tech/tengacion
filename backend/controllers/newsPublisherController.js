const asyncHandler = require("../middleware/asyncHandler");
const {
  buildNewsFeed,
  getSourceProfile,
} = require("../services/newsFeedAssemblerService");

const getSourcePage = asyncHandler(async (req, res) => {
  const source = await getSourceProfile(req.params.slug);
  if (!source) {
    return res.status(404).json({ error: "Source not found" });
  }

  const feed = await buildNewsFeed({
    userId: req.user?.id || "",
    tab: String(req.query.tab || "for-you").trim().toLowerCase(),
    cursor: String(req.query.cursor || ""),
    limit: Number(req.query.limit || 20),
    sourceSlug: req.params.slug,
  });

  return res.json({
    source,
    ...feed,
  });
});

module.exports = {
  getSourcePage,
};
