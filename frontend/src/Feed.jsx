import Composer from "./Composer";
import PostList from "./PostList";
import StoriesBar from "./stories/StoriesBar";

export default function Feed() {
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
