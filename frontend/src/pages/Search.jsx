import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { resolveImage } from "../api";
import "../index.css";

export default function Search() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const q = params.get("q") || "";

  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q) {return;}

    setLoading(true);

    Promise.all([
      fetch(`/api/users?search=${encodeURIComponent(q)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }).then((r) => r.json()),

      fetch(`/api/posts?search=${encodeURIComponent(q)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }).then((r) => r.json()),
    ])
      .then(([u, p]) => {
        setUsers(Array.isArray(u) ? u : []);
        setPosts(Array.isArray(p) ? p : []);
      })
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "auto" }}>
      <h2>Search results for: "{q}"</h2>

      {loading && <p>Searching Tengacion…</p>}

      {/* ===== USERS ===== */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>People</h3>

        {!loading && users.length === 0 && <p>No people found</p>}

        {users.map((u) => {
          const avatarSrc = u?.avatar
            ? resolveImage(u.avatar)
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                u?.name || "User"
              )}`;

          return (
            <div
              key={u._id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 10,
                cursor: "pointer",
              }}
              onClick={() => navigate(`/profile/${u.username}`)}
            >
              <img
                src={avatarSrc}
                alt={u?.username || "User"}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                }}
              />

              <div>
                <b>{u.name}</b>
                <div style={{ color: "#666" }}>@{u.username}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== POSTS ===== */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Posts</h3>

        {!loading && posts.length === 0 && <p>No posts found</p>}

        {posts.map((p) => (
          <div
            key={p._id}
            style={{
              padding: 12,
              borderBottom: "1px solid #ddd",
              cursor: "pointer",
            }}
            onClick={() => navigate("/home")}
          >
            <div style={{ marginBottom: 6 }}>
              <b>{p.name}</b>{" "}
              <span style={{ color: "#666" }}>@{p.username}</span>
            </div>

            <div>{p.text}</div>

            {p.image && (
              <img
                src={resolveImage(p.image)}
                alt="Post"
                style={{
                  width: "100%",
                  borderRadius: 10,
                  marginTop: 8,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
