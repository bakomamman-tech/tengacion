import { useEffect, useState } from "react";
import { resolveImage, markStorySeen } from "./api";

export default function StoryModal({ stories, index, onClose }) {
  const [i, setI] = useState(index);
  const story = stories?.[i];

  useEffect(() => {
    if (story?._id) {
      markStorySeen(story._id);
    }
  }, [i, story]);

  if (!story) return null;

  return (
    <div className="story-modal" onClick={onClose}>
      <div
        className="story-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="story-header">
          <img
            src={
              story?.avatar
                ? resolveImage(story.avatar)
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    story?.username || "User"
                  )}`
            }
            alt={story?.username || "User"}
          />
          <b>{story?.username}</b>
        </div>

        {story?.image && (
          <img
            src={resolveImage(story.image)}
            alt="Story"
          />
        )}

        {story?.text && <p>{story.text}</p>}

        <div
          className="story-progress"
          onClick={() => setI(i + 1)}
        />
      </div>
    </div>
  );
}
