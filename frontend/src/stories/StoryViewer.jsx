import { resolveImage } from "../api";

export default function StoryViewer({ story, onClose }) {
  return (
    <div className="story-viewer">
      <img
        src={resolveImage(story?.image)}
        alt="Story"
      />
      <button onClick={onClose}>✕</button>
    </div>
  );
}
