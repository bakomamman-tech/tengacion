import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import PostSkeleton from "../components/PostSkeleton";
import PostCard from "../components/PostCard";

import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import Messenger from "../Messenger";
import Stories from "../stories/StoriesBar";

import { getProfile, getFeed } from "../api";

/* ======================================================
   POST COMPOSER (LOCAL TO HOME)
====================================================== */
function PostComposerModal({ user, onClose, onPosted }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  /* Close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  /* Close on ESC key */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!text.trim() || loading) return;

    try {
      setLoading(true);

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Post failed");

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
      <div className="pc-modal" ref={boxRef}>
        {/* HEADER */}
        <div className="pc-header">
          <h3>Create post</h3>
          <button className="pc-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* USER ROW */}
        <div className="pc-user">
          <img
            src={user?.avatar || "/avatar.png"}
            className="pc-avatar"
            alt={user?.username}
          />
          <div>
            <div className="pc-name">{user?.username}</div>
            <button className="pc-privacy">🌍 Public</button>
          </div>
        </div>

        {/* TEXTAREA */}
        <textarea
          className="pc-textarea"
          placeholder={`What's on your mind, ${user?.username || ""}?`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {/* ADD TO POST */}
        <div className="pc-add">
          <span>Add to your post</span>
          <div className="pc-actions">
            <button title="Photo/Video">🖼️</button>
            <button title="Tag people">👥</button>
            <button title="Feeling">😊</button>
            <button title="Location">📍</button>
            <button title="Music">🎵</button>
            <button title="More">⋯</button>
          </div>
        </div>

        {/* POST BUTTON */}
        <button
          className={`pc-submit ${text.trim() ? "active" : ""}`}
          disabled={!text.trim() || loading}
          onClick={submit}
        >
          {loading ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}

/* ======================================================
   HOME PAGE
====================================================== */
export default function Home({ user }) {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [chatOpen, setChatOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  /* ===== LOAD PROFILE + FEED (PARALLEL) ===== */
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const [p, feed] = await Promise.all([
          getProfile(),
          getFeed(),
        ]);

        if (!alive) return;

        setProfile(p);
        setPosts(Array.isArray(feed) ? feed : []);
      } catch {
        if (alive) alert("Failed to load feed");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => (alive = false);
  }, []);

  /* ===== LOGOUT ===== */
  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <>
      <Navbar user={profile || user} onLogout={logout} />

      <div className="app-shell">
        <aside className="sidebar">
          <Sidebar
            user={profile || user}
            openChat={() => setChatOpen(true)}
          />
        </aside>

        <main className="feed">
          {!loading && <Stories />}

          <div
            className="card create-post"
            onClick={() => setComposerOpen(true)}
          >
            <input placeholder="What's on your mind?" readOnly />
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
                No posts yet. Be the first to share!
              </div>
            ) : (
              posts.map((p) => (
                <PostCard key={p._id} post={p} />
              ))
            )}
          </div>
        </main>

        {chatOpen && (
          <section className="messenger">
            <Messenger
              user={profile || user}
              onClose={() => setChatOpen(false)}
            />
          </section>
        )}
      </div>

      {composerOpen && (
        <PostComposerModal
          user={profile || user}
          onClose={() => setComposerOpen(false)}
          onPosted={(post) =>
            setPosts((prev) => [post, ...prev])
          }
        />
      )}
    </>
  );
}
