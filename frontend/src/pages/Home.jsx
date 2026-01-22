import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PostSkeleton from "../components/PostSkeleton";
import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import Messenger from "../Messenger";
import Stories from "../stories/Stories";
import PostCard from "../components/PostCard";

import { getProfile, getFeed } from "../api";

/* ======================================================
   POST COMPOSER (LOCAL TO HOME)
====================================================== */
function PostComposerModal({ user, onClose, onPosted }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const submit = async () => {
    if (!text.trim()) return;

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
        <h3>Create Post</h3>

        <textarea
          placeholder="What's on your mind?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <button onClick={submit} disabled={loading}>
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

  /* ===== LOAD PROFILE + FEED ===== */
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const p = await getProfile();
        const feed = await getFeed();

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

  /* ===== LOADING ===== */
 

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
  <Stories loading={loading} />


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
