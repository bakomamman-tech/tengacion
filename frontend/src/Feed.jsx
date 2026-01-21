import Composer from "./Composer";
import PostList from "./PostList";
import StoriesBar from "./stories/StoriesBar";
import FeedSkeleton from "./components/FeedSkeleton";

export default function Feed({ loading }) {
  // ⏳ Skeleton loading state (replaces: if (loading) return null)
  if (loading) {
    return (
      <>
        <FeedSkeleton />
        <FeedSkeleton />
        <FeedSkeleton />
      </>
    );
  }

  return (
    <div className="tengacion-feed">
      {/* Stories (Facebook style) */}
      <div className="feed-stories">
        <StoriesBar />
      </div>

      {/* What's on your mind */}
      <div className="feed-composer">
        <Composer />
      </div>

      {/* Posts */}
      <div className="feed-posts">
        <PostList />
      </div>
    </div>
  );
}
