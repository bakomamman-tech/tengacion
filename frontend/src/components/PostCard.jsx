posts.map((p) => (
  <PostCard
    key={p._id}
    post={p}
    onDelete={(id) => setPosts((prev) => prev.filter((x) => x._id !== id))}
    onEdit={(updatedPost) =>
      setPosts((prev) =>
        prev.map((x) => (x._id === updatedPost._id ? updatedPost : x))
      )
    }
  />
))
