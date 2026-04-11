import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import PostComments from "./PostComments";
import ExpandablePostText from "./posts/ExpandablePostText";
import ProfileNameLink from "./ui/ProfileNameLink";
import PostShareModal from "./share/PostShareModal";
import {
  buildPostShareUrl,
  fallbackAvatar,
} from "./share/postShareUtils";
import { apiRequest, createReport, initPayment, resolveImage } from "../api";
import { useAuth } from "../context/AuthContext";
import { createReportDialogConfig } from "../constants/reportReasons";
import VideoPlayer from "./media/VideoPlayer";
import { useDialog } from "./ui/useDialog";

/* ======================================================
   SYSTEM / STARTER POST HANDLING
   ====================================================== */

function SystemPost({ text }) {
  return (
    <article className="post-card system-post">
      <div className="post-text-block">
        <p className="system-text post-text">{text}</p>
      </div>
    </article>
  );
}

/* ======================================================
   REACTIONS
   ====================================================== */

const REACTIONS = [
  { key: "like", label: "\u{1F44D}", name: "Like" },
  { key: "love", label: "\u{2764}\u{FE0F}", name: "Love" },
  { key: "haha", label: "\u{1F602}", name: "Haha" },
  { key: "wow", label: "\u{1F62E}", name: "Wow" },
  { key: "sad", label: "\u{1F622}", name: "Sad" },
  { key: "angry", label: "\u{1F621}", name: "Angry" },
];

const DEFAULT_REACTION = REACTIONS[0];
const REACTION_LOOKUP = new Map(REACTIONS.map((reaction) => [reaction.key, reaction]));
const POST_TEXT_WORD_LIMIT = 200;

const normalizeReactionKey = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const lower = raw.toLowerCase();
  if (REACTION_LOOKUP.has(lower)) {
    return lower;
  }

  const emojiMatch = REACTIONS.find((reaction) => reaction.label === raw);
  return emojiMatch ? emojiMatch.key : "";
};

const getReactionByValue = (value = "") => {
  const key = normalizeReactionKey(value);
  return key ? REACTION_LOOKUP.get(key) || null : null;
};

const inferVideoMimeType = (url = "", fallback = "") => {
  const normalizedFallback = String(fallback || "").toLowerCase();
  if (normalizedFallback.startsWith("video/")) {
    return normalizedFallback;
  }

  const cleanUrl = String(url || "").toLowerCase();
  if (cleanUrl.includes(".webm")) {return "video/webm";}
  if (cleanUrl.includes(".ogg")) {return "video/ogg";}
  if (cleanUrl.includes(".mov")) {return "video/quicktime";}
  if (cleanUrl.includes(".m4v")) {return "video/mp4";}
  return "video/mp4";
};

const normalizeTagHandle = (value = "") =>
  String(value || "").trim().replace(/^@+/, "").replace(/\s+/g, "").toLowerCase().slice(0, 30);

const normalizeTaggedUser = (value = {}) => {
  if (typeof value === "string") {
    const raw = String(value || "").trim();
    if (!raw) {
      return null;
    }

    if (/^\S+$/.test(raw)) {
      return { userId: "", name: "", username: normalizeTagHandle(raw) };
    }

    return { userId: "", name: raw, username: "" };
  }

  const userId = String(value?.userId || value?._id || value?.id || "").trim();
  const name = String(value?.name || "").trim();
  const username = normalizeTagHandle(value?.username || value?.handle);

  if (!userId && !name && !username) {
    return null;
  }

  return { userId, name, username };
};

const getTaggedUserLabel = (person = {}) => {
  const name = String(person?.name || "").trim();
  const username = normalizeTagHandle(person?.username);

  if (name && username) {
    return `${name} @${username}`;
  }

  if (name) {
    return name;
  }

  if (username) {
    return `@${username}`;
  }

  return "";
};

const getTaggedUserHeadline = (person = {}) => {
  const name = String(person?.name || "").trim();
  const username = normalizeTagHandle(person?.username);
  return name || (username ? `@${username}` : "");
};

/* ======================================================
   EDIT MODAL
   ====================================================== */

function EditPostModal({ post, onClose, onSave }) {
  const [text, setText] = useState(post?.text || "");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = "");
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!text.trim() || loading) {
      return;
    }

    try {
      setLoading(true);

      const data = await apiRequest(`/api/posts/${post._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      onSave(data);
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to update post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pc-overlay">
      <div className="pc-modal" ref={boxRef} role="dialog" aria-modal="true">
        <div className="pc-header">
          <h3>Edit post</h3>
          <button className="pc-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <textarea
          className="pc-textarea"
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoFocus
        />

        <button
          className={`pc-submit ${text.trim() ? "active" : ""}`}
          disabled={!text.trim() || loading}
          onClick={submit}
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/* ======================================================
   MAIN POST CARD
   ====================================================== */

export default function PostCard({
  post,
  isSystem,
  onDelete,
  onEdit,
  onShareCreated,
  discoveryMeta = null,
  onRecommendationAction,
}) {
  const { confirm, prompt } = useDialog();
  const { user: currentUser } = useAuth() || {};
  /* SYSTEM POST SHORT-CIRCUIT */
  const isSystemPost = isSystem || post?.system;
  const isRecommendedPost = Boolean(discoveryMeta?.requestId);

  /* -------------------------------------------------- */

  const [reaction, setReaction] = useState(
    getReactionByValue(post?.viewerReaction) || (post?.likedByViewer ? DEFAULT_REACTION : null)
  );
  const [showReactions, setShowReactions] = useState(false);
  const [hoveredReactionKey, setHoveredReactionKey] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const articleRef = useRef(null);
  const hasTrackedImpressionRef = useRef(false);
  const hasTrackedDwellRef = useRef(false);
  const [isCardInView, setIsCardInView] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const reactionOpenTimerRef = useRef(null);
  const reactionCloseTimerRef = useRef(null);

  const timeLabel = post?.createdAt
    ? new Date(post.createdAt).toLocaleString()
    : "Just now";

  const username = post?.user?.name || post?.name || "Unknown User";
  const authorHandle = normalizeTagHandle(post?.user?.username || post?.username || "");
  const authorProfilePath = authorHandle ? `/profile/${authorHandle}` : "";
  const avatar =
    resolveImage(post?.user?.profilePic || post?.avatar) || "/avatar.png";
  const firstMediaEntry = Array.isArray(post?.media)
    ? post.media?.[0]
    : post?.media;
  const mediaUrlCandidate =
    firstMediaEntry && typeof firstMediaEntry === "object"
      ? firstMediaEntry.secureUrl || firstMediaEntry.secure_url || firstMediaEntry.url || ""
      : typeof firstMediaEntry === "string"
        ? firstMediaEntry
        : "";
  const mediaTypeCandidate =
    firstMediaEntry && typeof firstMediaEntry === "object"
      ? (firstMediaEntry.type || "").toLowerCase()
      : "";
  const legacyMediaUrl = post?.image || post?.photo || "";
  const postMediaUrl = resolveImage(mediaUrlCandidate || legacyMediaUrl);
  const hasVideoExtension = /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i.test(
    postMediaUrl || ""
  );
  const hasImageExtension = /\.(png|jpe?g|gif|webp|bmp|svg|avif)(?:\?.*)?$/i.test(
    postMediaUrl || ""
  );
  const explicitVideo = mediaTypeCandidate === "video" || hasVideoExtension;
  const explicitImage = mediaTypeCandidate === "image" || hasImageExtension;
  const [imageRetryToken, setImageRetryToken] = useState(0);
  const resolvedPostImageUrl = useMemo(() => {
    if (!postMediaUrl) {
      return "";
    }
    if (!imageRetryToken) {
      return postMediaUrl;
    }

    const separator = postMediaUrl.includes("?") ? "&" : "?";
    return `${postMediaUrl}${separator}img_retry=${imageRetryToken}`;
  }, [imageRetryToken, postMediaUrl]);
  const postMediaBackdropStyle =
    resolvedPostImageUrl && (explicitImage || !explicitVideo)
      ? { "--post-media-image": `url("${String(resolvedPostImageUrl).replace(/"/g, '\\"')}")` }
      : undefined;
  const [forceVideoRender, setForceVideoRender] = useState(false);
  const videoPayload = post.video && typeof post.video === "object" ? post.video : null;
  const hasVideoPayload = Boolean(videoPayload?.url || videoPayload?.playbackUrl);
  const postVideoSource = hasVideoPayload
    ? resolveImage(videoPayload.playbackUrl || videoPayload.url)
    : explicitVideo
      ? postMediaUrl
      : "";
  const shouldRenderVideo = explicitVideo || hasVideoPayload || forceVideoRender;
  const shouldRenderImage = explicitImage || !explicitVideo;
  const videoPoster = resolveImage(videoPayload?.thumbnailUrl || "");
  const videoMimeType = inferVideoMimeType(postVideoSource, videoPayload?.mimeType || "");
  const hasAnyMedia = Boolean(postVideoSource || postMediaUrl);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);
  const videoWrapperRef = useRef(null);
  const taggedUsers = useMemo(() => {
    const nextTaggedUsers = (Array.isArray(post?.taggedUsers) ? post.taggedUsers : [])
      .map((entry) => normalizeTaggedUser(entry))
      .filter(Boolean);

    if (nextTaggedUsers.length > 0) {
      return nextTaggedUsers;
    }

    const tags = Array.isArray(post?.tags) ? post.tags.filter(Boolean) : [];
    return tags.map((entry) => normalizeTaggedUser(entry)).filter(Boolean);
  }, [post?.taggedUsers, post?.tags]);
  const primaryTaggedUser = taggedUsers[0] || null;
  const additionalTaggedCount = Math.max(0, taggedUsers.length - 1);
  const feeling = typeof post?.feeling === "string" ? post.feeling.trim() : "";
  const checkInLocation =
    typeof post?.location === "string" ? post.location.trim() : "";
  const callToAction =
    post?.callToAction && typeof post.callToAction === "object"
      ? post.callToAction
      : {};
  const moreOptions = Array.isArray(post?.moreOptions)
    ? post.moreOptions.filter(Boolean)
    : [];
  const callValue =
    typeof callToAction?.value === "string" ? callToAction.value.trim() : "";
  const hasCallCta =
    callToAction?.type === "call" &&
    Boolean(callToAction?.enabled) &&
    Boolean(callValue);

  const audioTrack = post?.audio;
  const audioPreviewUrl = audioTrack?.previewUrl || audioTrack?.url;
  const hasAudioPreview = Boolean(audioPreviewUrl);
  const hasSharedPost = Boolean(
    post?.sharedPost &&
      typeof post.sharedPost === "object" &&
      (
        post.sharedPost.originalPostId ||
        post.sharedPost.originalAuthorName ||
        post.sharedPost.originalText ||
        post.sharedPost.previewImage
      )
  );
  const sharedPostAuthorName = String(
    post?.sharedPost?.originalAuthorName || "Original creator"
  ).trim();
  const sharedPostAuthorHandle = normalizeTagHandle(
    post?.sharedPost?.originalAuthorUsername || ""
  );
  const sharedPostAvatar =
    resolveImage(post?.sharedPost?.originalAuthorAvatar || "") ||
    fallbackAvatar(sharedPostAuthorName);
  const sharedPostPreviewText = String(post?.sharedPost?.originalText || "").trim();
  const sharedPostPreviewImage = resolveImage(post?.sharedPost?.previewImage || "");
  const sharedPostKind = String(post?.sharedPost?.previewMediaType || "text").trim();
  const handleTrackPayment = async () => {
    if (!audioTrack?.trackId) {return;}
    setPaymentLoading(true);
    try {
      const payment = await initPayment({
        itemType: "track",
        itemId: audioTrack.trackId.toString(),
        returnUrl: window.location.href,
      });

      if (payment?.authorization_url) {
        window.open(payment.authorization_url, "_blank");
      } else {
        toast.error("Unable to start payment right now.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to start payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  const baseLikesCount = Number(post?.likesCount ?? post?.likes ?? 0) || 0;
  const baseCommentsCount =
    Number(post?.commentsCount) ||
    (Array.isArray(post?.comments) ? post.comments.length : 0);
  const [likesCount, setLikesCount] = useState(baseLikesCount);
  const [likedByViewer, setLikedByViewer] = useState(Boolean(post?.likedByViewer));
  const [liveCommentsCount, setLiveCommentsCount] = useState(baseCommentsCount);
  const [shareCount, setShareCount] = useState(Number(post?.shareCount) || 0);
  const [liking, setLiking] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const reactionsCount = likesCount;
  const commentsLabel = liveCommentsCount === 1 ? "comment" : "comments";
  const sharesLabel = shareCount === 1 ? "share" : "shares";
  const commentsPanelId = `post-comments-${post?._id || "panel"}`;
  const currentUserId = String(currentUser?._id || currentUser?.id || "").trim();
  const postAuthorId = String(
    post?.user?._id || post?.authorId || post?.author?._id || post?.author || ""
  ).trim();
  const isOwner = Boolean(
    post?.isOwner || (currentUserId && postAuthorId && currentUserId === postAuthorId)
  );
  const runRecommendationAction = useCallback(
    async (payload = {}) => {
      if (!isRecommendedPost || typeof onRecommendationAction !== "function") {
        return;
      }

      await onRecommendationAction({
        post,
        discoveryMeta,
        ...payload,
      });
    },
    [discoveryMeta, isRecommendedPost, onRecommendationAction, post]
  );

  useEffect(() => {
    const handler = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setLiveCommentsCount(baseCommentsCount);
  }, [baseCommentsCount, post?._id]);

  useEffect(() => {
    setLikesCount(baseLikesCount);
    const nextViewerReaction = getReactionByValue(post?.viewerReaction);
    const nextLiked = Boolean(post?.likedByViewer || nextViewerReaction);
    setLikedByViewer(nextLiked);
    setReaction(nextViewerReaction || (nextLiked ? DEFAULT_REACTION : null));
    setShowReactions(false);
    setHoveredReactionKey("");
  }, [baseLikesCount, post?._id, post?.likedByViewer, post?.viewerReaction]);

  useEffect(() => () => {
    if (reactionOpenTimerRef.current) {
      window.clearTimeout(reactionOpenTimerRef.current);
      reactionOpenTimerRef.current = null;
    }
    if (reactionCloseTimerRef.current) {
      window.clearTimeout(reactionCloseTimerRef.current);
      reactionCloseTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setShareCount(Number(post?.shareCount) || 0);
  }, [post?._id, post?.shareCount]);

  useEffect(() => {
    if (!showComments) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowComments(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showComments]);

  useEffect(() => {
    hasTrackedImpressionRef.current = false;
    hasTrackedDwellRef.current = false;
    setIsCardInView(false);
  }, [discoveryMeta?.requestId, discoveryMeta?.entityId, post?._id]);

  useEffect(() => {
    setVideoError(false);
    setForceVideoRender(false);
    setImageRetryToken(0);
    setIsPlaying(false);
    setIsBuffering(false);
    setIsInView(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [post?._id, postMediaUrl, mediaTypeCandidate, postVideoSource]);

  useEffect(() => {
    if (!isRecommendedPost || !articleRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsCardInView(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.6 }
    );

    observer.observe(articleRef.current);
    return () => observer.disconnect();
  }, [isRecommendedPost, discoveryMeta?.requestId, discoveryMeta?.entityId]);

  useEffect(() => {
    if (!isRecommendedPost || !isCardInView || hasTrackedImpressionRef.current) {
      return;
    }

    hasTrackedImpressionRef.current = true;
    void runRecommendationAction({
      action: "impression",
      eventType: "feed_impression",
    });
  }, [isCardInView, isRecommendedPost, runRecommendationAction]);

  useEffect(() => {
    if (!isRecommendedPost || !isCardInView || hasTrackedDwellRef.current) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      hasTrackedDwellRef.current = true;
      void runRecommendationAction({
        action: "dwell",
        eventType: "post_dwell",
        value: 4,
      });
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [isCardInView, isRecommendedPost, runRecommendationAction]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsInView(entry?.isIntersecting ?? false);
      },
      { threshold: 0.5 }
    );

    observer.observe(videoElement);

    return () => {
      observer.disconnect();
    };
  }, [post?._id, postMediaUrl]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || videoError) {
      return;
    }

    if (!isInView) {
      videoElement.pause();
      setIsPlaying(false);
    }
  }, [isInView, videoError, postMediaUrl]);

  const retryVideoPlayback = () => {
    setVideoError(false);
    setIsBuffering(false);
    setIsPlaying(false);
    const current = videoRef.current;
    if (!current) {
      return;
    }
    current.load();
  };

  const clearReactionCloseTimer = useCallback(() => {
    if (!reactionCloseTimerRef.current) {
      return;
    }

    window.clearTimeout(reactionCloseTimerRef.current);
    reactionCloseTimerRef.current = null;
  }, []);

  const openReactionPicker = useCallback(() => {
    clearReactionCloseTimer();
    if (reactionOpenTimerRef.current) {
      return;
    }

    reactionOpenTimerRef.current = window.setTimeout(() => {
      setShowReactions(true);
      reactionOpenTimerRef.current = null;
    }, 100);
  }, [clearReactionCloseTimer]);

  const hideReactionPicker = useCallback(() => {
    if (reactionOpenTimerRef.current) {
      window.clearTimeout(reactionOpenTimerRef.current);
      reactionOpenTimerRef.current = null;
    }
    clearReactionCloseTimer();
    setShowReactions(false);
    setHoveredReactionKey("");
  }, [clearReactionCloseTimer]);

  const scheduleHideReactionPicker = useCallback(() => {
    if (reactionOpenTimerRef.current) {
      window.clearTimeout(reactionOpenTimerRef.current);
      reactionOpenTimerRef.current = null;
    }
    clearReactionCloseTimer();
    reactionCloseTimerRef.current = window.setTimeout(() => {
      setShowReactions(false);
      setHoveredReactionKey("");
      reactionCloseTimerRef.current = null;
    }, 120);
  }, [clearReactionCloseTimer]);

  const activeReaction = hoveredReactionKey
    ? REACTION_LOOKUP.get(hoveredReactionKey) || reaction
    : reaction;

  const likeBtnLabel = useMemo(() => {
    if (!likedByViewer) {
      return "Like";
    }

    return activeReaction?.name || "Like";
  }, [activeReaction, likedByViewer]);

  const likeBtnEmoji = likedByViewer
    ? activeReaction?.label || DEFAULT_REACTION.label
    : DEFAULT_REACTION.label;
  const likeBtnReactionKey = likedByViewer
    ? activeReaction?.key || DEFAULT_REACTION.key
    : "";

  const postLink = useMemo(() => buildPostShareUrl(post?._id), [post?._id]);

  const copyCurrentLink = async () => {
    if (!postLink) {
      throw new Error("Post link unavailable");
    }
    await navigator.clipboard.writeText(postLink);
  };

  const copyLinkOnly = async () => {
    try {
      await copyCurrentLink();
      toast.success("Post link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const explainRecommendation = () => {
    if (!discoveryMeta?.reasonLabel) {
      return;
    }
    toast.success(discoveryMeta.reasonLabel);
  };

  const handleRecommendationMenuAction = async (action) => {
    if (!isRecommendedPost || feedbackBusy) {
      return;
    }

    try {
      setFeedbackBusy(true);
      await runRecommendationAction({ action });
      setMenuOpen(false);
    } catch (err) {
      toast.error(err?.message || "Could not update this recommendation");
    } finally {
      setFeedbackBusy(false);
    }
  };

  const syncLike = async (shouldLike, selectedReaction = null) => {
    if (liking) {
      return;
    }

    const nextReaction = shouldLike ? (selectedReaction || reaction || DEFAULT_REACTION) : null;
    const currentReactionKey = likedByViewer
      ? reaction?.key || DEFAULT_REACTION.key
      : "";
    const nextReactionKey = nextReaction?.key || "";

    hideReactionPicker();

    if (currentReactionKey === nextReactionKey) {
      setLikedByViewer(Boolean(nextReaction));
      setReaction(nextReaction);
      return;
    }

    try {
      setLiking(true);

      const data = await apiRequest(`/api/posts/${post._id}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reactionKey: nextReactionKey,
        }),
      });

      const nextLiked = Boolean(data?.liked ?? data?.likedByViewer ?? nextReactionKey);
      const nextViewerReaction = getReactionByValue(data?.viewerReaction);
      setLikedByViewer(nextLiked);
      setLikesCount((current) => {
        const nextCount = Number(data?.likesCount);
        if (Number.isFinite(nextCount) && nextCount >= 0) {
          return nextCount;
        }
        return Math.max(0, current + (nextLiked ? 1 : -1));
      });
      setReaction(nextLiked ? nextViewerReaction || nextReaction || reaction || DEFAULT_REACTION : null);
      if (nextLiked) {
        void runRecommendationAction({
          action: "like",
          eventType: "recommendation_clicked",
          metadata: {
            engagement: "like",
          },
        });
      }
    } catch (err) {
      toast.error(err.message || "Failed to update like");
    } finally {
      setLiking(false);
    }
  };

  const openShareComposer = () => {
    if (!post?._id) {
      return;
    }

    setShowComments(false);
    setShareOpen(true);
  };

  const commentsLayer =
    showComments && typeof document !== "undefined"
      ? createPortal(
          <div
            className="post-comments-overlay"
            role="presentation"
            onMouseDown={() => setShowComments(false)}
          >
            <PostComments
              postId={post?._id}
              initialComments={post?.comments}
              initialCount={baseCommentsCount}
              onCountChange={setLiveCommentsCount}
              panelId={commentsPanelId}
              panelClassName="post-comments-panel"
              onClose={() => setShowComments(false)}
              postOwnerId={postAuthorId}
              postOwnerName={username}
              postOwnerUsername={authorHandle}
            />
          </div>,
          document.body
        )
      : null;

  const deletePost = async () => {
    if (deleting) {
      return;
    }

    const ok = await confirm({
      title: "Delete post?",
      description: "This removes the post from your feed and cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      confirmVariant: "destructive",
    });
    if (!ok) {
      return;
    }

    try {
      setDeleting(true);

      await apiRequest(`/api/posts/${post._id}`, {
        method: "DELETE",
      });

      onDelete?.(post._id);
      setMenuOpen(false);
    } catch (err) {
      toast.error(err.message || "Failed to delete post");
    } finally {
      setDeleting(false);
    }
  };

  const reportPost = async () => {
    if (reporting) {
      return;
    }

    const reason = await prompt(createReportDialogConfig("post", "spam"));
    if (!reason) {
      return;
    }

    try {
      setReporting(true);
      await createReport({
        targetType: "post",
        targetId: post?._id,
        reason: String(reason || "").trim().toLowerCase(),
      });
      toast.success("Report submitted");
      setMenuOpen(false);
    } catch (err) {
      toast.error(err?.message || "Failed to submit report");
    } finally {
      setReporting(false);
    }
  };

  if (isSystemPost) {
    return <SystemPost text={post?.text} />;
  }

  return (
    <>
      <article ref={articleRef} className="post-card post-fade">
        {/* HEADER */}
        <div className="post-header">
          <div className="post-user">
            <img className="post-avatar" src={avatar} alt="user" />
            <div className="post-user-meta">
              <p className="post-name">
                {authorProfilePath ? (
                  <Link
                    className="post-name-author post-name-author-link"
                    to={authorProfilePath}
                    aria-label={`Open ${username}'s profile`}
                  >
                    {username}
                  </Link>
                ) : (
                  <span className="post-name-author">{username}</span>
                )}
                {primaryTaggedUser && (
                  <span className="post-name-context">
                    is with{" "}
                    <ProfileNameLink
                      username={primaryTaggedUser.username}
                      className="post-name-tagged-person post-name-tagged-person-link"
                      ariaLabel={`Open ${
                        getTaggedUserLabel(primaryTaggedUser) || "tagged user"
                      }'s profile`}
                    >
                      {getTaggedUserLabel(primaryTaggedUser) || "Tagged person"}
                    </ProfileNameLink>
                    {additionalTaggedCount > 0 &&
                      ` and ${additionalTaggedCount} other${
                        additionalTaggedCount === 1 ? "" : "s"
                      }`}
                  </span>
                )}
                {!primaryTaggedUser && hasSharedPost && (
                  <span className="post-name-context">
                    shared <span className="post-name-tagged-person">a post</span>
                    {sharedPostAuthorName ? (
                      <>
                        {" "}
                        from{" "}
                        <ProfileNameLink
                          username={sharedPostAuthorHandle}
                          className="post-name-tagged-person post-name-tagged-person-link"
                          ariaLabel={`Open ${sharedPostAuthorName}'s profile`}
                        >
                          {sharedPostAuthorName}
                        </ProfileNameLink>
                      </>
                    ) : null}
                  </span>
                )}
              </p>
              <p className="post-time">{timeLabel}</p>
              {authorHandle && <p className="post-time">@{authorHandle}</p>}
            </div>
          </div>

          {/* MENU */}
          <div className="post-menu" ref={menuRef}>
            <button
              className="post-menu-btn"
              title="More"
              onClick={() => setMenuOpen((state) => !state)}
            >
              {"\u22EF"}
            </button>

            {menuOpen && (
              <div className="post-menu-dropdown">
                <button onClick={copyLinkOnly}>Copy link</button>
                {isRecommendedPost && (
                  <>
                    <button onClick={explainRecommendation}>Why am I seeing this?</button>
                    <button
                      onClick={() => handleRecommendationMenuAction("interested")}
                      disabled={feedbackBusy}
                    >
                      Interested
                    </button>
                    <button
                      onClick={() => handleRecommendationMenuAction("not_interested")}
                      disabled={feedbackBusy}
                    >
                      {feedbackBusy ? "Updating..." : "Not interested"}
                    </button>
                    {discoveryMeta?.authorUserId && (
                      <button
                        onClick={() => handleRecommendationMenuAction("mute_creator")}
                        disabled={feedbackBusy}
                      >
                        Mute creator
                      </button>
                    )}
                    {discoveryMeta?.creatorId && (
                      <button
                        onClick={() => handleRecommendationMenuAction("toggle_follow_creator")}
                        disabled={feedbackBusy}
                      >
                        {discoveryMeta?.viewerFollowsCreator ? "Unfollow creator" : "Follow creator"}
                      </button>
                    )}
                  </>
                )}
                {!isOwner && (
                  <button className="danger" onClick={reportPost}>
                    {reporting ? "Reporting..." : "Report post"}
                  </button>
                )}

                {isOwner && (
                  <>
                    <button
                      onClick={() => {
                        setShowComments(false);
                        setEditOpen(true);
                        setMenuOpen(false);
                      }}
                    >
                      Edit post
                    </button>

                    <button className="danger" onClick={deletePost}>
                      {deleting ? "Deleting..." : "Delete post"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* BODY */}
        <div className="post-body">
          {post?.text && (
            <ExpandablePostText
              text={post.text}
              wrapperClassName="post-text-block"
              className="post-text"
              toggleClassName="post-text-toggle"
              collapseMode="words"
              collapsedWords={POST_TEXT_WORD_LIMIT}
            />
          )}

          {hasSharedPost && (
            <div className="post-shared-preview">
              <div className="post-shared-preview__header">
                <div className="post-shared-preview__author">
                  <img src={sharedPostAvatar} alt={sharedPostAuthorName} />
                  <div>
                    <strong>{sharedPostAuthorName}</strong>
                    <span>
                      {sharedPostAuthorHandle
                        ? `@${sharedPostAuthorHandle}`
                        : "Original post"}
                    </span>
                  </div>
                </div>
                <span className="post-shared-preview__badge">
                  {sharedPostKind === "video" ? "Video" : "Original post"}
                </span>
              </div>

              {sharedPostPreviewText ? (
                <ExpandablePostText
                  text={sharedPostPreviewText}
                  wrapperClassName="post-shared-preview__text-block"
                  className="post-shared-preview__text post-text"
                  toggleClassName="post-text-toggle"
                  collapseMode="words"
                  collapsedWords={POST_TEXT_WORD_LIMIT}
                />
              ) : null}

              {sharedPostPreviewImage ? (
                <div className="post-shared-preview__media">
                  <img src={sharedPostPreviewImage} alt="Shared post preview" />
                </div>
              ) : null}
            </div>
          )}

          {(taggedUsers.length > 0 || feeling || checkInLocation || moreOptions.length > 0) && (
            <div className="post-meta-row">
              {taggedUsers.map((person) => (
                <span
                  key={`tag-${person.userId || person.username || person.name}`}
                  className="post-meta-chip tag"
                  title={getTaggedUserLabel(person)}
                >
                  <span className="post-tag-chip-name">
                    {getTaggedUserHeadline(person)}
                  </span>
                  {person.name && person.username && (
                    <span className="post-tag-chip-handle">@{person.username}</span>
                  )}
                </span>
              ))}

              {feeling && (
                <span className="post-meta-chip feeling">Feeling {feeling}</span>
              )}

              {checkInLocation && (
                <span className="post-meta-chip location">
                  Check-in {checkInLocation}
                </span>
              )}

              {moreOptions.map((option) => (
                <span key={`more-${option}`} className="post-meta-chip more">
                  {option}
                </span>
              ))}
            </div>
          )}

          {hasAnyMedia && (
            <div
              className={`post-media${postMediaBackdropStyle ? " post-media--image" : ""}`}
              style={postMediaBackdropStyle}
            >
              {shouldRenderVideo && postVideoSource ? (
                <div className="post-video-wrapper" ref={videoWrapperRef}>
                  <VideoPlayer
                    ref={videoRef}
                    wrapperRef={videoWrapperRef}
                    src={postVideoSource}
                    sourceType={videoMimeType}
                    poster={videoPoster || undefined}
                    isMuted={isMuted}
                    setIsMuted={setIsMuted}
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                    onWaiting={() => setIsBuffering(true)}
                    onPlaying={() => {
                      setIsBuffering(false);
                      setIsPlaying(true);
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onError={() => {
                      setVideoError(true);
                      setIsBuffering(false);
                      setIsPlaying(false);
                    }}
                  />

                  {isBuffering && (
                    <div className="post-video-loading">Loading...</div>
                  )}

                  {videoError && (
                    <div className="post-video-error">
                      Video playback failed.{" "}
                      <button type="button" onClick={retryVideoPlayback}>
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              ) : shouldRenderImage ? (
                <div className="post-media__frame">
                  <img
                    src={resolvedPostImageUrl}
                    alt="post"
                    className="post-image"
                    onError={() => {
                      if (!imageRetryToken && /^https?:\/\//i.test(postMediaUrl || "")) {
                        setImageRetryToken(Date.now());
                        return;
                      }
                      if (explicitVideo || hasVideoPayload) {
                        setForceVideoRender(true);
                      }
                    }}
                  />
                </div>
              ) : null}
            </div>
          )}

          {hasCallCta && (
            <a
              className="post-call-cta"
              href={`tel:${callValue.replace(/\s+/g, "")}`}
            >
              Call {callValue}
            </a>
          )}
          {hasAudioPreview && (
            <div className="post-audio">
              {audioTrack?.coverImageUrl ? (
                <div className="post-audio-cover">
                  <img src={audioTrack.coverImageUrl} alt="Track cover" />
                </div>
              ) : null}
              <audio
                controls
                src={audioPreviewUrl}
                className="post-audio-player"
                preload="metadata"
              />
              {audioTrack?.trackId && (
                <button
                  type="button"
                  className="post-audio-cta"
                  disabled={paymentLoading}
                  onClick={handleTrackPayment}
                >
                  {paymentLoading ? "Preparing..." : "Payment link"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="post-engagement-summary">
          <div className="post-engagement-left">
            <div className="post-reaction-icons" aria-hidden="true">
              <span className="post-reaction-dot like">{"\u{1F44D}"}</span>
              <span className="post-reaction-dot wow">{"\u{1F62E}"}</span>
              <span className="post-reaction-dot love">{"\u{2764}\u{FE0F}"}</span>
            </div>
            <span className="post-engagement-count">{reactionsCount}</span>
          </div>

          <div className="post-engagement-right">
            <span>
              {liveCommentsCount} {commentsLabel}
            </span>
            <span>
              {shareCount} {sharesLabel}
            </span>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="post-actions">
          <div
            className={`reaction-wrapper${showReactions ? " is-open" : ""}`}
            onMouseEnter={openReactionPicker}
            onMouseLeave={scheduleHideReactionPicker}
          >
            {showReactions && (
              <div className="reaction-bar">
                {REACTIONS.map((nextReaction) => (
                  <button
                    key={nextReaction.key}
                    type="button"
                    data-reaction-key={nextReaction.key}
                    className={`reaction-bar-btn reaction-bar-btn--${nextReaction.key}${reaction?.key === nextReaction.key ? " is-selected" : ""}`}
                    title={nextReaction.name}
                    aria-label={nextReaction.name}
                    aria-pressed={reaction?.key === nextReaction.key}
                    onMouseEnter={() => setHoveredReactionKey(nextReaction.key)}
                    onMouseLeave={() => {
                      setHoveredReactionKey((current) =>
                        current === nextReaction.key ? "" : current
                      );
                    }}
                    onFocus={() => setHoveredReactionKey(nextReaction.key)}
                    onBlur={() => setHoveredReactionKey("")}
                    onClick={() => {
                      hideReactionPicker();
                      syncLike(true, nextReaction);
                    }}
                  >
                    {nextReaction.label}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className={`action-btn ${likedByViewer ? "active-like" : ""}${likedByViewer ? ` reaction-${likeBtnReactionKey}` : ""}`}
              data-reaction-key={likeBtnReactionKey}
              onClick={() => syncLike(!likedByViewer, likedByViewer ? null : DEFAULT_REACTION)}
              disabled={liking}
              aria-pressed={likedByViewer}
              aria-expanded={showReactions}
              aria-haspopup="true"
            >
              <span className="btn-emoji">
                {likeBtnEmoji}
              </span>
              <span>{likeBtnLabel}</span>
            </button>
          </div>

          <button
            type="button"
            className={`action-btn ${showComments ? "active" : ""}`}
            onClick={() => {
              setShowComments((state) => {
                const nextState = !state;
                if (nextState) {
                  setMenuOpen(false);
                  void runRecommendationAction({
                    action: "open_comments",
                    eventType: "post_opened",
                    metadata: {
                      engagement: "comments",
                    },
                  });
                }
                return nextState;
              });
            }}
            aria-pressed={showComments}
            aria-expanded={showComments}
            aria-controls={commentsPanelId}
          >
            <span className="btn-emoji">{"\u{1F4AC}"}</span>
            <span>Comment</span>
          </button>

          <button
            type="button"
            className="action-btn"
            onClick={openShareComposer}
            disabled={!post?._id}
          >
            <span className="btn-emoji">{"\u{21AA}"}</span>
            <span>Share</span>
          </button>
        </div>

        {/* COMMENTS */}
      </article>

      {editOpen && (
        <EditPostModal
          post={post}
          onClose={() => setEditOpen(false)}
          onSave={(updatedPost) => {
            onEdit?.(updatedPost);
          }}
        />
      )}

      <PostShareModal
        open={shareOpen}
        post={post}
        onClose={() => setShareOpen(false)}
        onShareCountChange={setShareCount}
        onShareCreated={onShareCreated}
      />

      {commentsLayer}
    </>
  );
}
