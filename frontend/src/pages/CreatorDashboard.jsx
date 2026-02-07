import { useState, useEffect } from "react";
import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import { getFeed } from "../api";

export default function CreatorDashboard({ user }) {
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalViews: 0,
    avgLikesPerPost: 0
  });
  const [topPosts, setTopPosts] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCreatorStats();
  }, []);

  const loadCreatorStats = async () => {
    try {
      setLoading(true);
      const data = await getFeed();
      const userPosts = Array.isArray(data) ? data.filter(p => p.isOwner) : [];

      // Calculate stats
      const totalLikes = userPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
      const totalComments = userPosts.reduce((sum, p) => sum + (p.comments?.length || 0), 0);
      const avgViews = 250; // Mock data

      setStats({
        totalPosts: userPosts.length,
        totalLikes,
        totalComments,
        totalViews: userPosts.length * avgViews,
        avgLikesPerPost: userPosts.length > 0 ? Math.round(totalLikes / userPosts.length) : 0
      });

      // Top posts
      const top = userPosts
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 5);
      setTopPosts(top);

      // Mock chart data
      setChartData([
        { day: "Mon", views: 240, likes: 24 },
        { day: "Tue", views: 300, likes: 35 },
        { day: "Wed", views: 200, likes: 20 },
        { day: "Thu", views: 400, likes: 45 },
        { day: "Fri", views: 350, likes: 38 },
        { day: "Sat", views: 280, likes: 32 },
        { day: "Sun", views: 290, likes: 28 }
      ]);
    } catch (err) {
      console.error("Failed to load creator stats:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar user={user} />
      <div className="app-shell">
        <aside className="sidebar">
          <Sidebar user={user} />
        </aside>

        <div className="creator-dashboard">
          {/* HEADER */}
          <div className="dashboard-header card">
            <h2>📊 Creator Dashboard</h2>
            <p>Track your content performance and grow your audience</p>
          </div>

          {/* STATS GRID */}
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-icon">📝</div>
              <div className="stat-text">
                <div className="stat-label">Total Posts</div>
                <div className="stat-number">{stats.totalPosts}</div>
              </div>
            </div>

            <div className="stat-box">
              <div className="stat-icon">👍</div>
              <div className="stat-text">
                <div className="stat-label">Total Likes</div>
                <div className="stat-number">{stats.totalLikes.toLocaleString()}</div>
              </div>
            </div>

            <div className="stat-box">
              <div className="stat-icon">💬</div>
              <div className="stat-text">
                <div className="stat-label">Total Comments</div>
                <div className="stat-number">{stats.totalComments}</div>
              </div>
            </div>

            <div className="stat-box">
              <div className="stat-icon">👁️</div>
              <div className="stat-text">
                <div className="stat-label">Total Views</div>
                <div className="stat-number">{stats.totalViews.toLocaleString()}</div>
              </div>
            </div>

            <div className="stat-box">
              <div className="stat-icon">⭐</div>
              <div className="stat-text">
                <div className="stat-label">Avg Per Post</div>
                <div className="stat-number">{stats.avgLikesPerPost}</div>
              </div>
            </div>

            <div className="stat-box">
              <div className="stat-icon">🔥</div>
              <div className="stat-text">
                <div className="stat-label">Engagement %</div>
                <div className="stat-number">8.4%</div>
              </div>
            </div>
          </div>

          {/* ENGAGEMENT CHART */}
          <div className="chart-card card">
            <h3>📈 Weekly Performance</h3>
            <div className="mini-chart">
              {chartData.map((data, idx) => (
                <div key={idx} className="chart-bar-wrapper">
                  <div className="chart-bar">
                    <div 
                      className="bar-segment likes"
                      style={{ height: data.likes * 2 + "px" }}
                    />
                    <div 
                      className="bar-segment views"
                      style={{ height: Math.max(10, data.views / 10) + "px" }}
                    />
                  </div>
                  <div className="chart-label">{data.day}</div>
                </div>
              ))}
            </div>
          </div>

          {/* TOP POSTS */}
          <div className="top-posts-section card">
            <h3>🏆 Your Top Posts</h3>
            {topPosts.length === 0 ? (
              <p style={{ color: "var(--muted)", textAlign: "center", padding: "20px" }}>
                No posts yet. Create your first post to see analytics!
              </p>
            ) : (
              <div className="top-posts-list">
                {topPosts.map((post, idx) => (
                  <div key={post._id} className="top-post-item">
                    <div className="rank">#{idx + 1}</div>
                    <div className="post-preview">
                      <p className="post-text">
                        {post.text?.substring(0, 80)}
                        {post.text?.length > 80 ? "..." : ""}
                      </p>
                      <div className="post-stats">
                        <span>👍 {post.likes || 0}</span>
                        <span>💬 {post.comments?.length || 0}</span>
                        <span>👁️ {Math.floor(Math.random() * 500) + 100}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CREATOR TOOLS */}
          <div className="creator-tools-section card">
            <h3>🛠️ Creator Tools</h3>
            <div className="tools-grid">
              <div className="tool-card">
                <div className="tool-icon">📅</div>
                <div className="tool-name">Content Calendar</div>
                <p>Plan and schedule your posts</p>
                <button className="btn-secondary">Open →</button>
              </div>

              <div className="tool-card">
                <div className="tool-icon">📊</div>
                <div className="tool-name">Analytics</div>
                <p>Deep dive into your metrics</p>
                <button className="btn-secondary">Open →</button>
              </div>

              <div className="tool-card">
                <div className="tool-icon">🎯</div>
                <div className="tool-name">Growth Insights</div>
                <p>Recommendations to grow faster</p>
                <button className="btn-secondary">Open →</button>
              </div>

              <div className="tool-card">
                <div className="tool-icon">💡</div>
                <div className="tool-name">Content Ideas</div>
                <p>AI-powered content suggestions</p>
                <button className="btn-secondary">Open →</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
