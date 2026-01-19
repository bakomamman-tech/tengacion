import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppLauncher from "./AppLauncher";

export default function Navbar({ user, page, setPage, onLogout }) {

  const [showApps, setShowApps] = useState(false);

  // SEARCH
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], posts: [] });
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const navigate = useNavigate();

  /* ===== Close dropdown on outside click ===== */
  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ===== Live search ===== */
  useEffect(() => {
    if (!query.trim()) {
      setResults({ users: [], posts: [] });
      return;
    }

    const t = setTimeout(() => {
      Promise.all([
        fetch(`/api/users?search=${encodeURIComponent(query)}`, {
          headers: { Authorization: "Bearer " + localStorage.getItem("token") }
        }).then((r) => r.json()),

        fetch(`/api/posts?search=${encodeURIComponent(query)}`, {
          headers: { Authorization: "Bearer " + localStorage.getItem("token") }
        }).then((r) => r.json())
      ]).then(([u, p]) => {
        setResults({
          users: Array.isArray(u) ? u.slice(0, 5) : [],
          posts: Array.isArray(p) ? p.slice(0, 5) : []
        });
        setOpen(true);
      });
    }, 280);

    return () => clearTimeout(t);
  }, [query]);

  const goFullSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
  };

  return (
    <div className="navbar">

      {/* ===== LEFT ===== */}
      <div className="nav-left" ref={boxRef}>

        {/* LOGO – FIXED SIZE SO IT CAN NEVER EXPLODE */}
        <img
          src="/tengacion_logo_64.png"
          className="nav-logo"
          alt="Tengacion"
          style={{
            width: 38,
            height: 38,
            minWidth: 38,
            maxWidth: 38,
            objectFit: "contain"
          }}
          onClick={() => navigate("/")}
        />

        <form onSubmit={goFullSearch} style={{ position: "relative" }}>
          <input
            className="nav-search"
            placeholder="Search Tengacion"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query && setOpen(true)}
          />

          {open && (results.users.length > 0 || results.posts.length > 0) && (
            <div className="search-dropdown">

              {results.users.length > 0 && (
                <>
                  <div className="sd-title">People</div>

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
                        {u.name} <small>@{u.username}</small>
                      </span>
                    </div>
                  ))}
                </>
              )}

              {results.posts.length > 0 && (
                <>
                  <div className="sd-title">Posts</div>

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
                </>
              )}

              <div className="sd-footer" onClick={goFullSearch}>
                See all results →
              </div>
            </div>
          )}
        </form>
      </div>

      {/* ===== CENTER – FACEBOOK STYLE NAV ===== */}
      <div className="nav-center">
        <button
          className={page === "home" ? "nav-active" : ""}
          onClick={() => setPage("home")}
          title="Home"
        >🏠</button>

        <button
          className={page === "watch" ? "nav-active" : ""}
          onClick={() => setPage("watch")}
          title="Watch"
        >🎥</button>

        <button
          className={page === "groups" ? "nav-active" : ""}
          onClick={() => setPage("groups")}
          title="Groups"
        >👥</button>

        <button
          className={page === "market" ? "nav-active" : ""}
          onClick={() => setPage("market")}
          title="Marketplace"
        >🛒</button>

        <button
          className={page === "games" ? "nav-active" : ""}
          onClick={() => setPage("games")}
          title="Gaming"
        >🎮</button>
      </div>

      {/* ===== RIGHT ===== */}
      <div className="nav-right">

        <button
          className="nav-icon"
          onClick={() => setShowApps(!showApps)}
          title="Apps"
        >⬛</button>

        <button className="nav-icon" title="Messages">💬</button>
        <button className="nav-icon" title="Notifications">🔔</button>

        {/* USER AVATAR */}
        <img
          src={
            user?.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              user?.name || "User"
            )}&size=64`
          }
          className="nav-avatar"
          alt="avatar"
          onClick={() => navigate(`/profile/${user?.username}`)}
        />

        <button
          onClick={onLogout}
          className="nav-logout"
          title="Logout"
        >⎋</button>
      </div>

      {showApps && <AppLauncher />}
    </div>
  );
}
