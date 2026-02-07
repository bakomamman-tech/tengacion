const Post = require("../models/Post");
const asyncHandler = require("../middleware/asyncHandler");
const paginate = require("../utils/paginate");
const { createNotification } = require("../services/notificationService");

/* =====================================================
   📰 GET FEED (PUBLIC POSTS)
===================================================== */
exports.getFeed = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);

  const query = { privacy: "public" };

  const [posts, total] = await Promise.all([
    Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "name username avatar.url")
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

/* =====================================================
   ❤️ LIKE / UNLIKE POST
===================================================== */
exports.toggleLike = asyncHandler(async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user._id;

  const post = await Post.findById(postId);
  if (!post) {
    return res.status(404).json({
      success: false,
      message: "Post not found",
    });
  }

  const liked = post.likes.some(
    (id) => id.toString() === userId.toString()
  );

  if (liked) {
    post.likes.pull(userId);
  } else {
    post.likes.addToSet(userId);

    /* 🔔 SEND NOTIFICATION (ONLY ON LIKE) */
    await createNotification({
      recipient: post.author,
      sender: userId,
      type: "like",
      text: "liked your post",
      entity: {
        id: post._id,
        model: "Post",
      },
      io: req.app.get("io"),
      onlineUsers: req.app.get("onlineUsers"),
    });
  }

  await post.save();

  res.json({
    success: true,
    liked: !liked,
    likesCount: post.likes.length,
  });
});
