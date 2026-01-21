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

  /* ===== CLOSE DROPDOWNS ===== */
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
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setShowMenu(false);
      }
    });

    return () => {
      document.removeEventListener("mousedown", close);
    };
  }, []);

  /* ===== SEARCH LOGIC ===== */
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
    } catch {
      setResults({ users: [], posts: [] });
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
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user?.name || "User"
    )}&size=64`;

  return (
    <header className="navbar" role="navigation">
      {/* ===== LEFT SECTION ===== */}
      <div className="nav-left">
        <div
          className="logo-area"
          onClick={() => navigate("/")}
          role="button"
        >
          <img
            src="/tengacion_logo_64.png"
            className="nav-logo"
            alt="Tengacion"
          />
          <span className="brand-text">Tengacion</span>
        </div>

        {user && (
          <div className="search-box" ref={boxRef}>
            <Icon name="search" className="search-icon" />

            <input
              className="nav-search"
              placeholder="Search Tengacion"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {open && (
              <div className="search-dropdown">
                {loading && (
                  <div className="sd-loading">
                    Searching...
                  </div>
                )}

                {!loading &&
                  results.users.map((u) => (
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
                          `https://ui-avatars.com/api/?name=${u.name}`
                        }
                        className="sd-avatar"
                      />
                      <span>{u.name}</span>
                    </div>
                  ))}

                {!loading &&
                  results.posts.map((p) => (
                    <div
                      key={p._id}
                      className="sd-item"
                      onClick={() => {
                        navigate(`/post/${p._id}`);
                        setOpen(false);
                      }}
                    >
                      <Icon name="post" />
                      <span>
                        {p.text?.slice(0, 40) || "View post"}
                      </span>
                    </div>
                  ))}

                {!loading &&
                  !results.users.length &&
                  !results.posts.length && (
                    <div className="sd-empty">
                      No results found
                    </div>
                  )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== CENTER NAV ===== */}
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
              className={
                "nav-tab " + (page === id ? "nav-active" : "")
              }
              onClick={() => setPage(id)}
              title={label}
            >
              <Icon name={id} active={page === id} />
            </button>
          ))}
        </nav>
      )}

      {/* ===== RIGHT SECTION ===== */}
      <div className="nav-right">
        {!user && (
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
        )}

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
                    className="pm-item"
                    onClick={() => navigate("/settings")}
                  >
                    ⚙ Settings
                  </div>

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
