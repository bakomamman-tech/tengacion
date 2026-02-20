import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveImage } from "./api";
import { useTheme } from "./context/ThemeContext";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=DFE8F6&color=1D3A6D`;

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const [showMenu, setShowMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], posts: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") close(event);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const performSearch = useCallback(async (value) => {
    if (!value.trim()) {
      setResults({ users: [], posts: [] });
      setSearchOpen(false);
      return;
    }

    try {
      setLoading(true);

      const headers = {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      };

      const [usersResponse, postsResponse] = await Promise.all([
        fetch(`/api/users?search=${encodeURIComponent(value)}`, { headers }),
        fetch(`/api/posts?search=${encodeURIComponent(value)}`, { headers }),
      ]);

      const users = await usersResponse.json();
      const posts = await postsResponse.json();

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
    const timeout = setTimeout(() => performSearch(query), 250);
    return () => clearTimeout(timeout);
  }, [query, performSearch]);

  const avatar = resolveImage(user?.avatar) || fallbackAvatar(user?.name);

  return (
    <header className="navbar" role="navigation">
      <div className="nav-left">
        <button
          className="logo-area"
          onClick={() => navigate("/home")}
          aria-label="Go home"
        >
          <img src="/tengacion_logo_64.png" className="nav-logo" alt="Tengacion" />
          <span className="brand-text">Tengacion</span>
        </button>

        {user && (
          <div className="search-box" ref={searchRef}>
            <input
              className="nav-search"
              placeholder="Search Tengacion"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search"
            />

            {searchOpen && (
              <div className="search-dropdown">
                {loading && <div className="sd-loading">Searching...</div>}

                {!loading &&
                  results.users.map((entry) => (
                    <button
                      key={entry._id}
                      className="sd-item"
                      onClick={() => {
                        navigate(`/profile/${entry.username}`);
                        setSearchOpen(false);
                      }}
                    >
                      <img
                        src={resolveImage(entry.avatar) || fallbackAvatar(entry.name)}
                        className="sd-avatar"
                        alt=""
                      />
                      <span>{entry.name}</span>
                    </button>
                  ))}

                {!loading &&
                  results.posts.map((entry) => (
                    <button
                      key={entry._id}
                      className="sd-item"
                      onClick={() => {
                        navigate(`/home`);
                        setSearchOpen(false);
                      }}
                    >
                      <span>{entry.text?.slice(0, 50) || "View post"}</span>
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

      {user && (
        <nav className="nav-center" aria-label="Main navigation">
          <button className="nav-tab" onClick={() => navigate("/home")}>
            Home
          </button>
          <button className="nav-tab" onClick={() => navigate("/trending")}>
            Trending
          </button>
          <button className="nav-tab" onClick={() => navigate("/creator")}>
            Creator
          </button>
        </nav>
      )}

      {user && (
        <div className="nav-right">
          <button
            className="nav-icon"
            onClick={() => navigate("/notifications")}
            aria-label="Notifications"
            title="Notifications"
          >
            Alerts
          </button>

          <button
            className="nav-icon"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            title={isDark ? "Light mode" : "Dark mode"}
          >
            {isDark ? "Light" : "Dark"}
          </button>

          <div className="avatar-wrapper" ref={menuRef}>
            <button
              className="avatar-btn"
              onClick={() => setShowMenu((open) => !open)}
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
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
