// frontend/src/pages/Feed.jsx

import { useEffect, useState } from "react";

import Composer from "./Composer";
import PostList from "./PostList";
import StoriesBar from "./stories/StoriesBar";
import FeedSkeleton from "./components/FeedSkeleton";
import EmptyFeed from "../components/EmptyFeed";

import { getFeed } from "../services/feedService";

// 👋 Starter system post (shown when feed is empty)
const starterPost = {
  _id: "welcome",
  text: "👋 Welcome to Tengacion! Create your first post and connect with others.",
  system: true,
  createdAt: new Date(),
};

export default function Feed({ onCreate }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 📡 Fetch feed
  useEffect(() => {
    getFeed()
      .then((data) => setPosts(data || []))
      .finally(() => setLoading(false));
  }, []);

  // ⏳ Skeleton loading state
  if (loading) {
    return (
      <>
        <FeedSkeleton />
        <FeedSkeleton />
        <FeedSkeleton />
      </>
    );
  }

  const isEmpty = posts.length === 0;
  const displayPosts = isEmpty ? [starterPost] : posts;

  return (
    <div className="tengacion-feed">
      {/* Stories */}
      <div className="feed-stories">
        <StoriesBar />
      </div>

      {/* Composer */}
      <div className="feed-composer">
        <Composer />
      </div>

      {/* Posts */}
      <div className="feed-posts">
        <PostList posts={displayPosts} />
      </div>

      {/* Empty feed CTA */}
      {isEmpty && <EmptyFeed onCreate={onCreate} />}
    </div>
  );
}
