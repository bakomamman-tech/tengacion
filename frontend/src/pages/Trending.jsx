import { useCallback, useEffect, useState } from "react";
import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import PostCard from "../components/PostCard";
import { getFeed } from "../api";

export default function Trending({ user }) {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("hot"); // hot, new, top, following
  const [category, setCategory] = useState("all"); // all, tech, design, business, etc
  const [loading, setLoading] = useState(true);

  const loadTrendingPosts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFeed();
      
      // Sort based on filter
      let sorted = [...(Array.isArray(data) ? data : [])];
      if (filter === "hot") {
        sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
      } else if (filter === "new") {
        sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else if (filter === "top") {
        sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        sorted = sorted.slice(0, 10);
      }
      
      setPosts(sorted);
    } catch (err) {
      console.error("Failed to load trending posts:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTrendingPosts();
  }, [category, loadTrendingPosts]);

  const categories = [
    { id: "all", label: "🌍 All", icon: "🌍" },
    { id: "tech", label: "💻 Technology", icon: "💻" },
    { id: "design", label: "🎨 Design", icon: "🎨" },
    { id: "business", label: "💼 Business", icon: "💼" },
    { id: "creative", label: "✨ Creative", icon: "✨" },
    { id: "entertainment", label: "🎬 Entertainment", icon: "🎬" },
    { id: "news", label: "📰 News", icon: "📰" }
  ];

  return (
    <>
      <Navbar user={user} />
      <div className="app-shell">
        <aside className="sidebar">
          <Sidebar user={user} />
        </aside>

        <main className="feed">
          {/* TRENDING HEADER */}
          <div className="trending-header card">
            <div className="trending-title-section">
              <h2>🔥 Trending Now</h2>
              <p>Discover what's hot in your community</p>
            </div>

            {/* FILTER TABS */}
            <div className="trending-filters">
              {["hot", "new", "top", "following"].map((f) => (
                <button
                  key={f}
                  className={`filter-tab ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "hot" && "🔥 Hot"}
                  {f === "new" && "✨ New"}
                  {f === "top" && "⭐ Top"}
                  {f === "following" && "👥 Following"}
                </button>
              ))}
            </div>
          </div>

          {/* CATEGORY SELECTOR */}
          <div className="category-selector card">
            <div className="category-label">Categories:</div>
            <div className="category-pills">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`category-pill ${category === cat.id ? "active" : ""}`}
                  onClick={() => setCategory(cat.id)}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* TRENDING STATS */}
          <div className="trending-stats">
            <div className="stat-card">
              <div className="stat-icon">📈</div>
              <div className="stat-content">
                <div className="stat-label">Growing</div>
                <div className="stat-value">+2.4K</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💬</div>
              <div className="stat-content">
                <div className="stat-label">Engaged</div>
                <div className="stat-value">8.9M</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🎯</div>
              <div className="stat-content">
                <div className="stat-label">Reach</div>
                <div className="stat-value">45M</div>
              </div>
            </div>
          </div>

          {/* POSTS */}
          <div className="trending-feed">
            {loading ? (
              <div className="card" style={{ textAlign: "center", padding: "40px" }}>
                <div className="spinner" style={{ margin: "0 auto 12px" }} />{" "}
                Loading trending posts...
              </div>
            ) : posts.length === 0 ? (
              <div className="card empty-feed">
                <div className="empty-feed-icon">📭</div>
                <h3>No trending posts yet</h3>
                <p>Be the first to create something amazing!</p>
              </div>
            ) : (
              posts.map((p) => (
                <PostCard
                  key={p._id}
                  post={p}
                  onShareCreated={(sharedPost) =>
                    setPosts((prev) => [
                      sharedPost,
                      ...prev.filter((entry) => entry._id !== sharedPost?._id),
                    ])
                  }
                  onDelete={(id) =>
                    setPosts((prev) => prev.filter((x) => x._id !== id))
                  }
                  onEdit={(updated) =>
                    setPosts((prev) =>
                      prev.map((x) => (x._id === updated._id ? updated : x))
                    )
                  }
                />
              ))
            )}
          </div>
        </main>
      </div>
    </>
  );
}
