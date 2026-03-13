import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import QuickAccessLayout from "../components/QuickAccessLayout";
import { useAuth } from "../context/AuthContext";
import {
  apiRequest,
  createPost,
  createStory,
  getChatContacts,
  getFriendsHub,
  getPostById,
  resolveImage,
  sendChatMessage,
} from "../api";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=DFE8F6&color=1D3A6D`;

const buildPostShareUrl = (postId = "") => {
  const cleanId = String(postId || "").trim();
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://tengacion.onrender.com";
  return `${base}/posts/${cleanId}`;
};

const getAuthorName = (post = {}) =>
  String(post?.user?.name || post?.name || post?.user?.username || "Tengacion creator").trim();

const getAuthorUsername = (post = {}) =>
  String(post?.user?.username || post?.username || "").trim().replace(/^@+/, "");

const truncateText = (value = "", limit = 180) => {
  const clean = String(value || "").trim();
  if (!clean) {
    return "";
  }
  return clean.length > limit ? `${clean.slice(0, limit - 3).trim()}...` : clean;
};

const getPostPreviewImage = (post = {}) => {
  const mediaList = Array.isArray(post?.media) ? post.media : [];
  const firstMedia = mediaList[0];
  const rawMediaUrl =
    firstMedia && typeof firstMedia === "object"
      ? firstMedia.url || ""
      : typeof firstMedia === "string"
        ? firstMedia
        : "";

  return (
    resolveImage(post?.video?.thumbnailUrl || "") ||
    resolveImage(rawMediaUrl || "") ||
    resolveImage(post?.image || post?.photo || "") ||
    ""
  );
};

const buildShareBody = ({ note = "", post = {}, url = "", compact = false } = {}) => {
  const trimmedNote = String(note || "").trim();
  const authorName = getAuthorName(post);
  const authorUsername = getAuthorUsername(post);
  const authorLine = authorUsername
    ? `Shared from ${authorName} (@${authorUsername})`
    : `Shared from ${authorName}`;

  const lines = [];
  if (trimmedNote) {
    lines.push(trimmedNote);
  }
  lines.push(authorLine);
  if (!compact) {
    const excerpt = truncateText(post?.text || "", 220);
    if (excerpt) {
      lines.push(excerpt);
    }
  }
  if (url) {
    lines.push(url);
  }

  return lines.filter(Boolean).join(compact ? "\n" : "\n\n");
};

const normalizeShareTarget = (entry = {}) => {
  const id = String(entry?._id || entry?.id || "").trim();
  if (!id) {
    return null;
  }

  return {
    _id: id,
    name: String(entry?.name || entry?.username || "Friend").trim(),
    username: String(entry?.username || "").trim(),
    avatar: resolveImage(entry?.avatar || entry?.profilePic || "") || "",
    lastMessageAt: Number(entry?.lastMessageAt) || 0,
  };
};

const mergeShareTargets = (contacts = [], friends = []) => {
  const merged = new Map();

  [...contacts, ...friends].forEach((entry) => {
    const normalized = normalizeShareTarget(entry);
    if (!normalized) {
      return;
    }

    const existing = merged.get(normalized._id);
    if (!existing) {
      merged.set(normalized._id, normalized);
      return;
    }

    merged.set(normalized._id, {
      ...existing,
      ...normalized,
      lastMessageAt: Math.max(existing.lastMessageAt, normalized.lastMessageAt),
      avatar: normalized.avatar || existing.avatar,
    });
  });

  return Array.from(merged.values()).sort((left, right) => {
    if (left.lastMessageAt !== right.lastMessageAt) {
      return right.lastMessageAt - left.lastMessageAt;
    }
    return String(left.name || left.username || "").localeCompare(
      String(right.name || right.username || "")
    );
  });
};

const buildShareState = ({ post = {}, note = "", url = "" } = {}) => ({
  postId: String(post?._id || "").trim(),
  url: String(url || "").trim(),
  note: String(note || "").trim(),
  authorName: getAuthorName(post),
  authorUsername: getAuthorUsername(post),
  excerpt: truncateText(post?.text || "", 220),
  previewImage: getPostPreviewImage(post),
});

function ShareOptionIcon({ kind }) {
  switch (kind) {
    case "messenger":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3.2c-4.8 0-8.6 3.5-8.6 7.9 0 2.5 1.3 4.7 3.4 6.1v3.6l3.4-1.9c.6.1 1.2.2 1.8.2 4.8 0 8.6-3.5 8.6-7.9S16.8 3.2 12 3.2z"
            fill="currentColor"
          />
          <path d="M8.1 13.7l2.9-3.1 1.8 1.8 3.2-3.3-2.7 4.2-1.9-1.8-3.3 2.2z" fill="#fff" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3 21l4.8-1.2A8.8 8.8 0 1 0 12 3.2z"
            fill="currentColor"
          />
          <path
            d="M15.9 13.3c-.2-.1-1.3-.7-1.5-.7-.2-.1-.3-.1-.5.1l-.4.5c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-1.9-1.2 7 7 0 0 1-1.3-1.6c-.1-.2 0-.3.1-.5l.3-.3.2-.4c.1-.1 0-.3 0-.4 0-.1-.5-1.2-.7-1.7-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2 1 2.3c.1.2 1.6 2.4 4 3.3.6.3 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.3-.6 1.4-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3z"
            fill="#fff"
          />
        </svg>
      );
    case "story":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="4" fill="currentColor" />
          <circle cx="8" cy="8" r="1.8" fill="#fff" />
          <path d="M6.2 17.2l3.4-3 2.5 1.9 2.6-3 3.1 4.1H6.2z" fill="#fff" />
        </svg>
      );
    case "copy":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 7.5A3.5 3.5 0 0 1 12.5 4h3A3.5 3.5 0 1 1 15.5 11h-2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M15 16.5A3.5 3.5 0 0 1 11.5 20h-3A3.5 3.5 0 1 1 8.5 13h2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M9.5 14.5h5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case "group":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="9" r="2.6" fill="currentColor" />
          <circle cx="16.4" cy="9.7" r="2.3" fill="currentColor" opacity=".75" />
          <path d="M4 19a4.4 4.4 0 0 1 8.8 0z" fill="currentColor" />
          <path d="M12.2 19.2a4 4 0 0 1 8 0z" fill="currentColor" opacity=".75" />
        </svg>
      );
    case "profile":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8.2" r="3.2" fill="currentColor" />
          <path d="M5.1 19.1a6.9 6.9 0 0 1 13.8 0z" fill="currentColor" />
        </svg>
      );
  }
}

export default function PostSharePage() {
  const { user } = useAuth();
  const { postId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const messengerSectionRef = useRef(null);
  const messengerSearchRef = useRef(null);

  const seededPost =
    location.state?.post && String(location.state.post?._id || "") === String(postId || "")
      ? location.state.post
      : null;

  const [post, setPost] = useState(seededPost);
  const [loading, setLoading] = useState(!seededPost);
  const [error, setError] = useState("");
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const shareUrl = useMemo(() => buildPostShareUrl(postId), [postId]);
  const previewImage = useMemo(() => getPostPreviewImage(post), [post]);
  const shareDraft = useMemo(
    () => buildShareState({ post, note, url: shareUrl }),
    [note, post, shareUrl]
  );
  const messengerTargets = useMemo(
    () => mergeShareTargets(contacts, friends),
    [contacts, friends]
  );
  const filteredTargets = useMemo(() => {
    const needle = String(search || "").trim().toLowerCase();
    if (!needle) {
      return messengerTargets;
    }
    return messengerTargets.filter((entry) => {
      const haystack = `${entry?.name || ""} ${entry?.username || ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [messengerTargets, search]);

  useEffect(() => {
    if (!postId) {
      return;
    }

    let alive = true;

    const loadPost = async () => {
      try {
        if (!seededPost) {
          setLoading(true);
        }
        setError("");
        const data = await getPostById(postId);
        if (!alive) {
          return;
        }
        setPost(data);
      } catch (err) {
        if (alive) {
          setError(err?.message || "Post not found");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    loadPost();
    return () => {
      alive = false;
    };
  }, [postId, seededPost]);

  useEffect(() => {
    let alive = true;

    const loadTargets = async () => {
      try {
        setContactsLoading(true);
        const [contactRows, hub] = await Promise.all([
          getChatContacts().catch(() => []),
          getFriendsHub().catch(() => ({ friends: [] })),
        ]);
        if (!alive) {
          return;
        }
        setContacts(Array.isArray(contactRows) ? contactRows : []);
        setFriends(Array.isArray(hub?.friends) ? hub.friends : []);
      } finally {
        if (alive) {
          setContactsLoading(false);
        }
      }
    };

    loadTargets();
    return () => {
      alive = false;
    };
  }, []);

  const recordShare = useCallback(async () => {
    if (!postId) {
      return null;
    }

    const payload = await apiRequest(`/api/posts/${encodeURIComponent(postId)}/share`, {
      method: "POST",
    });

    const nextCount = Number(payload?.shareCount);
    if (Number.isFinite(nextCount)) {
      setPost((current) => (current ? { ...current, shareCount: nextCount } : current));
    }
    return payload;
  }, [postId]);

  const shareToFeed = async () => {
    if (!post || busyAction) {
      return;
    }

    try {
      setBusyAction("feed");
      await createPost({
        text: buildShareBody({ note, post, url: shareUrl }),
      });
      await recordShare().catch(() => null);
      toast.success("Shared to your feed.");
    } catch (err) {
      toast.error(err?.message || "Failed to share to your feed");
    } finally {
      setBusyAction("");
    }
  };

  const sendToContact = async (target) => {
    const targetId = String(target?._id || "").trim();
    if (!targetId || !post || busyAction) {
      return;
    }

    try {
      setBusyAction(`messenger:${targetId}`);
      await sendChatMessage(targetId, {
        text: buildShareBody({ note, post, url: shareUrl }),
      });
      await recordShare().catch(() => null);
      toast.success(`Sent to ${target?.name || target?.username || "Messenger"}.`);
    } catch (err) {
      toast.error(err?.message || "Failed to send in Messenger");
    } finally {
      setBusyAction("");
    }
  };

  const handleMessengerOption = () => {
    messengerSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    messengerSearchRef.current?.focus();
    toast.success("Choose a friend below to send it in Messenger.");
  };

  const handleWhatsAppShare = async () => {
    if (!post || busyAction) {
      return;
    }

    try {
      setBusyAction("whatsapp");
      const message = buildShareBody({ note, post, url: shareUrl, compact: true });
      window.open(
        `https://wa.me/?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
      );
      await recordShare().catch(() => null);
      toast.success("Opened WhatsApp share.");
    } catch (err) {
      toast.error(err?.message || "Unable to open WhatsApp share");
    } finally {
      setBusyAction("");
    }
  };

  const handleStoryShare = async () => {
    if (!post || busyAction) {
      return;
    }

    try {
      setBusyAction("story");
      const form = new FormData();
      form.append("caption", buildShareBody({ note, post, url: shareUrl, compact: true }));
      form.append("visibility", "friends");
      await createStory(form);
      await recordShare().catch(() => null);
      toast.success("Shared to your story.");
    } catch (err) {
      toast.error(err?.message || "Failed to share to your story");
    } finally {
      setBusyAction("");
    }
  };

  const handleCopyLink = async () => {
    if (!post || busyAction) {
      return;
    }

    try {
      setBusyAction("copy");
      await navigator.clipboard.writeText(shareUrl);
      await recordShare().catch(() => null);
      toast.success("Post link copied.");
    } catch (err) {
      toast.error(err?.message || "Failed to copy link");
    } finally {
      setBusyAction("");
    }
  };

  const openGroupShare = () => {
    navigate("/groups", {
      state: {
        sharePost: shareDraft,
      },
    });
  };

  const openFriendProfileShare = () => {
    navigate("/friends", {
      state: {
        sharePost: shareDraft,
      },
    });
  };

  return (
    <QuickAccessLayout
      user={user}
      title="Share"
      subtitle="Send this post in Messenger, put it on your feed, share it to your story, or hand it off to another destination."
    >
      <section className="card post-share-shell">
        {loading ? (
          <div className="post-share-loading">Loading share options...</div>
        ) : error ? (
          <div className="post-share-error">
            <strong>Could not load this post.</strong>
            <p>{error}</p>
            <button type="button" className="post-share-back-btn" onClick={() => navigate(-1)}>
              Go back
            </button>
          </div>
        ) : (
          <div className="post-share-layout">
            <div className="post-share-main">
              <section className="post-share-composer">
                <div className="post-share-composer__top">
                  <div className="post-share-current-user">
                    <img
                      src={resolveImage(user?.avatar) || fallbackAvatar(user?.name || user?.username)}
                      alt={user?.name || "You"}
                    />
                    <div>
                      <strong>{user?.name || user?.username || "You"}</strong>
                      <span>Share to Feed</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="post-share-back-btn"
                    onClick={() => navigate(`/posts/${postId}`)}
                  >
                    Back to post
                  </button>
                </div>

                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Say something about this..."
                  maxLength={280}
                />

                <div className="post-share-composer__footer">
                  <span className="post-share-counter">
                    {Number(post?.shareCount) || 0} share{Number(post?.shareCount) === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    className="post-share-primary-btn"
                    onClick={shareToFeed}
                    disabled={Boolean(busyAction)}
                  >
                    {busyAction === "feed" ? "Sharing..." : "Share now"}
                  </button>
                </div>
              </section>

              <section ref={messengerSectionRef} className="post-share-section">
                <div className="post-share-section__head">
                  <div>
                    <h3>Send in Messenger</h3>
                    <p>Tap a friend to send this post directly.</p>
                  </div>
                </div>

                <label className="post-share-search">
                  <span className="sr-only">Search Messenger contacts</span>
                  <input
                    ref={messengerSearchRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search friends and chats"
                  />
                </label>

                {contactsLoading ? (
                  <p className="post-share-muted">Loading your Messenger contacts...</p>
                ) : filteredTargets.length > 0 ? (
                  <>
                    <div className="post-share-contact-strip">
                      {filteredTargets.slice(0, 8).map((target) => (
                        <button
                          key={target._id}
                          type="button"
                          className="post-share-contact-pill"
                          onClick={() => sendToContact(target)}
                          disabled={Boolean(busyAction)}
                        >
                          <img
                            src={target.avatar || fallbackAvatar(target.name || target.username)}
                            alt={target.name || target.username || "Friend"}
                          />
                          <span>{target.name || target.username || "Friend"}</span>
                        </button>
                      ))}
                    </div>

                    <div className="post-share-contact-list">
                      {filteredTargets.slice(0, 12).map((target) => (
                        <article key={`list-${target._id}`} className="post-share-contact-row">
                          <div className="post-share-contact-row__meta">
                            <img
                              src={target.avatar || fallbackAvatar(target.name || target.username)}
                              alt={target.name || target.username || "Friend"}
                            />
                            <div>
                              <strong>{target.name || "Friend"}</strong>
                              <span>@{target.username || "user"}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="post-share-send-btn"
                            onClick={() => sendToContact(target)}
                            disabled={Boolean(busyAction)}
                          >
                            {busyAction === `messenger:${target._id}` ? "Sending..." : "Send"}
                          </button>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="post-share-muted">
                    No matching Messenger contacts yet. Add more friends or start a chat first.
                  </p>
                )}
              </section>

              <section className="post-share-section">
                <div className="post-share-section__head">
                  <div>
                    <h3>Share to</h3>
                    <p>Pick a destination for this post.</p>
                  </div>
                </div>

                <div className="post-share-options">
                  <button type="button" className="post-share-option" onClick={handleMessengerOption}>
                    <span className="post-share-option__icon messenger">
                      <ShareOptionIcon kind="messenger" />
                    </span>
                    <span>Messenger</span>
                  </button>
                  <button
                    type="button"
                    className="post-share-option"
                    onClick={handleWhatsAppShare}
                    disabled={Boolean(busyAction)}
                  >
                    <span className="post-share-option__icon whatsapp">
                      <ShareOptionIcon kind="whatsapp" />
                    </span>
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    className="post-share-option"
                    onClick={handleStoryShare}
                    disabled={Boolean(busyAction)}
                  >
                    <span className="post-share-option__icon story">
                      <ShareOptionIcon kind="story" />
                    </span>
                    <span>Your story</span>
                  </button>
                  <button
                    type="button"
                    className="post-share-option"
                    onClick={handleCopyLink}
                    disabled={Boolean(busyAction)}
                  >
                    <span className="post-share-option__icon copy">
                      <ShareOptionIcon kind="copy" />
                    </span>
                    <span>Copy link</span>
                  </button>
                  <button type="button" className="post-share-option" onClick={openGroupShare}>
                    <span className="post-share-option__icon group">
                      <ShareOptionIcon kind="group" />
                    </span>
                    <span>Group</span>
                  </button>
                  <button type="button" className="post-share-option" onClick={openFriendProfileShare}>
                    <span className="post-share-option__icon profile">
                      <ShareOptionIcon kind="profile" />
                    </span>
                    <span>Friend&apos;s profile</span>
                  </button>
                </div>
              </section>
            </div>

            <aside className="post-share-preview-card">
              <div className="post-share-preview-card__head">
                <p>Preview</p>
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  Open post
                </a>
              </div>

              <div className="post-share-preview-card__author">
                <img
                  src={
                    resolveImage(post?.user?.avatar || post?.user?.profilePic || "") ||
                    fallbackAvatar(getAuthorName(post))
                  }
                  alt={getAuthorName(post)}
                />
                <div>
                  <strong>{getAuthorName(post)}</strong>
                  <span>
                    {getAuthorUsername(post)
                      ? `@${getAuthorUsername(post)}`
                      : "Post on Tengacion"}
                  </span>
                </div>
              </div>

              {note ? <p className="post-share-preview-card__note">{note}</p> : null}
              {post?.text ? <p className="post-share-preview-card__text">{truncateText(post.text, 260)}</p> : null}

              {previewImage ? (
                <div className="post-share-preview-card__media">
                  <img src={previewImage} alt="Post preview" />
                </div>
              ) : null}

              <div className="post-share-preview-card__linkbox">
                <small>Share link</small>
                <span>{shareUrl}</span>
              </div>
            </aside>
          </div>
        )}
      </section>
    </QuickAccessLayout>
  );
}
