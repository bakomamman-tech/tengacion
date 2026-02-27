import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import PostCard from "../components/PostCard";
import { getPostById } from "../api";

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!postId) {
      return;
    }
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getPostById(postId);
        if (!alive) {
          return;
        }
        setPost(data);
      } catch (err) {
        if (alive) {
          setError(err.message || "Post not found");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [postId]);

  return (
    <main className="post-detail-page">
      <header className="post-detail-header">
        <button className="secondary" type="button" onClick={() => navigate(-1)}>
          Back
        </button>
        <h2>Post</h2>
      </header>

      {loading ? (
        <p>Loading post…</p>
      ) : error ? (
        <p className="field-error">{error}</p>
      ) : (
        post && (
          <PostCard
            post={post}
            disableAutoplay
            onDelete={() => navigate(-1)}
            onEdit={() => {}}
          />
        )
      )}
    </main>
  );
}
