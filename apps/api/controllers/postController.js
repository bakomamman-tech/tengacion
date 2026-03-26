const PostService = require("../services/postService");
const catchAsync = require("../utils/catchAsync");

exports.createPost = catchAsync(async (req, res) => {
  const payload = await PostService.createPost({
    userId: req.user.id,
    body: req.body,
    files: req.files,
    io: req.app.get("io"),
    onlineUsers: req.app.get("onlineUsers"),
  });
  res.status(Number(payload?.httpStatus) || 201).json(payload);
});

exports.getFeed = catchAsync(async (req, res) => {
  const result = await PostService.getFeed({
    userId: req.user?.id,
    search: req.query.search,
  });
  res.json(result);
});

exports.getPostById = catchAsync(async (req, res) => {
  const payload = await PostService.getPostById({
    viewerId: req.user?.id,
    postId: req.params.id,
  });
  res.json(payload);
});

exports.getUserPosts = catchAsync(async (req, res) => {
  const result = await PostService.getUserPosts({
    viewerId: req.user.id,
    username: req.params.username,
  });
  res.json(result);
});

exports.updatePost = catchAsync(async (req, res) => {
  const payload = await PostService.updatePost({
    userId: req.user.id,
    postId: req.params.id,
    text: req.body.text,
  });
  res.json(payload);
});

exports.deletePost = catchAsync(async (req, res) => {
  const payload = await PostService.deletePost({
    userId: req.user.id,
    postId: req.params.id,
  });
  res.json(payload);
});

exports.toggleLike = catchAsync(async (req, res) => {
  const payload = await PostService.toggleLike({
    userId: req.user.id,
    postId: req.params.id,
    io: req.app.get("io"),
    onlineUsers: req.app.get("onlineUsers"),
  });
  res.json(payload);
});

exports.sharePost = catchAsync(async (req, res) => {
  const payload = await PostService.sharePost({
    postId: req.params.id,
  });
  res.json(payload);
});

exports.addComment = catchAsync(async (req, res) => {
  const payload = await PostService.commentOnPost({
    userId: req.user.id,
    postId: req.params.id,
    text: {
      text: req.body.text,
      parentCommentId: req.body.parentCommentId || null,
    },
    io: req.app.get("io"),
    onlineUsers: req.app.get("onlineUsers"),
  });
  res.status(201).json(payload);
});

exports.votePoll = catchAsync(async (req, res) => {
  const payload = await PostService.votePoll({
    userId: req.user.id,
    postId: req.params.id,
    optionId: req.body.optionId,
  });
  res.json(payload);
});

exports.answerQuiz = catchAsync(async (req, res) => {
  const payload = await PostService.answerQuiz({
    userId: req.user.id,
    postId: req.params.id,
    optionId: req.body.optionId,
  });
  res.json(payload);
});

exports.getComments = catchAsync(async (req, res) => {
  const payload = await PostService.getPostById({
    viewerId: req.user?.id,
    postId: req.params.id,
  });
  const comments = Array.isArray(payload?.comments) ? payload.comments : [];
  if (String(req.query.threaded || "").toLowerCase() !== "true") {
    res.json(comments);
    return;
  }

  const byParent = new Map();
  comments.forEach((comment) => {
    const parentId = comment?.parentCommentId ? String(comment.parentCommentId) : "root";
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push({ ...comment, replies: [] });
  });

  const roots = byParent.get("root") || [];
  const attachReplies = (node) => {
    const children = byParent.get(String(node._id || "")) || [];
    node.replies = children;
    children.forEach(attachReplies);
  };
  roots.forEach(attachReplies);
  res.json(roots);
});
