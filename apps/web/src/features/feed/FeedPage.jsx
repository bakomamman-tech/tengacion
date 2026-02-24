import PostCard from "./components/PostCard";
import { useFeed } from "./hooks/useFeed";

export default function FeedPage() {
  const { posts, loading, error, refresh } = useFeed();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 p-6 text-slate-500">
        <p className="text-sm">Loading posts…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-600">
        <p className="text-sm font-semibold">Unable to load feed</p>
        <button
          type="button"
          onClick={refresh}
          className="rounded-full border border-rose-200 px-4 py-1 text-xs font-semibold text-rose-600"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        No posts yet. Check back soon.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post._id} post={post} />
      ))}
    </div>
  );
}
