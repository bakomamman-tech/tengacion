import Composer from "./Composer";
import Stories from "./Stories";
import PostList from "./PostList";

export default function Feed() {
  return (
    <div className="tengacion-feed">
      {/* What's on your mind */}
      <div className="feed-composer">
        <Composer />
      </div>

      {/* Stories */}
      <div className="feed-stories">
        <Stories />
      </div>

      {/* Posts */}
      <div className="feed-posts">
        <PostList />
      </div>
    </div>
  );
}
