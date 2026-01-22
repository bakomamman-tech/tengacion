import { useEffect, useState } from "react";
import { getStories } from "../api";
import StoryCard from "./StoryCard";
import CreateStory from "./CreateStory";
import "./stories.css";

export default function StoriesBar({ loading }) {
  const [stories, setStories] = useState([]);

  useEffect(() => {
    getStories().then(data => setStories(data));
  }, []);

  return (
    <div className="stories-bar">
      <CreateStory onCreated={() => getStories().then(setStories)} />
      {stories.map(story => (
        <StoryCard key={story._id} story={story} />
      ))}
    </div>
  );
}
