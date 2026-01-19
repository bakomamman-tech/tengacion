import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Messenger from "./Messenger";
import StoriesBar from "./stories/StoriesBar";
import Search from "./pages/Search";

import { getProfile, getFeed } from "./api";

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);

  const [booting, setBooting] = useState(true);
  const [page, setPage] = useState("home");

  const [chatOpen, setChatOpen] = useState(false);
  const [error, setError] = useState(null);

  /* ======================================================
     AUTH RESTORE – FACEBOOK STYLE
  ====================================================== */

  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setBooting(false);
        return;
      }

      try {
        const res = await fetch("/api/users/me", {
          headers: {
            Authorization: "Bearer " + token,
          },
        });

        const me = await res.json();

        if (me?.error) throw new Error(me.error);

        setUser(me);
        setProfile(me);

        // expose for debugging
        window.__PROFILE__ = me;

      } catch (err) {
        console.warn("Session expired");
        localStorage.clear();
        setError("Session expired, please login again");
      } finally {
        setBooting(false);
      }
    };

    restore();
  }, []);

  /* ======================================================
     LOAD FEED + PROFILE
  ====================================================== */

  const loadAll = async () => {
    try {
      const p = await getProfile();
      setProfile(p);

      const feed = await getFeed();
      setPosts(Array.isArray(feed) ? feed : []);

      window.__POSTS__ = feed;
    } catch (e) {
      console.error("Feed error:", e);
      setError("Could not load feed");
    }
  };

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  /* ======================================================
     UI STATES
  ====================================================== */

  if (booting) {
    return (
      <div className="card" style={{ margin: 40 }}>
        <h3>🚀 Booting Tengacion...</h3>
        <p>Connecting to your world</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar user={null} />

        <div className="card" style={{ margin: 40 }}>
          <h3>Welcome to Tengacion</h3>

          {error && (
            <div style={{ color: "crimson", marginBottom: 10 }}>
              {error}
            </div>
          )}

          <p>Please login to continue</p>
        </div>
      </>
    );
  }

  /* ======================================================
     MAIN APP SHELL
  ====================================================== */

  return (
    <>
      <Navbar
        user={profile}
        page={page}
        setPage={setPage}
        onLogout={() => {
          localStorage.clear();
          setUser(null);
        }}
      />

      <Routes>
        <Route
          path="/"
          element={
            <div className="app-shell">

              {/* LEFT – FACEBOOK SIDEBAR */}
              <aside className="sidebar">
                <Sidebar
                  user={profile}
                  openChat={() => setChatOpen(true)}
                />
              </aside>

              {/* CENTER – FEED */}
              <main className="main-feed">

                <StoriesBar />

                {/* CREATE POST CARD (UI ONLY FOR NOW) */}
                <div className="card" style={{ marginBottom: 12 }}>
                  <input
                    placeholder="What's on your mind?"
                    readOnly
                    style={{ width: "100%" }}
                  />
                </div>

                {/* FEED */}
                <div className="tengacion-feed">
                  <div className="feed-posts">

                    {posts.length === 0 && (
                      <div className="card">
                        No posts yet. Be the first to share something!
                      </div>
                    )}

                    {posts.map((p) => (
                      <div key={p._id} className="card">
                        <b>@{p.username}</b>
                        <p>{p.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </main>

              {/* RIGHT – MESSENGER */}
              <section className="messenger">
                {chatOpen && (
                  <Messenger
                    user={profile}
                    onClose={() => setChatOpen(false)}
                  />
                )}
              </section>

            </div>
          }
        />

        <Route path="/search" element={<Search />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}
