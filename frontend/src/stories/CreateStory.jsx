import { createStory } from "../api";
import { useRef } from "react";

export default function CreateStory({ onCreated }) {
  const fileRef = useRef();

  const uploadStory = async e => {
    const file = e.target.files[0];
    if (!file) return;

    const form = new FormData();
    form.append("image", file);

    await createStory(form);
    onCreated && onCreated();
  };

  return (
    <div className="story-card create" onClick={() => fileRef.current.click()}>
      <span>＋</span>
      <p>Create Story</p>
      <input
        type="file"
        hidden
        ref={fileRef}
        onChange={uploadStory}
      />
    </div>
  );
}
