import { getImage } from "./api";
import { useEffect, useState } from "react";
import { markStorySeen } from "./api";

export default function StoryModal({ stories, index, onClose }) {
  const [i, setI] = useState(index);
  const story = stories[i];

  useEffect(() => {
    story && markStorySeen(story._id);
  }, [i]);

  if (!story) return null;

  return (
    <div className="story-modal" onClick={onClose}>
      <div className="story-content" onClick={e => e.stopPropagation()}>
        <div className="story-header">
          <img src={getImage(story.avatar)} />
          <b>{story.username}</b>
        </div>

        {story.image && <img src={getImage(story.image)} />}
        {story.text && <p>{story.text}</p>}

        <div className="story-progress" onClick={() => setI(i + 1)} />
      </div>
    </div>
  );
}
