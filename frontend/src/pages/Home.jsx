import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import PostSkeleton from "../components/PostSkeleton";
import PostCard from "../components/PostCard";

import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import Messenger from "../Messenger";
import Stories from "../stories/StoriesBar";

import { getFeed, getProfile, resolveImage } from "../api";

function PostComposerModal({ user, onClose, onPosted }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

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
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!text.trim() || loading) return;

    try {
      setLoading(true);

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to create post");
      }

      onPosted(data);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pc-overlay">
      <div className="pc-modal" ref={boxRef} role="dialog" aria-modal="true">
        <div className="pc-header">
          <h3>Create post</h3>
          <button className="pc-close" onClick={onClose} aria-label="Close">
            x
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
          className="pc-textarea"
          placeholder={`What's on your mind, ${user?.username || ""}?`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />

        <div className="pc-divider" />

        <div className="pc-add">
          <span>Add to your post</span>

          <div className="pc-actions">
            <button type="button" title="Photo or Video">
              Media
            </button>
            <button type="button" title="Tag People">
              Tag
            </button>
            <button type="button" title="Location">
              Place
            </button>
            <button type="button" title="More">
              More
            </button>
          </div>
        </div>

        <button
          className={`pc-submit ${text.trim() ? "active" : ""}`}
          disabled={!text.trim() || loading}
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

        if (!alive) return;

        setProfile(me);
        setPosts(Array.isArray(feed) ? feed : []);
      } catch {
        if (alive) alert("Failed to load feed");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const currentUser = profile || user;

  return (
    <>
      <Navbar user={currentUser} onLogout={logout} />

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

        {chatOpen && (
          <section className="messenger-panel">
            <Messenger user={currentUser} onClose={() => setChatOpen(false)} />
          </section>
        )}
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
