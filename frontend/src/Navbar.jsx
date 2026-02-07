import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import { useTheme } from "./context/ThemeContext";

export default function Navbar({ user, page, setPage, onLogout }) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const [showMenu, setShowMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], posts: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchRef = useRef(null);
  const menuRef = useRef(null);

  /* ================= CLOSE POPUPS ================= */
  useEffect(() => {
    const close = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", (e) => e.key === "Escape" && close(e));

    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ================= SEARCH ================= */
  const performSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setResults({ users: [], posts: [] });
      return;
    }

    try {
      setLoading(true);

      const headers = {
        Authorization: "Bearer " + localStorage.getItem("token"),
      };

      const [uRes, pRes] = await Promise.all([
        fetch(`/api/users?search=${encodeURIComponent(q)}`, { headers }),
        fetch(`/api/posts?search=${encodeURIComponent(q)}`, { headers }),
      ]);

      const users = await uRes.json();
      const posts = await pRes.json();

      setResults({
        users: Array.isArray(users) ? users.slice(0, 5) : [],
        posts: Array.isArray(posts) ? posts.slice(0, 5) : [],
      });

      setSearchOpen(true);
    } catch {
      setResults({ users: [], posts: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => performSearch(query), 300);
    return () => clearTimeout(delay);
  }, [query, performSearch]);

  const avatar =
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user?.name || "User"
    )}`;

  return (
    <header className="navbar" role="navigation">
      {/* ================= LEFT ================= */}
      <div className="nav-left">
        <button
          className="logo-area"
          onClick={() => navigate("/")}
          aria-label="Go home"
        >
          <img
            src="/tengacion_logo_64.png"
            className="nav-logo"
            alt="Tengacion"
          />
          <span className="brand-text">Tengacion</span>
        </button>

        {user && (
          <div className="search-box" ref={searchRef}>
            <Icon name="search" />
            <input
              className="nav-search"
              placeholder="Search Tengacion"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search"
            />

            {searchOpen && (
              <div className="search-dropdown">
                {loading && <div className="sd-loading">Searching…</div>}

                {!loading &&
                  results.users.map((u) => (
                    <button
                      key={u._id}
                      className="sd-item"
                      onClick={() => {
                        navigate(`/profile/${u.username}`);
                        setSearchOpen(false);
                      }}
                    >
                      <img
                        src={
                          u.avatar ||
                          `https://ui-avatars.com/api/?name=${u.name}`
                        }
                        className="sd-avatar"
                        alt=""
                      />
                      <span>{u.name}</span>
                    </button>
                  ))}

                {!loading &&
                  results.posts.map((p) => (
                    <button
                      key={p._id}
                      className="sd-item"
                      onClick={() => {
                        navigate(`/post/${p._id}`);
                        setSearchOpen(false);
                      }}
                    >
                      <Icon name="post" />
                      <span>{p.text?.slice(0, 40) || "View post"}</span>
                    </button>
                  ))}

                {!loading &&
                  !results.users.length &&
                  !results.posts.length && (
                    <div className="sd-empty">No results found</div>
                  )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= CENTER ================= */}
      {user && (
        <nav className="nav-center" aria-label="Main navigation">
          <button
            className="nav-tab"
            onClick={() => navigate("/home")}
            title="Feed"
          >
            🏠 Home
          </button>
          <button
            className="nav-tab"
            onClick={() => navigate("/trending")}
            title="Trending"
          >
            🔥 Trending
          </button>
          <button
            className="nav-tab"
            onClick={() => navigate("/creator")}
            title="Creator Dashboard"
          >
            📊 Creator
          </button>
        </nav>
      )}

      {/* ================= RIGHT ================= */}
      {user && (
        <div className="nav-right">
          <button 
            className="nav-icon" 
            onClick={() => navigate("/notifications")}
            aria-label="Notifications"
            title="Notifications"
          >
            🔔
          </button>

          <button
            className="nav-icon"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            title={isDark ? "Light mode" : "Dark mode"}
          >
            {isDark ? "☀️" : "🌙"}
          </button>

          <div className="avatar-wrapper" ref={menuRef}>
            <button
              className="avatar-btn"
              onClick={() => setShowMenu((v) => !v)}
              aria-label="Account menu"
            >
              <img src={avatar} className="nav-avatar" alt="" />
            </button>

            {showMenu && (
              <div className="profile-menu">
                <button
                  className="pm-user"
                  onClick={() => navigate(`/profile/${user.username}`)}
                >
                  <img src={avatar} alt="" />
                  <div>
                    <div className="pm-name">{user.name}</div>
                    <div className="pm-view">See your profile</div>
                  </div>
                </button>

                <div className="pm-divider" />

                <button className="pm-item logout" onClick={onLogout}>
                  🚪 Log out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
