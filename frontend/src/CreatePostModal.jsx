import { useState } from "react";
import Button from "./components/ui/Button";
import "./CreatePostModal.css";

export default function CreatePostModal({ onClose, onPost }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) {
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);
      await Promise.resolve(onPost?.({ text, file }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Create Post</h3>
          <Button
            variant="icon"
            size="sm"
            iconOnly
            className="create-post-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span className="icon-glyph-center">X</span>
          </Button>
        </div>

        <textarea
          placeholder="What's on your mind?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {preview && (
          <div className="preview">
            {file.type.startsWith("video") ? (
              <video src={preview} controls />
            ) : (
              <img src={preview} alt="Post preview" />
            )}
          </div>
        )}

        <div className="post-tools">
          <label>
            ??
            <input type="file" hidden accept="image/*,video/*" onChange={handleFile} />
          </label>
          <span>??</span>
          <span>??</span>
          <span>??</span>
        </div>

        <Button className="post-btn" variant="primary" size="lg" loading={submitting} onClick={submit}>
          Post
        </Button>
      </div>
    </div>
  );
}
