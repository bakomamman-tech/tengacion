import { useEffect, useState, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Messenger from "./Messenger";
import StoriesBar from "./stories/StoriesBar";
import Search from "./pages/Search";

import { getProfile, getFeed } from "./api";
import { useAuth } from "./context/AuthContext";

/* ======================================================
   GUEST LANDING — CLEAN, SINGLE SOURCE
====================================================== */
function GuestLanding({ error }) {
  const navigate = useNavigate();

  return (
    <div className="guest-landing">
      <div className="guest-hero">
        <h1 className="guest-logo">Tengacion</h1>

        <p className="guest-tag">
          Connect with friends and the world around you.
        </p>

        {error && <div className="guest-error">{error}</div>}

        <div className="guest-actions">
          <button
            className="fb-login-btn"
            onClick={() => navigate("/login")}
          >
            Log In
          </button>

          <button
            className="fb-signup-btn"
            onClick={() => navigate("/register")}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   POST COMPOSER — SELF CONTAINED & SAFE
====================================================== */
function PostComposerModal({ user, onClose, onPosted }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const boxRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () =>
      document.removeEventListener("mousedown", handleOutside);
  }, [onClose]);

  const pickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (!text.trim() && !image) return;

    try {
      setLoading(true);

      const form = new FormData();
      form.append("text", text);
      if (image) form.append("image", image);

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: form,
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

  const avatar =
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user?.name || "User"
    )}`;

  return (
    <div className="pc-overlay">
      <div className="pc-modal" ref={boxRef}>
        <header className="pc-header">
          <h3>Create Post</h3>
          <button className="pc-close" onClick={onClose}>✕</button>
        </header>

        <div className="pc-user">
          <img src={avatar} alt="" />
          <b>{user?.name}</b>
        </div>

        <textarea
          className="pc-input"
          placeholder="What's on your mind?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {preview && (
          <div className="pc-preview">
            <img src={preview} alt="" />
            <span onClick={() => setPreview(null)}>Remove</span>
          </div>
        )}

        <div className="pc-actions">
          <label className="pc-add">
            📷 Photo
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={pickImage}
            />
          </label>

          <button
            className="pc-post"
            disabled={loading}
            onClick={submit}
          >
            {loading ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   APP ROOT — PRODUCTION GRADE
====================================================== */
export default function App() {
  const { user, loading, logout } = useAuth();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);

  const [page, setPage] = useState("home");
  const [chatOpen, setChatOpen] = useState(false);
  const [composer, setComposer] = useState(false);
  const [error, setError] = useState(null);

  /* ===== LOAD PROFILE + FEED ===== */
  useEffect(() => {
    if (!user) return;

    let alive = true;

    const load = async () => {
      try {
        const p = await getProfile();
        const feed = await getFeed();

        if (!alive) return;

        setProfile(p);
        setPosts(Array.isArray(feed) ? feed : []);
      } catch {
        if (alive) setError("Could not load feed");
      }
    };

    load();
    return () => (alive = false);
  }, [user]);

  /* ===== BOOT SCREEN ===== */
  if (loading) {
    return (
      <div className="boot-screen">
        <div className="boot-card">
          <h3>🚀 Booting Tengacion…</h3>
        </div>
      </div>
    );
  }

  /* ===== GUEST MODE ===== */
  if (!user) {
    return (
      <>
        <Navbar user={null} />
        <GuestLanding error={error} />
      </>
    );
  }

  /* ===== AUTHENTICATED APP ===== */
  return (
    <>
      <Navbar
        user={profile || user}
        page={page}
        setPage={setPage}
        onLogout={logout}
      />

      <Routes>
        <Route
          path="/"
          element={
            <div className="app-shell">
              <aside className="sidebar">
                <Sidebar
                  user={profile || user}
                  openChat={() => setChatOpen(true)}
                />
              </aside>

              <main className="main-feed">
                <StoriesBar />

                <div
                  className="card create-post"
                  onClick={() => setComposer(true)}
                >
                  <input
                    placeholder="What's on your mind?"
                    readOnly
                  />
                </div>

                <div className="tengacion-feed">
                  {posts.length === 0 ? (
                    <div className="card empty-feed">
                      No posts yet. Be the first to share something!
                    </div>
                  ) : (
                    posts.map((p) => (
                      <article key={p._id} className="card post">
                        <header className="post-header">
                          <b>@{p.username}</b>
                        </header>
                        <p className="post-body">{p.text}</p>
                      </article>
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
          }
        />

        <Route path="/search" element={<Search />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      {composer && (
        <PostComposerModal
          user={profile || user}
          onClose={() => setComposer(false)}
          onPosted={(newPost) =>
            setPosts((prev) => [newPost, ...prev])
          }
        />
      )}
    </>
  );
}
