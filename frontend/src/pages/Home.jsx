import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import Messenger from "../Messenger";
import Stories from "../stories/StoriesBar";

import PostSkeleton from "../components/PostSkeleton";
import PostCard from "../components/PostCard";
import PostModal from "../components/PostModal";

import { getProfile, getFeed } from "../api";

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

  // composer state (moved here, clean architecture)
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

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

  /* ===== SUBMIT POST ===== */
  const submitPost = async () => {
    if (!text.trim()) return;

    try {
      setPosting(true);

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

      setPosts((prev) => [data, ...prev]);
      setText("");
      setComposerOpen(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setPosting(false);
    }
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
          <Stories loading={loading} />

          {/* CREATE POST CARD */}
          <div
            className="card create-post"
            onClick={() => setComposerOpen(true)}
          >
            <input placeholder="What's on your mind?" readOnly />
          </div>

          {/* FEED */}
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

        {/* MESSENGER */}
        {chatOpen && (
          <section className="messenger">
            <Messenger
              user={profile || user}
              onClose={() => setChatOpen(false)}
            />
          </section>
        )}
      </div>

      {/* POST MODAL */}
      {composerOpen && (
        <PostModal
          user={profile || user}
          text={text}
          setText={setText}
          loading={posting}
          onClose={() => setComposerOpen(false)}
          submit={submitPost}
        />
      )}
    </>
  );
}
