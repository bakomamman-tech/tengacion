import { getImage } from "../api";

export default function StoryViewer({ story, onClose }) {
  return (
    <div className="story-viewer">
      <img src={getImage(story.image)} alt="" />
      <button onClick={onClose}>✕</button>
    </div>
  );
}
