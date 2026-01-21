import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLauncher from "./AppLauncher";
import { Icon } from "./Icon";

export default function Navbar({ user, page, setPage, onLogout }) {
  const navigate = useNavigate();

  const [showApps, setShowApps] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], posts: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const boxRef = useRef(null);
  const menuRef = useRef(null);

  /* ===== CLOSE DROPDOWNS ===== */
  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", (e) => e.key === "Escape" && close(e));

    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ===== SEARCH ===== */
  const performSearch = useCallback(async (q) => {
    if (!q.trim()) return setResults({ users: [], posts: [] });

    try {
      setLoading(true);
      const headers = { Authorization: "Bearer " + localStorage.getItem("token") };

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => performSearch(query), 260);
    return () => clearTimeout(t);
  }, [query, performSearch]);

  const avatarUrl =
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}`;

  return (
    <header className="navbar" role="navigation">
      {/* ===== LEFT ===== */}
      <div className="nav-left">
        <div className="logo-area" onClick={() => navigate("/")}>
          <img src="/tengacion_logo_64.png" className="nav-logo" alt="Tengacion" />
          <span className="brand-text">Tengacion</span>
        </div>

        {user && (
          <div className="search-box" ref={boxRef}>
            <Icon name="search" />
            <input
              className="nav-search"
              placeholder="Search Tengacion"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* ===== CENTER ===== */}
      {user && (
        <nav className="nav-center">
          {["home", "watch", "groups", "market", "games"].map((id) => (
            <button
              key={id}
              className={`nav-tab ${page === id ? "nav-active" : ""}`}
              onClick={() => setPage(id)}
            >
              <Icon name={id} active={page === id} />
            </button>
          ))}
        </nav>
      )}

      {/* ===== RIGHT (AUTH ONLY) ===== */}
      {user && (
        <div className="nav-right">
          <button className="nav-icon">
            <Icon name="message" />
          </button>

          <button className="nav-icon">
            <Icon name="bell" />
          </button>

          <div className="avatar-wrapper" ref={menuRef}>
            <img
              src={avatarUrl}
              className="nav-avatar"
              onClick={() => setShowMenu(!showMenu)}
              alt="profile"
            />

            {showMenu && (
              <div className="profile-menu">
                <div
                  className="pm-user"
                  onClick={() => navigate(`/profile/${user.username}`)}
                >
                  <img src={avatarUrl} alt="" />
                  <div>
                    <div className="pm-name">{user.name}</div>
                    <div className="pm-view">See your profile</div>
                  </div>
                </div>

                <div className="pm-divider" />

                <div className="pm-item logout" onClick={onLogout}>
                  🚪 Log out
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showApps && <AppLauncher />}
    </header>
  );
}
