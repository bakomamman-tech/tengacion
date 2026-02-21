import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import PostSkeleton from "../components/PostSkeleton";
import PostCard from "../components/PostCard";

import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import Messenger from "../Messenger";
import FriendRequests from "../FriendRequests";
import Stories from "../stories/StoriesBar";

import { createPost, getFeed, getProfile, resolveImage } from "../api";

const FEELING_OPTIONS = [
  "Blessed",
  "Excited",
  "Grateful",
  "Inspired",
  "Focused",
  "Relaxed",
  "Proud",
  "Ready",
];

const MORE_OPTIONS = [
  { id: "audience-question", label: "Audience question" },
  { id: "highlight-post", label: "Highlight post" },
  { id: "share-to-story", label: "Share to story" },
];

function ComposerIcon({ name }) {
  const icons = {
    media: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1.2" y="1.2" width="21.6" height="21.6" rx="5.4" fill="#38c976" />
        <rect x="4.8" y="5.8" width="14.4" height="12" rx="2.2" fill="#defce8" />
        <circle cx="9.2" cy="9.7" r="1.5" fill="#3ab368" />
        <path d="M5.8 17.1l3.8-3.5 2.7 2.3 2-1.7 2.9 2.9H5.8z" fill="#239153" />
      </svg>
    ),
    tag: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.8" fill="#e7f0ff" />
        <circle cx="9.7" cy="9.1" r="2.6" fill="#2f88ff" />
        <circle cx="15.2" cy="10" r="2.1" fill="#5ba3ff" />
        <path d="M5.6 17.8c.8-2.5 2.8-4 5-4 2.2 0 4.1 1.5 5 4v.4h-10z" fill="#2f88ff" />
        <path d="M13.2 18c.6-1.8 1.8-2.9 3.4-2.9 1 0 1.9.4 2.7 1.2v1.7z" fill="#5ba3ff" />
      </svg>
    ),
    feeling: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.6" fill="#ffc93f" />
        <circle cx="8.8" cy="10" r="1.2" fill="#9f6500" />
        <circle cx="15.2" cy="10" r="1.2" fill="#9f6500" />
        <circle cx="7.2" cy="13.2" r="1.3" fill="#ffb25f" />
        <circle cx="16.8" cy="13.2" r="1.3" fill="#ffb25f" />
        <path
          d="M8.2 14.5c1 1.2 2.3 1.8 3.8 1.8s2.8-.6 3.8-1.8"
          stroke="#9f6500"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
    location: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 22s6.4-5.6 6.4-11a6.4 6.4 0 1 0-12.8 0c0 5.4 6.4 11 6.4 11z" fill="#ff5f58" />
        <circle cx="12" cy="11" r="2.3" fill="#fff" />
      </svg>
    ),
    call: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.8" fill="#3f8dff" />
        <path
          d="M8 7h2.5l1.1 2.9-1.4 1.3a8.8 8.8 0 0 0 2.6 2.6l1.3-1.4 2.9 1.1V16c0 .8-.7 1.5-1.5 1.5a9.7 9.7 0 0 1-9-9A1.5 1.5 0 0 1 8 7z"
          fill="#fff"
        />
      </svg>
    ),
    more: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.8" fill="#eef2f7" />
        <circle cx="8" cy="12" r="1.5" fill="#5d6675" />
        <circle cx="12" cy="12" r="1.5" fill="#5d6675" />
        <circle cx="16" cy="12" r="1.5" fill="#5d6675" />
      </svg>
    ),
  };

  return <span className="composer-icon">{icons[name] || icons.more}</span>;
}

function PostComposerModal({ user, onClose, onPosted }) {
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [activePanel, setActivePanel] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [taggedPeople, setTaggedPeople] = useState([]);
  const [feeling, setFeeling] = useState("");
  const [checkInLocation, setCheckInLocation] = useState("");
  const [callsEnabled, setCallsEnabled] = useState(false);
  const [callNumber, setCallNumber] = useState("");
  const [moreOptions, setMoreOptions] = useState(
    MORE_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: false }), {})
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
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
    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }

    const nextUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [selectedFile]);

  const selectedMore = useMemo(
    () =>
      MORE_OPTIONS.filter((option) => moreOptions[option.id]).map(
        (option) => option.label
      ),
    [moreOptions]
  );

  const hasMetadata = Boolean(
    taggedPeople.length ||
    feeling ||
    checkInLocation.trim() ||
    selectedMore.length ||
    (callsEnabled && callNumber.trim())
  );

  const canSubmit = Boolean(text.trim() || selectedFile || hasMetadata);

  const addTag = () => {
    const cleaned = tagInput.trim().replace(/^@+/, "");
    if (!cleaned) {
      return;
    }

    setTaggedPeople((current) =>
      current.includes(cleaned) ? current : [...current, cleaned]
    );
    setTagInput("");
  };

  const removeTag = (person) => {
    setTaggedPeople((current) => current.filter((entry) => entry !== person));
  };

  const toggleMore = (id) => {
    setMoreOptions((current) => ({ ...current, [id]: !current[id] }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setError("");
    setActivePanel("");
  };

  const openAction = (panel) => {
    if (panel === "media") {
      fileRef.current?.click();
      return;
    }

    setActivePanel((current) => (current === panel ? "" : panel));
  };

  const submit = async () => {
    if (!canSubmit || loading) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const createdPost = await createPost({
        text: text.trim(),
        file: selectedFile,
        tags: taggedPeople,
        feeling,
        location: checkInLocation.trim(),
        callsEnabled,
        callNumber: callNumber.trim(),
        moreOptions: selectedMore,
      });
      onPosted(createdPost);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create post");
    } finally {
      setLoading(false);
    }
  };

  const activeBadges = [
    ...taggedPeople.map((person) => ({ key: `tag-${person}`, label: `@${person}` })),
    ...(feeling ? [{ key: "feeling", label: `Feeling ${feeling}` }] : []),
    ...(checkInLocation.trim()
      ? [{ key: "location", label: `Check-in ${checkInLocation.trim()}` }]
      : []),
    ...(callsEnabled && callNumber.trim()
      ? [{ key: "calls", label: `Call ${callNumber.trim()}` }]
      : []),
    ...selectedMore.map((label) => ({ key: `more-${label}`, label })),
  ];

  const renderActionPanel = () => {
    if (!activePanel) {
      return null;
    }

    if (activePanel === "tag") {
      return (
        <div className="composer-panel">
          <p>Tag people</p>
          <div className="composer-panel-row">
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addTag();
                }
              }}
              placeholder="Type a name and press Enter"
            />
            <button type="button" className="btn-secondary" onClick={addTag}>
              Add
            </button>
          </div>
          {taggedPeople.length > 0 && (
            <div className="composer-chip-row">
              {taggedPeople.map((person) => (
                <button
                  key={person}
                  type="button"
                  className="composer-chip removable"
                  onClick={() => removeTag(person)}
                >
                  @{person} x
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activePanel === "feeling") {
      return (
        <div className="composer-panel">
          <p>Feeling / Activity</p>
          <div className="composer-grid">
            {FEELING_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`composer-grid-item ${feeling === option ? "active" : ""}`}
                onClick={() => setFeeling((current) => (current === option ? "" : option))}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activePanel === "checkin") {
      return (
        <div className="composer-panel">
          <p>Check-In</p>
          <div className="composer-panel-row">
            <input
              value={checkInLocation}
              onChange={(event) => setCheckInLocation(event.target.value)}
              placeholder="Enter place or neighborhood"
            />
          </div>
        </div>
      );
    }

    if (activePanel === "calls") {
      return (
        <div className="composer-panel">
          <p>Get Calls</p>
          <label className="composer-toggle">
            <input
              type="checkbox"
              checked={callsEnabled}
              onChange={(event) => setCallsEnabled(event.target.checked)}
            />
            <span>Allow people to call you from this post</span>
          </label>
          {callsEnabled && (
            <div className="composer-panel-row">
              <input
                value={callNumber}
                onChange={(event) => setCallNumber(event.target.value)}
                placeholder="Enter phone number"
              />
            </div>
          )}
        </div>
      );
    }

    if (activePanel === "more") {
      return (
        <div className="composer-panel">
          <p>More options</p>
          <div className="composer-grid">
            {MORE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`composer-grid-item ${
                  moreOptions[option.id] ? "active" : ""
                }`}
                onClick={() => toggleMore(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="pc-overlay">
      <div
        className="pc-modal composer-modal"
        ref={boxRef}
        role="dialog"
        aria-modal="true"
      >
        <div className="pc-header composer-header">
          <h3>Create post</h3>
          <button className="pc-close" onClick={onClose} aria-label="Close">
            X
          </button>
        </div>

        <div className="pc-user">
          <img
            src={resolveImage(user?.avatar) || "/avatar.png"}
            className="pc-avatar"
            alt={user?.username || "You"}
          />
          <div className="pc-user-meta">
            <div className="pc-name">{user?.username}</div>
            <button className="pc-privacy" type="button">
              Public
            </button>
          </div>
        </div>

        <textarea
          className="pc-textarea composer-textarea"
          placeholder={`What's on your mind, ${user?.username || ""}?`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />

        {activeBadges.length > 0 && (
          <div className="composer-chip-row">
            {activeBadges.map((badge) => (
              <span key={badge.key} className="composer-chip">
                {badge.label}
              </span>
            ))}
          </div>
        )}

        {previewUrl && (
          <div className="composer-preview">
            {selectedFile?.type?.startsWith("video/") ? (
              <video src={previewUrl} controls />
            ) : (
              <img src={previewUrl} alt="Selected media preview" />
            )}
            <button
              type="button"
              className="composer-remove-media"
              onClick={() => setSelectedFile(null)}
            >
              Remove media
            </button>
          </div>
        )}

        {renderActionPanel()}

        {error && <p className="composer-error">{error}</p>}

        <div className="pc-divider" />

        <div className="pc-add composer-actions-wrap">
          <span>Add to your post</span>

          <div className="pc-actions composer-actions">
            <button
              type="button"
              className={selectedFile ? "active" : ""}
              onClick={() => openAction("media")}
              title="Photo/Video"
            >
              <ComposerIcon name="media" />
              <span>Photo/Video</span>
            </button>
            <button
              type="button"
              className={activePanel === "tag" || taggedPeople.length ? "active" : ""}
              onClick={() => openAction("tag")}
              title="Tag people"
            >
              <ComposerIcon name="tag" />
              <span>Tag people</span>
            </button>
            <button
              type="button"
              className={activePanel === "feeling" || feeling ? "active" : ""}
              onClick={() => openAction("feeling")}
              title="Feeling/Activity"
            >
              <ComposerIcon name="feeling" />
              <span>Feeling/Activity</span>
            </button>
            <button
              type="button"
              className={
                activePanel === "checkin" || checkInLocation.trim() ? "active" : ""
              }
              onClick={() => openAction("checkin")}
              title="Check-In"
            >
              <ComposerIcon name="location" />
              <span>Check-In</span>
            </button>
            <button
              type="button"
              className={activePanel === "calls" || callsEnabled ? "active" : ""}
              onClick={() => openAction("calls")}
              title="Get Calls"
            >
              <ComposerIcon name="call" />
              <span>Get Calls</span>
            </button>
            <button
              type="button"
              className={activePanel === "more" || selectedMore.length ? "active" : ""}
              onClick={() => openAction("more")}
              title="More"
            >
              <ComposerIcon name="more" />
              <span>More</span>
            </button>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*,video/*"
          onChange={handleFileChange}
        />

        <button
          className={`pc-submit ${canSubmit ? "active" : ""}`}
          disabled={!canSubmit || loading}
          onClick={submit}
        >
          {loading ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
}

export default function Home({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        const [me, feed] = await Promise.all([getProfile(), getFeed()]);

        if (!alive) {
          return;
        }

        setProfile(me);
        setPosts(Array.isArray(feed) ? feed : []);
      } catch {
        if (alive) {
          alert("Failed to load feed");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!location.state?.openMessenger) {
      return;
    }

    setChatOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const currentUser = profile || user;

  return (
    <>
      <Navbar
        user={currentUser}
        onLogout={logout}
        onOpenMessenger={() => setChatOpen(true)}
      />

      <div className="app-shell">
        <aside className="sidebar">
          <Sidebar
            user={currentUser}
            openChat={() => setChatOpen(true)}
            openProfile={() => navigate(`/profile/${currentUser?.username}`)}
          />
        </aside>

        <main className="feed">
          {!loading && <Stories />}

          <div className="card create-post" onClick={() => setComposerOpen(true)}>
            <div className="create-post-row">
              <img
                className="create-post-avatar"
                src={resolveImage(currentUser?.avatar) || "/avatar.png"}
                alt="me"
              />
              <input placeholder="What's on your mind?" readOnly />
            </div>
          </div>

          <div className="tengacion-feed">
            {loading ? (
              <>
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
              </>
            ) : posts.length === 0 ? (
              <div className="card empty-feed">
                <div className="empty-feed-icon">News</div>
                <h3>No posts yet</h3>
                <p>Be the first to share something with your friends.</p>
                <button
                  className="empty-feed-btn"
                  onClick={() => setComposerOpen(true)}
                >
                  Create a post
                </button>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  onDelete={(id) =>
                    setPosts((prev) => prev.filter((entry) => entry._id !== id))
                  }
                  onEdit={(updatedPost) =>
                    setPosts((prev) =>
                      prev.map((entry) =>
                        entry._id === updatedPost._id ? updatedPost : entry
                      )
                    )
                  }
                />
              ))
            )}
          </div>
        </main>

        <aside className="home-right-rail">
          <FriendRequests />
          {chatOpen && (
            <section className="messenger-panel">
              <Messenger user={currentUser} onClose={() => setChatOpen(false)} />
            </section>
          )}
        </aside>
      </div>

      {composerOpen && (
        <PostComposerModal
          user={currentUser}
          onClose={() => setComposerOpen(false)}
          onPosted={(post) => setPosts((prev) => [post, ...prev])}
        />
      )}
    </>
  );
}
