import { useState } from "react";
import "./CreatePostModal.css";

export default function CreatePostModal({ onClose, onPost }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Create Post</h3>
          <button onClick={onClose}>✖</button>
        </div>

        <textarea
          placeholder="What's on your mind?"
          value={text}
          onChange={e => setText(e.target.value)}
        />

        {preview && (
          <div className="preview">
            {file.type.startsWith("video") ? (
              <video src={preview} controls />
            ) : (
              <img src={preview} />
            )}
          </div>
        )}

        <div className="post-tools">
          <label>
            📷
            <input type="file" hidden accept="image/*,video/*" onChange={handleFile} />
          </label>
          <span>🎥</span>
          <span>😀</span>
          <span>🎵</span>
        </div>

        <button
          className="post-btn"
          onClick={() => onPost({ text, file })}
        >
          Post
        </button>
      </div>
    </div>
  );
}
