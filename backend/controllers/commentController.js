const Post = require("../models/Post");

/* ================= ADD COMMENT ================= */
exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = {
      author: req.user._id,
      text: text.trim(),
    };

    post.comments.push(comment);
    post.commentsCount += 1;

    await post.save();

    return res.status(201).json({
      message: "Comment added",
      comment: post.comments[post.comments.length - 1],
      commentsCount: post.commentsCount,
    });
  } catch (err) {
    console.error("addComment:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ================= REPLY TO COMMENT ================= */
exports.replyToComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    comment.replies.push({
      author: req.user._id,
      text: text.trim(),
    });

    await post.save();

    return res.status(201).json({
      message: "Reply added",
      reply: comment.replies[comment.replies.length - 1],
    });
  } catch (err) {
    console.error("replyToComment:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ================= LIKE / UNLIKE COMMENT ================= */
exports.toggleCommentLike = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const liked = comment.likes.includes(userId);

    if (liked) {
      comment.likes.pull(userId);
    } else {
      comment.likes.addToSet(userId);
    }

    await post.save();

    return res.status(200).json({
      liked: !liked,
      likesCount: comment.likes.length,
    });
  } catch (err) {
    console.error("toggleCommentLike:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
