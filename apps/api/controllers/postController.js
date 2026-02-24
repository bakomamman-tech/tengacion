const PostService = require("../services/postService");
const catchAsync = require("../utils/catchAsync");

exports.createPost = catchAsync(async (req, res) => {
  const payload = await PostService.createPost({
    userId: req.user.id,
    body: req.body,
    files: req.files,
  });
  res.status(201).json(payload);
});

exports.getFeed = catchAsync(async (req, res) => {
  const result = await PostService.getFeed({
    userId: req.user.id,
    search: req.query.search,
  });
  res.json(result);
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
    text: req.body.text,
    io: req.app.get("io"),
    onlineUsers: req.app.get("onlineUsers"),
  });
  res.status(201).json(payload);
});
