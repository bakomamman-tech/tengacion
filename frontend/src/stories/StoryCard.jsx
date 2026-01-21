import { useState } from "react";
import StoryViewer from "./StoryViewer";
import { resolveImage } from "../api";

export default function StoryCard({ story }) {
  const [open, setOpen] = useState(false);

  const avatarSrc = story?.avatar
    ? resolveImage(story.avatar)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        story?.username || "User"
      )}`;

  return (
    <>
      <div className="story-card" onClick={() => setOpen(true)}>
        <img
          src={resolveImage(story?.image)}
          alt="Story"
        />

        <div className="story-avatar">
          <img src={avatarSrc} alt={story?.username || "User"} />
        </div>

        <div className="story-name">
          {story?.username}
        </div>
      </div>

      {open && (
        <StoryViewer
          story={story}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
