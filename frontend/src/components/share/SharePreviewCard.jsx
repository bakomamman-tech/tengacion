import { resolveImage } from "../../api";
import ExpandablePostText from "../posts/ExpandablePostText";
import ProfileNameLink from "../ui/ProfileNameLink";
import {
  fallbackAvatar,
  getAuthorName,
  getAuthorUsername,
  getPostPreviewImage,
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
          <ProfileNameLink
            username={authorUsername}
            ariaLabel={`Open ${authorName}'s profile`}
            className="tg-share-preview-author__link"
          >
            <strong>{authorName}</strong>
            <span>{authorUsername ? `@${authorUsername}` : "Tengacion creator"}</span>
          </ProfileNameLink>
          <small>{formatTimeLabel(post?.createdAt)}</small>
        </div>
      </div>

      {post?.text ? (
        <ExpandablePostText
          text={post.text}
          wrapperClassName="tg-share-preview-text-block"
          className="tg-share-preview-text"
          toggleClassName="post-text-toggle"
          collapsedLines={5}
        />
      ) : null}

      {sharedSource ? (
        <div className="tg-share-preview-source">
          <div className="tg-share-preview-source__author">
            <img src={sharedSource.authorAvatar} alt={sharedSource.authorName} />
            <div>
              <ProfileNameLink
                username={sharedSource.authorUsername}
                ariaLabel={`Open ${sharedSource.authorName}'s profile`}
                className="tg-share-preview-source__author-link"
              >
                <strong>{sharedSource.authorName}</strong>
                <span>
                  {sharedSource.authorUsername
                    ? `@${sharedSource.authorUsername}`
                    : "Original post"}
                </span>
              </ProfileNameLink>
            </div>
          </div>
          {sharedSource.text ? (
            <ExpandablePostText
              text={sharedSource.text}
              wrapperClassName="tg-share-preview-source__text-block"
              className="tg-share-preview-source__text"
              toggleClassName="post-text-toggle"
              collapsedLines={5}
            />
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
