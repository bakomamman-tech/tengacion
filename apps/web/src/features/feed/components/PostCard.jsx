export default function PostCard({ post }) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-slate-200">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-slate-200 text-center text-xs uppercase text-slate-500">
          {post.username?.charAt(0) || "U"}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{post.name || post.username}</p>
          <p className="text-xs text-slate-500">@{post.username}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-700">{post.text || "No caption yet"}</p>
      {post.media?.length > 0 && (
        <img
          src={post.media[0].url}
          alt={post.text || "Post media"}
          className="mt-3 w-full rounded-2xl object-cover"
        />
      )}
    </article>
  );
}
