import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  getSearchSuggestions,
  getTrendingHashtags,
  resolveImage,
  searchGlobal,
} from "../api";

const TABS = [
  { id: "users", label: "Users" },
  { id: "posts", label: "Posts" },
  { id: "hashtags", label: "Hashtags" },
  { id: "rooms", label: "Rooms" },
];

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}&size=240&background=DFE8F6&color=1D3A6D`;

export default function Search() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const q = params.get("q") || "";
  const tab = TABS.some((item) => item.id === params.get("type"))
    ? params.get("type")
    : "users";

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [trending, setTrending] = useState([]);
  const [suggestions, setSuggestions] = useState({ people: [], rooms: [], hashtags: [] });

  useEffect(() => {
    getTrendingHashtags().then((rows) => setTrending(Array.isArray(rows) ? rows : [])).catch(() => setTrending([]));
    getSearchSuggestions()
      .then((rows) => setSuggestions(rows || { people: [], rooms: [], hashtags: [] }))
      .catch(() => setSuggestions({ people: [], rooms: [], hashtags: [] }));
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchGlobal({ q, type: tab })
      .then((payload) => setResults(Array.isArray(payload?.data) ? payload.data : []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [q, tab]);

  const emptyLabel = useMemo(() => {
    if (tab === "users") {return "No users found";}
    if (tab === "posts") {return "No posts found";}
    if (tab === "hashtags") {return "No hashtags found";}
    return "No rooms found";
  }, [tab]);

  const updateTab = (nextTab) => {
    const next = new URLSearchParams(params);
    next.set("type", nextTab);
    setParams(next, { replace: true });
  };

  return (
    <div style={{ padding: 20, maxWidth: 980, margin: "auto", display: "grid", gap: 14 }}>
      <h2 style={{ marginBottom: 0 }}>Search</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "search-person-btn primary" : "search-person-btn"}
            onClick={() => updateTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!q.trim() ? (
        <div className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Suggestions</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {(suggestions.people || []).slice(0, 6).map((entry) => (
              <button
                key={entry._id}
                type="button"
                className="search-person-row"
                onClick={() => navigate(`/profile/${entry.username}`)}
              >
                <img
                  src={resolveImage(entry.avatar) || fallbackAvatar(entry.name)}
                  alt={entry.username || "User"}
                  className="search-person-avatar"
                />
                <div className="search-person-meta">
                  <b>{entry.name}</b>
                  <div>@{entry.username}</div>
                </div>
              </button>
            ))}
            <h4 style={{ marginBottom: 0 }}>Trending hashtags</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {trending.map((entry) => (
                <button
                  key={entry.tag}
                  type="button"
                  className="composer-chip"
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("q", `#${entry.tag}`);
                    next.set("type", "hashtags");
                    setParams(next, { replace: false });
                  }}
                >
                  #{entry.tag} ({entry.count})
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {q.trim() ? (
        <div className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>
            Results for "{q}" ({tab})
          </h3>
          {loading ? <p>Searching...</p> : null}
          {!loading && results.length === 0 ? <p>{emptyLabel}</p> : null}

          {tab === "users" &&
            results.map((entry) => (
              <button
                key={entry._id}
                type="button"
                className="search-person-row"
                onClick={() => navigate(`/profile/${entry.username}`)}
              >
                <img
                  src={resolveImage(entry.avatar) || fallbackAvatar(entry.name)}
                  alt={entry.username || "User"}
                  className="search-person-avatar"
                />
                <div className="search-person-meta">
                  <b>{entry.name}</b>
                  <div>@{entry.username}</div>
                </div>
              </button>
            ))}

          {tab === "posts" &&
            results.map((entry) => (
              <article key={entry._id} className="card" style={{ padding: 10, marginBottom: 8 }}>
                <div>
                  <b>{entry?.author?.name || "User"}</b> @{entry?.author?.username || ""}
                </div>
                <p style={{ margin: "8px 0" }}>{entry.text || "(no text)"}</p>
                <button type="button" onClick={() => navigate(`/posts/${entry._id}`)}>
                  Open post
                </button>
              </article>
            ))}

          {tab === "hashtags" &&
            results.map((entry) => (
              <div key={entry.tag} className="card" style={{ padding: 10, marginBottom: 8 }}>
                <b>#{entry.tag}</b> <span style={{ opacity: 0.8 }}>({entry.count} posts)</span>
              </div>
            ))}

          {tab === "rooms" &&
            results.map((entry) => (
              <div key={entry._id} className="card" style={{ padding: 10, marginBottom: 8 }}>
                <b>{entry.name}</b>
                <div>{entry.description || "No description"}</div>
                <small>{entry.membersCount || 0} members</small>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}
