import { useState } from "react";
import StoryViewer from "./StoryViewer";
import { getImage } from "../api";

export default function StoryCard({ story }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="story-card" onClick={() => setOpen(true)}>
        <img src={getImage(story.image)} alt="" />

        <div className="story-avatar">
          <img
            src={
              story.avatar
                ? getImage(story.avatar)
                : `https://ui-avatars.com/api/?name=${story.username}`
            }
          />
        </div>

        <div className="story-name">{story.username}</div>
      </div>

      {open && <StoryViewer story={story} onClose={() => setOpen(false)} />}
    </>
  );
}
