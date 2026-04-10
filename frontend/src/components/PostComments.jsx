import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import {
  createPostComment,
  createReport,
  getPostComments,
  resolveImage,
  updatePostComment,
} from "../api";
import { useAuth } from "../context/AuthContext";
import { createReportDialogConfig } from "../constants/reportReasons";
import Button from "./ui/Button";
import ProfileNameLink from "./ui/ProfileNameLink";
import { useDialog } from "./ui/useDialog";

const EMOJIS = [
  "\u{1F44D}",
  "\u{1F60D}",
  "\u{1F602}",
  "\u{1F973}",
  "\u{1F60E}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{2764}\u{FE0F}",
];

const GIF_TOKENS = ["[GIF: Celebration]", "[GIF: Laugh]", "[GIF: Wow]"];
const STICKER_TOKENS = ["[Sticker: Fire]", "[Sticker: Clap]", "[Sticker: Star]"];
const COMMENT_WORD_LIMIT = 5000;
const COMMENT_PREVIEW_WORD_LIMIT = 60;

const countWords = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return 0;
  }

  const matches = trimmed.match(/\S+/g);
  return matches ? matches.length : 0;
};

const normalizeComment = (comment, parentCommentId = "") => {
  if (!comment || typeof comment !== "object") {
    return null;
  }

  const author = comment.author && typeof comment.author === "object" ? comment.author : {};
  const id = String(comment._id || comment.id || "").trim();
  if (!id) {
    return null;
  }

  const authorId = String(comment.authorId || author._id || author.id || comment.author || "").trim();
  const authorName = String(
    comment.authorName || author.name || comment.userName || "User"
  ).trim();
  const authorUsername = String(
    comment.authorUsername || author.username || ""
  )
    .trim()
    .replace(/^@+/, "");
  const authorAvatar = String(comment.authorAvatar || resolveImage(author.avatar) || "").trim();

  return {
    id,
    authorId,
    authorName: authorName || "User",
    authorUsername,
    authorAvatar,
    text: typeof comment.text === "string" ? comment.text : "",
    parentCommentId: String(comment.parentCommentId || parentCommentId || "").trim(),
    createdAt: comment.createdAt || null,
    updatedAt: comment.updatedAt || null,
    edited: Boolean(comment.edited),
    editedAt: comment.editedAt || null,
    mediaPreview: String(comment.mediaPreview || "").trim(),
    replies: [],
  };
};

const flattenCommentInput = (items = [], parentCommentId = "", output = [], seen = new Set()) => {
  (Array.isArray(items) ? items : []).forEach((comment) => {
    const normalized = normalizeComment(comment, parentCommentId);
    if (!normalized || seen.has(normalized.id)) {
      return;
    }

    seen.add(normalized.id);
    output.push(normalized);

    if (Array.isArray(comment?.replies) && comment.replies.length > 0) {
      flattenCommentInput(comment.replies, normalized.id, output, seen);
    }
  });

  return output;
};

const buildCommentTree = (comments = []) => {
  const nodes = new Map();
  const roots = [];

  comments.forEach((comment) => {
    if (!comment?.id) {
      return;
    }

    nodes.set(String(comment.id), { ...comment, replies: [] });
  });

  comments.forEach((comment) => {
    const node = nodes.get(String(comment?.id || ""));
    if (!node) {
      return;
    }

    const parentId = String(comment?.parentCommentId || "").trim();
    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId).replies.push(node);
      return;
    }

    roots.push(node);
  });

  return roots;
};

const countCommentTree = (comments = []) =>
  (Array.isArray(comments) ? comments : []).reduce((total, comment) => {
    const replyCount = countCommentTree(comment?.replies || []);
    return total + 1 + replyCount;
  }, 0);

const insertCommentIntoTree = (comments = [], comment) => {
  const node = { ...comment, replies: [] };
  const parentId = String(comment?.parentCommentId || "").trim();

  if (!parentId) {
    return { nodes: [...comments, node], inserted: true };
  }

  let inserted = false;
  const nextNodes = (Array.isArray(comments) ? comments : []).map((entry) => {
    if (String(entry.id || "") === parentId) {
      inserted = true;
      return { ...entry, replies: [...(entry.replies || []), node] };
    }

    if (!Array.isArray(entry.replies) || entry.replies.length === 0) {
      return entry;
    }

    const childResult = insertCommentIntoTree(entry.replies, comment);
    if (childResult.inserted) {
      inserted = true;
      return childResult.nodes === entry.replies ? entry : { ...entry, replies: childResult.nodes };
    }

    return entry;
  });

  if (!inserted) {
    return { nodes: [...comments, node], inserted: true };
  }

  return { nodes: nextNodes, inserted: true };
};

const updateCommentInTree = (comments = [], updatedComment) => {
  let updated = false;
  const nextNodes = (Array.isArray(comments) ? comments : []).map((entry) => {
    if (String(entry.id || "") === String(updatedComment?.id || "")) {
      updated = true;
      return { ...entry, ...updatedComment, replies: entry.replies || [] };
    }

    if (!Array.isArray(entry.replies) || entry.replies.length === 0) {
      return entry;
    }

    const childResult = updateCommentInTree(entry.replies, updatedComment);
    if (childResult.updated) {
      updated = true;
      return childResult.nodes === entry.replies ? entry : { ...entry, replies: childResult.nodes };
    }

    return entry;
  });

  return { nodes: updated ? nextNodes : comments, updated };
};

const formatCommentTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  const diff = Date.now() - date.getTime();
  if (diff < 60_000) {
    return "Just now";
  }
  if (diff < 3_600_000) {
    return `${Math.max(1, Math.round(diff / 60_000))}m`;
  }
  if (diff < 86_400_000) {
    return `${Math.max(1, Math.round(diff / 3_600_000))}h`;
  }
  if (diff < 604_800_000) {
    return `${Math.max(1, Math.round(diff / 86_400_000))}d`;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

function ToolIcon({ name }) {
  const icons = {
    sticker: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1.4" y="1.4" width="21.2" height="21.2" rx="6" fill="#f0e8ff" />
        <path d="M6.5 8.2h11v7.6h-11z" fill="#7b61ff" opacity="0.2" />
        <path
          d="M9.1 10.8c.5 0 .9-.4.9-.9 0-.6-.4-1-.9-1-.6 0-1 .4-1 1 0 .5.4.9 1 .9zm5.8 0c.5 0 .9-.4.9-.9 0-.6-.4-1-.9-1-.6 0-1 .4-1 1 0 .5.4.9 1 .9z"
          fill="#6f50f3"
        />
        <path
          d="M7.6 14.8c1.3 1.1 2.8 1.7 4.4 1.7s3.2-.6 4.4-1.7"
          stroke="#6f50f3"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
    emoji: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.4" fill="#ffca3a" />
        <circle cx="8.8" cy="10.1" r="1.2" fill="#975f00" />
        <circle cx="15.2" cy="10.1" r="1.2" fill="#975f00" />
        <path
          d="M8.2 14.3c1 1.2 2.3 1.8 3.8 1.8s2.8-.6 3.8-1.8"
          stroke="#975f00"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
    photo: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1.3" y="1.3" width="21.4" height="21.4" rx="5.5" fill="#3ecf78" />
        <rect x="5" y="5.5" width="14" height="12.4" rx="2.2" fill="#defcea" />
        <circle cx="9.1" cy="9.5" r="1.4" fill="#2b9a5e" />
        <path d="M6 17.3l3.7-3.3 2.7 2.2 2.1-1.7 3.5 2.8H6z" fill="#248a52" />
      </svg>
    ),
    effects: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.6" fill="#e9f2ff" />
        <path
          d="M12 5.2l1.6 3.3 3.7.6-2.7 2.7.6 3.7-3.2-1.7-3.2 1.7.6-3.7L6.7 9.1l3.7-.6L12 5.2z"
          fill="#4a83ff"
        />
      </svg>
    ),
  };

  return <span className="comment-tool-icon">{icons[name] || icons.effects}</span>;
}

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2.1 9.2l15.1-6.1c.7-.3 1.4.4 1.1 1.1L12.2 19.3c-.3.8-1.5.8-1.8 0l-1.9-5.1L2.1 12c-.8-.3-.8-1.5 0-1.8z" />
    </svg>
  );
}

function CommentItem({
  comment,
  depth = 0,
  currentUserId = "",
  canReply = false,
  editingCommentId = "",
  editingDraft = "",
  savingCommentId = "",
  onEditingDraftChange = () => {},
  onReply = () => {},
  onStartEdit = () => {},
  onCancelEdit = () => {},
  onSaveEdit = () => {},
  onReport = () => {},
}) {
  const isMine = Boolean(currentUserId && String(currentUserId) === String(comment.authorId || ""));
  const isEditing = String(editingCommentId || "") === String(comment.id || "");
  const avatar = resolveImage(comment.authorAvatar) || "/avatar.png";
  const timeLabel = formatCommentTime(comment.createdAt);
  const saving = String(savingCommentId || "") === String(comment.id || "");
  const [expanded, setExpanded] = useState(false);
  const commentText = String(comment.text || "").trim();
  const commentWordCount = countWords(commentText);
  const shouldCollapse = commentWordCount > COMMENT_PREVIEW_WORD_LIMIT;
  const previewText = shouldCollapse && !expanded
    ? `${commentText
        .split(/\s+/)
        .slice(0, COMMENT_PREVIEW_WORD_LIMIT)
        .join(" ")}...`
    : commentText;

  return (
    <article className={`comment-v2 comment-v2--depth-${depth}`}>
      <div className="comment-v2-row">
        <img className="comment-v2-avatar" src={avatar} alt="" />

        <div className="comment-v2-body">
          <div className="comment-v2-meta">
            <ProfileNameLink
              username={comment.authorUsername}
              className="comment-author-link"
              ariaLabel={`Open ${comment.authorName || comment.authorUsername || "user"}'s profile`}
            >
              <strong>{comment.authorName || "User"}</strong>
              {comment.authorUsername ? <span>@{comment.authorUsername}</span> : null}
            </ProfileNameLink>
            {timeLabel ? <span>{timeLabel}</span> : null}
            {comment.edited ? <span>Edited</span> : null}
          </div>

          {isEditing ? (
            <div className="comment-v2-editor">
              <textarea
                className="comment-v2-editor-input"
                value={editingDraft}
                onChange={(event) => onEditingDraftChange(event.target.value)}
                rows={3}
                autoFocus
              />

              <div className="comment-v2-editor-actions">
                <button
                  type="button"
                  className="comment-inline-action"
                  onClick={onCancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="comment-inline-action comment-inline-action--primary"
                  onClick={() => onSaveEdit(comment)}
                  disabled={!editingDraft.trim() || saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {commentText ? (
                <>
                  <p
                    className={`comment-v2-text ${
                      shouldCollapse && !expanded ? "comment-v2-text--collapsed" : ""
                    }`}
                  >
                    {previewText}
                  </p>
                  {shouldCollapse ? (
                    <button
                      type="button"
                      className="comment-inline-action comment-inline-action--primary comment-v2-more-toggle"
                      onClick={() => setExpanded((value) => !value)}
                      aria-expanded={expanded}
                    >
                      {expanded ? "Show less" : "More"}
                    </button>
                  ) : null}
                </>
              ) : null}
              {comment.mediaPreview ? (
                <img
                  className="comment-inline-media"
                  src={comment.mediaPreview}
                  alt="Comment attachment preview"
                />
              ) : null}

              <div className="comment-v2-actions">
                {canReply ? (
                  <button
                    type="button"
                    className="comment-inline-action"
                    onClick={() => onReply(comment)}
                  >
                    Reply
                  </button>
                ) : null}

                {isMine ? (
                  <button
                    type="button"
                    className="comment-inline-action"
                    onClick={() => onStartEdit(comment)}
                  >
                    Edit
                  </button>
                ) : null}

                <Button
                  size="xs"
                  variant="utility"
                  className="comment-report-btn"
                  onClick={() => onReport(comment)}
                >
                  Report
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {Array.isArray(comment.replies) && comment.replies.length > 0 ? (
        <div className="comment-v2-children">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              currentUserId={currentUserId}
              canReply={canReply}
              editingCommentId={editingCommentId}
              editingDraft={editingDraft}
              savingCommentId={savingCommentId}
              onEditingDraftChange={onEditingDraftChange}
              onReply={onReply}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              onReport={onReport}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function PostComments({
  postId,
  initialComments = [],
  initialCount = 0,
  onCountChange,
  panelId,
  panelClassName = "",
  onClose,
  postOwnerId = "",
  postOwnerName = "",
  postOwnerUsername = "",
}) {
  const { user } = useAuth() || {};
  const currentUserId = String(user?._id || user?.id || "").trim();
  const postOwnerDisplayName = String(postOwnerName || "").trim();
  const postOwnerProfileUsername = String(postOwnerUsername || "").trim();
  const { prompt } = useDialog();
  const initialCommentTree = useMemo(
    () => buildCommentTree(flattenCommentInput(Array.isArray(initialComments) ? initialComments : [])),
    [initialComments]
  );
  const [comments, setComments] = useState(() => initialCommentTree);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [pickedImage, setPickedImage] = useState("");
  const [error, setError] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingDraft, setEditingDraft] = useState("");
  const [savingCommentId, setSavingCommentId] = useState("");
  const imageInputRef = useRef(null);
  const commentWordCount = useMemo(() => countWords(text), [text]);
  const isCommentOverLimit = commentWordCount > COMMENT_WORD_LIMIT;

  const isPostOwner = Boolean(
    currentUserId &&
      String(postOwnerId || "").trim() &&
      currentUserId === String(postOwnerId || "").trim()
  );
  const canReply = isPostOwner;

  useEffect(() => {
    setComments(initialCommentTree);
    setReplyTarget(null);
    setEditingCommentId("");
    setEditingDraft("");
    setPickedImage("");
    setText("");
    setError("");
  }, [postId, initialCommentTree]);

  useEffect(() => {
    let alive = true;

    const loadComments = async () => {
      if (!postId) {
        return;
      }

      try {
        setLoading(true);
        const data = await getPostComments(postId, { threaded: true });
        if (!alive) {
          return;
        }

        const normalized = buildCommentTree(flattenCommentInput(Array.isArray(data) ? data : []));
        setComments(normalized);
      } catch (err) {
        if (!alive) {
          return;
        }

        setError(err?.message || "Failed to load comments");
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    loadComments();

    return () => {
      alive = false;
    };
  }, [postId]);

  const totalCount = useMemo(() => {
    const fromTree = countCommentTree(comments);
    const safeInitial = Number(initialCount);
    if (!Number.isFinite(safeInitial) || safeInitial < 0) {
      return fromTree;
    }
    return Math.max(safeInitial, fromTree);
  }, [comments, initialCount]);

  useEffect(() => {
    onCountChange?.(totalCount);
  }, [onCountChange, totalCount]);

  const closePickers = () => {
    setShowEmojiPicker(false);
    setShowGifPicker(false);
  };

  const clearPickedImage = () => {
    setPickedImage("");
  };

  const handleReport = async (comment) => {
    const reason = await prompt(createReportDialogConfig("comment", "harassment"));
    if (!reason) {
      return;
    }

    try {
      await createReport({
        targetType: "comment",
        targetId: comment.id,
        reason: String(reason).trim().toLowerCase(),
      });
      toast.success("Comment report submitted");
    } catch (err) {
      toast.error(err?.message || "Failed to report comment");
    }
  };

  const handleStartReply = (comment) => {
    if (!canReply) {
      return;
    }

    setReplyTarget(comment);
    setEditingCommentId("");
    setEditingDraft("");
    setError("");
    closePickers();
  };

  const handleStartEdit = (comment) => {
    if (!comment?.id || !currentUserId || String(currentUserId) !== String(comment.authorId || "")) {
      return;
    }

    setEditingCommentId(comment.id);
    setEditingDraft(comment.text || "");
    setReplyTarget(null);
    setError("");
    closePickers();
  };

  const handleCancelEdit = () => {
    setEditingCommentId("");
    setEditingDraft("");
  };

  const handleSaveEdit = async (comment) => {
    const textValue = String(editingDraft || "").trim();
    if (!comment?.id || !textValue || savingCommentId) {
      return;
    }

    try {
      setSavingCommentId(comment.id);
      setError("");

      const data = await updatePostComment(postId, comment.id, {
        text: textValue,
      });

      const updated = normalizeComment(data?.comment, comment.parentCommentId);
      if (updated) {
        setComments((current) => {
          const result = updateCommentInTree(current, updated);
          return result.nodes;
        });
      }

      setEditingCommentId("");
      setEditingDraft("");
      toast.success("Comment updated");
    } catch (err) {
      setError(err?.message || "Failed to update comment");
    } finally {
      setSavingCommentId("");
    }
  };

  const submit = async () => {
    if ((!text.trim() && !pickedImage) || loading || isCommentOverLimit) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const payloadText = text.trim() || "Image reply";
      const data = await createPostComment(postId, {
        text: payloadText,
        parentCommentId: replyTarget?.id || null,
      });

      const serverComment = normalizeComment(data?.comment, replyTarget?.id || "");
      const nextComment = serverComment
        ? {
            ...serverComment,
            mediaPreview: pickedImage || serverComment.mediaPreview || "",
          }
        : null;

      if (nextComment) {
        setComments((current) => insertCommentIntoTree(current, nextComment).nodes);
      }

      setText("");
      setPickedImage("");
      setReplyTarget(null);
      closePickers();
      toast.success(replyTarget ? "Reply posted" : "Comment posted");
    } catch (err) {
      setError(err.message || "Failed to send comment");
    } finally {
      setLoading(false);
    }
  };

  const addEmoji = (emoji) => {
    setText((current) => `${current}${emoji}`);
    setShowEmojiPicker(false);
  };

  const addGifToken = (token) => {
    setText((current) => `${current}${current ? " " : ""}${token}`);
    setShowGifPicker(false);
  };

  const addSticker = () => {
    const token = STICKER_TOKENS[Math.floor(Math.random() * STICKER_TOKENS.length)];
    setText((current) => `${current}${current ? " " : ""}${token}`);
  };

  const addEffect = () => {
    setText((current) => `${current}${current ? " " : ""}\u2728`);
  };

  const pickImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });

      setPickedImage(dataUrl);
      setError("");
    } catch {
      setError("Failed to read image");
    } finally {
      event.target.value = "";
    }
  };

  const replyLabel = replyTarget?.authorName ? `Reply to ${replyTarget.authorName}` : "Comment as you...";
  const commentCountLabel = totalCount === 1 ? "comment" : "comments";

  return (
    <div
      id={panelId}
      className={`comments comments-v2 comments-v2--panel ${panelClassName}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={postOwnerDisplayName ? `${postOwnerDisplayName}'s comments` : "Comments"}
      tabIndex={-1}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="comments-v2-header">
        <div className="comments-v2-header-copy">
          <div className="comments-v2-kicker">Comments</div>
          <div className="comments-v2-title">
            {postOwnerDisplayName ? (
              <>
                <ProfileNameLink
                  username={postOwnerProfileUsername}
                  className="comments-v2-title-link"
                  ariaLabel={`Open ${postOwnerDisplayName}'s profile`}
                >
                  {postOwnerDisplayName}
                </ProfileNameLink>
                <span>'s Post</span>
              </>
            ) : (
              "Comments"
            )}
          </div>
          <div className="comments-v2-subtitle">
            {totalCount} {commentCountLabel}
          </div>
        </div>

        {onClose ? (
          <button
            type="button"
            className="comments-v2-close"
            onClick={onClose}
            aria-label="Close comments"
          >
            X
          </button>
        ) : null}
      </div>

      <div className="comments-v2-list">
        {loading && comments.length === 0 ? (
          <div className="comments-v2-empty">Loading comments...</div>
        ) : null}

        {!loading && comments.length === 0 ? (
          <div className="comments-v2-empty">No comments yet. Be the first to share one.</div>
        ) : null}

        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            canReply={canReply}
            editingCommentId={editingCommentId}
            editingDraft={editingDraft}
            savingCommentId={savingCommentId}
            onEditingDraftChange={setEditingDraft}
            onReply={handleStartReply}
            onStartEdit={handleStartEdit}
            onCancelEdit={handleCancelEdit}
            onSaveEdit={handleSaveEdit}
            onReport={handleReport}
          />
        ))}
      </div>

      <div className="comment-composer-shell">
        <img src={resolveImage(user?.avatar) || "/avatar.png"} alt="me" />

        <div className="comment-composer-main">
          {replyTarget ? (
            <div className="comment-reply-banner">
              <div className="comment-reply-banner__copy">
                <small>
                  Replying to{" "}
                  {replyTarget.authorUsername ? (
                    <ProfileNameLink
                      username={replyTarget.authorUsername}
                      className="comment-reply-banner__author"
                      ariaLabel={`Open ${replyTarget.authorName || replyTarget.authorUsername || "comment author"}'s profile`}
                    >
                      {replyTarget.authorName || "comment"}
                    </ProfileNameLink>
                  ) : (
                    replyTarget.authorName || "comment"
                  )}
                </small>
                <strong>{replyTarget.text || "Comment reply"}</strong>
              </div>
              <button
                type="button"
                className="comment-reply-banner__close"
                onClick={() => setReplyTarget(null)}
                aria-label="Cancel reply"
              >
                Cancel
              </button>
            </div>
          ) : null}

          <div className="comment-input-row">
            <textarea
              className="comment-composer-textarea"
              placeholder={replyLabel}
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  submit();
                }
              }}
            />

            <button
              type="button"
              className={`comment-send-btn ${text.trim() || pickedImage ? "ready" : ""}`}
              disabled={(!text.trim() && !pickedImage) || loading || isCommentOverLimit}
              onClick={submit}
              aria-label="Send comment"
              title="Send"
            >
              <SendIcon />
            </button>
          </div>

          <div className="comment-composer-meta">
            <span className={isCommentOverLimit ? "comment-composer-meta__error" : ""}>
              {isCommentOverLimit
                ? `Comment text is limited to ${COMMENT_WORD_LIMIT.toLocaleString()} words`
                : `${commentWordCount.toLocaleString()} / ${COMMENT_WORD_LIMIT.toLocaleString()} words`}
            </span>
            <span>Press Ctrl+Enter to send</span>
          </div>

          {pickedImage ? (
            <div className="comment-picked-media">
              <img src={pickedImage} alt="Picked comment attachment" />
              <button type="button" onClick={clearPickedImage}>
                Remove
              </button>
            </div>
          ) : null}

          <div className="comment-tools-row">
            <button
              type="button"
              className="comment-tool-btn sticker"
              onClick={addSticker}
              title="Sticker"
            >
              <ToolIcon name="sticker" />
            </button>
            <button
              type="button"
              className="comment-tool-btn emoji"
              onClick={() => {
                setShowEmojiPicker((value) => !value);
                setShowGifPicker(false);
              }}
              title="Emoji"
            >
              <ToolIcon name="emoji" />
            </button>
            <button
              type="button"
              className="comment-tool-btn photo"
              onClick={() => imageInputRef.current?.click()}
              title="Photo"
            >
              <ToolIcon name="photo" />
            </button>
            <button
              type="button"
              className="comment-tool-btn gif"
              onClick={() => {
                setShowGifPicker((value) => !value);
                setShowEmojiPicker(false);
              }}
              title="GIF"
            >
              <span className="comment-tool-gif">GIF</span>
            </button>
            <button
              type="button"
              className="comment-tool-btn effects"
              onClick={addEffect}
              title="Effects"
            >
              <ToolIcon name="effects" />
            </button>
          </div>

          <input
            ref={imageInputRef}
            type="file"
            hidden
            accept="image/*"
            onChange={pickImage}
          />

          {showEmojiPicker ? (
            <div className="comment-picker-row emoji">
              {EMOJIS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => addEmoji(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}

          {showGifPicker ? (
            <div className="comment-picker-row gif">
              {GIF_TOKENS.map((token) => (
                <button key={token} type="button" onClick={() => addGifToken(token)}>
                  {token}
                </button>
              ))}
            </div>
          ) : null}

          {error ? <p className="comment-error">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
