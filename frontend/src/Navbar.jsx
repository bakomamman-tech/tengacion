import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLauncher from "./AppLauncher";

export default function Navbar({ user, page, setPage, onLogout }) {
  const navigate = useNavigate();

  const [showApps, setShowApps] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // ===== SEARCH STATE =====
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], posts: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const boxRef = useRef(null);
  const menuRef = useRef(null);

  /* ===== Close dropdowns on outside click ===== */
  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }

      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ===== SEARCH ===== */
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

      const u = await uRes.json();
      const p = await pRes.json();

      setResults({
        users: Array.isArray(u) ? u.slice(0, 5) : [],
        posts: Array.isArray(p) ? p.slice(0, 5) : [],
      });

      setOpen(true);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => performSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, performSearch]);

  const goFullSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
  };

  const avatarUrl =
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user?.name || "User"
    )}&size=64&background=0D8ABC&color=fff`;

  return (
    <header className="navbar">
      {/* ===== LEFT ===== */}
      <div className="nav-left" ref={boxRef}>
        <img
          src="/tengacion_logo_64.png"
          className="nav-logo"
          alt="Tengacion"
          onClick={() => navigate("/")}
        />

        <form onSubmit={goFullSearch} className="nav-search-box">
          <input
            className="nav-search"
            placeholder="Search Tengacion"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query && setOpen(true)}
          />

          {open && (
            <div className="search-dropdown">
              {loading && (
                <div className="sd-loading">Searching...</div>
              )}

              {results.users.map((u) => (
                <div
                  key={u._id}
                  className="sd-item"
                  onClick={() => {
                    navigate(`/profile/${u.username}`);
                    setOpen(false);
                  }}
                >
                  <img
                    src={
                      u.avatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        u.name
                      )}`
                    }
                    alt="avatar"
                  />
                  <span>
                    {u.name}
                    <small>@{u.username}</small>
                  </span>
                </div>
              ))}

              {results.posts.map((p) => (
                <div
                  key={p._id}
                  className="sd-item"
                  onClick={() => {
                    navigate(`/post/${p._id}`);
                    setOpen(false);
                  }}
                >
                  <span>{p.text?.slice(0, 60)}…</span>
                </div>
              ))}

              {!loading &&
                results.users.length === 0 &&
                results.posts.length === 0 && (
                  <div className="sd-empty">No results found</div>
                )}

              <div className="sd-footer" onClick={goFullSearch}>
                See all results →
              </div>
            </div>
          )}
        </form>
      </div>

      {/* ===== CENTER ===== */}
      <nav className="nav-center">
        {[
          ["home", "🏠"],
          ["watch", "🎥"],
          ["groups", "👥"],
          ["market", "🛒"],
          ["games", "🎮"],
        ].map(([id, icon]) => (
          <button
            key={id}
            className={page === id ? "nav-active" : ""}
            onClick={() => setPage(id)}
          >
            {icon}
          </button>
        ))}
      </nav>

      {/* ===== RIGHT ===== */}
      <div className="nav-right">
        <button
          className="nav-icon"
          onClick={() => setShowApps(!showApps)}
        >
          ⬛
        </button>

        <button className="nav-icon">💬</button>
        <button className="nav-icon">🔔</button>

        {/* ===== PROFILE MENU (FACEBOOK STYLE) ===== */}
        <div className="profile-area" ref={menuRef}>
          <img
            src={avatarUrl}
            className="nav-avatar"
            alt="avatar"
            onClick={() => setShowMenu(!showMenu)}
          />

          {showMenu && (
            <div className="profile-menu">
              <div
                className="pm-user"
                onClick={() =>
                  navigate(`/profile/${user?.username}`)
                }
              >
                <img src={avatarUrl} alt="me" />
                <div>
                  <div className="pm-name">
                    {user?.name}
                  </div>
                  <div className="pm-view">
                    See your profile
                  </div>
                </div>
              </div>

              <div className="pm-divider" />

              <div
                className="pm-item"
                onClick={() =>
                  navigate(`/profile/${user?.username}`)
                }
              >
                👤 Profile
              </div>

              <div
                className="pm-item"
                onClick={() => navigate("/settings")}
              >
                ⚙ Settings
              </div>

              <div className="pm-divider" />

              {/* ✅ BEAUTIFUL LOGOUT */}
              <div className="pm-item logout" onClick={onLogout}>
                🚪 Log out
              </div>
            </div>
          )}
        </div>
      </div>

      {showApps && <AppLauncher />}
    </header>
  );
}
