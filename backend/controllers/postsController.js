const Post = require("../models/Post");
const asyncHandler = require("../middleware/asyncHandler");
const paginate = require("../utils/paginate");

exports.getFeed = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);

  const query = { privacy: "public" };

  const [posts, total] = await Promise.all([
    Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name username avatar")
      .lean(),
    Post.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: posts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});
