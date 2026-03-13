import { resolveImage } from "../../api";
import {
  fallbackAvatar,
  getAuthorName,
  getAuthorUsername,
  getPostPreviewImage,
  truncateText,
} from "./postShareUtils";

const formatTimeLabel = (value) => {
  if (!value) {
    return "Now";
  }

  try {
    return new Date(value).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "Now";
  }
};

export default function SharePreviewCard({ post }) {
  const authorName = getAuthorName(post);
  const authorUsername = getAuthorUsername(post);
  const authorAvatar =
    resolveImage(post?.user?.profilePic || post?.user?.avatar || post?.avatar || "") ||
    fallbackAvatar(authorName);
  const previewImage = getPostPreviewImage(post);
  const likes = Number(post?.likesCount ?? post?.likes ?? 0) || 0;
  const comments =
    Number(post?.commentsCount) ||
    (Array.isArray(post?.comments) ? post.comments.length : 0);
  const shares = Number(post?.shareCount) || 0;
  const sharedSource =
    post?.sharedPost && typeof post.sharedPost === "object"
      ? {
          authorName: String(post.sharedPost.originalAuthorName || "Original creator").trim(),
          authorUsername: String(post.sharedPost.originalAuthorUsername || "").trim().replace(
            /^@+/,
            ""
          ),
          authorAvatar:
            resolveImage(post.sharedPost.originalAuthorAvatar || "") ||
            fallbackAvatar(post.sharedPost.originalAuthorName || "Original creator"),
          text: String(post.sharedPost.originalText || "").trim(),
          image: resolveImage(post.sharedPost.previewImage || "") || "",
          mediaType: String(post.sharedPost.previewMediaType || "text").trim(),
        }
      : null;

  return (
    <article className="tg-share-preview-card" aria-label="Read-only preview of the shared post">
      <div className="tg-share-preview-head">
        <span>Post preview</span>
        <small>Read-only</small>
      </div>

      <div className="tg-share-preview-author">
        <img src={authorAvatar} alt={authorName} />
        <div>
          <strong>{authorName}</strong>
          <span>
            {authorUsername ? `@${authorUsername}` : "Tengacion creator"} ·{" "}
            {formatTimeLabel(post?.createdAt)}
          </span>
        </div>
      </div>

      {post?.text ? <p className="tg-share-preview-text">{truncateText(post.text, 260)}</p> : null}

      {sharedSource ? (
        <div className="tg-share-preview-source">
          <div className="tg-share-preview-source__author">
            <img src={sharedSource.authorAvatar} alt={sharedSource.authorName} />
            <div>
              <strong>{sharedSource.authorName}</strong>
              <span>
                {sharedSource.authorUsername
                  ? `@${sharedSource.authorUsername}`
                  : "Original post"}
              </span>
            </div>
          </div>
          {sharedSource.text ? (
            <p className="tg-share-preview-source__text">
              {truncateText(sharedSource.text, 220)}
            </p>
          ) : null}
          {sharedSource.image ? (
            <div className="tg-share-preview-media">
              <img
                src={sharedSource.image}
                alt={
                  sharedSource.mediaType === "video"
                    ? "Shared video preview"
                    : "Shared post preview"
                }
              />
            </div>
          ) : null}
        </div>
      ) : previewImage ? (
        <div className="tg-share-preview-media">
          <img src={previewImage} alt="Shared post preview" />
        </div>
      ) : null}

      {(likes > 0 || comments > 0 || shares > 0) && (
        <div className="tg-share-preview-stats">
          <span>{likes} likes</span>
          <span>{comments} comments</span>
          <span>{shares} shares</span>
        </div>
      )}
    </article>
  );
}
