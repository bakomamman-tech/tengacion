import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLauncher from "./AppLauncher";
import { Icon } from "./Icon";

export default function Navbar({ user, page, setPage, onLogout }) {
  const navigate = useNavigate();

  const [showApps, setShowApps] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // SEARCH STATE
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], posts: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const boxRef = useRef(null);
  const menuRef = useRef(null);

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

  const performSearch = useCallback(async (q) => {
    if (!q.trim()) return;

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => performSearch(query), 280);
    return () => clearTimeout(t);
  }, [query, performSearch]);

  const avatarUrl =
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user?.name || "User"
    )}&size=64`;

  return (
    <header className="navbar">
      {/* ===== LEFT ===== */}
      <div className="nav-left">
        <img
          src="/tengacion_logo_64.png"
          className="nav-logo"
          alt="Tengacion"
          onClick={() => navigate("/")}
        />

        {/* SEARCH ONLY WHEN LOGGED IN */}
        {user && (
          <input
            className="nav-search"
            placeholder="Search Tengacion"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>

      {/* ===== CENTER ===== */}
      {user && (
        <nav className="nav-center">
          {[
            ["home", "Home"],
            ["watch", "Watch"],
            ["groups", "Groups"],
            ["market", "Marketplace"],
            ["games", "Games"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={page === id ? "nav-active" : ""}
              onClick={() => setPage(id)}
            >
              <Icon name={id} active={page === id} />
            </button>
          ))}
        </nav>
      )}

      {/* ===== RIGHT ===== */}
      <div className="nav-right">

        {/* 🔐 GUEST MODE */}
        {!user && (
          <>
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
          </>
        )}

        {/* 🔓 AUTH MODE */}
        {user && (
          <>
            <button className="nav-icon">
              <Icon name="message" />
              <span className="badge">2</span>
            </button>

            <button className="nav-icon">
              <Icon name="bell" />
              <span className="badge">5</span>
            </button>

            <div ref={menuRef}>
              <img
                src={avatarUrl}
                className="nav-avatar"
                onClick={() => setShowMenu(!showMenu)}
              />

              {showMenu && (
                <div className="profile-menu">
                  <div
                    className="pm-user"
                    onClick={() =>
                      navigate(`/profile/${user.username}`)
                    }
                  >
                    <img src={avatarUrl} />
                    <div>
                      <div className="pm-name">
                        {user.name}
                      </div>
                      <div className="pm-view">
                        See your profile
                      </div>
                    </div>
                  </div>

                  <div className="pm-divider" />

                  <div
                    className="pm-item logout"
                    onClick={onLogout}
                  >
                    🚪 Log out
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showApps && <AppLauncher />}
    </header>
  );
}
