import { useEffect, useState } from "react";
import "./StoryModal.css";
import { markStorySeen } from "./api";

export default function StoryModal({ stories, index, onClose, user }) {
  const [i, setI] = useState(index);
  const story = stories[i];

  useEffect(() => {
    if (story) {
      markStorySeen(story._id);
    }
  }, [i]);

  if (!story) return null;

  const next = () => {
    if (i < stories.length - 1) setI(i + 1);
    else onClose();
  };

  return (
    <div className="story-modal" onClick={onClose}>
      <div className="story-content" onClick={e => e.stopPropagation()}>
        <div className="story-header">
          <img src={story.avatar} />
          <b>{story.username}</b>
          <span>{new Date(story.time).toLocaleTimeString()}</span>
        </div>

        {story.image && <img src={`http://localhost:5000${story.image}`} />}
        {story.text && <p>{story.text}</p>}

        <div className="story-progress" onClick={next} />
      </div>
    </div>
  );
}
