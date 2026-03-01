import { useEffect, useMemo, useRef, useState } from "react";
import { createStoryWithUploadProgress, resolveImage } from "../api";

const ACCEPTED_TYPES = ["image/", "video/"];

const isAcceptedType = (file) =>
  Boolean(file) &&
  ACCEPTED_TYPES.some((prefix) => String(file.type || "").toLowerCase().startsWith(prefix));

export default function CreateStory({ user, onCreated }) {
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const avatar = useMemo(
    () =>
      resolveImage(user?.avatar) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user?.username || user?.name || "You"
      )}`,
    [user?.avatar, user?.name, user?.username]
  );

  const openFileDialog = () => fileRef.current?.click();

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }
    const next = URL.createObjectURL(file);
    setPreviewUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const onPickFile = (event) => {
    const picked = event.target.files?.[0] || null;
    event.target.value = "";
    if (!picked) {
      return;
    }
    if (!isAcceptedType(picked)) {
      setError("Only image or video stories are supported");
      return;
    }
    setError("");
    setFile(picked);
    setOpen(true);
  };

  const closeModal = () => {
    if (submitting) {
      return;
    }
    setOpen(false);
    setFile(null);
    setCaption("");
    setProgress(0);
    setError("");
  };

  const submit = async () => {
    if (!file || submitting) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await createStoryWithUploadProgress({
        file,
        caption: caption.trim(),
        onProgress: setProgress,
      });
      await onCreated?.();
      closeModal();
    } catch (err) {
      setError(err?.message || "Failed to create story");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="story-card story-create-card"
        role="button"
        tabIndex={0}
        onClick={openFileDialog}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFileDialog();
          }
        }}
      >
        <div className="story-create-cover">
          <img src={avatar} alt="Your profile" />
        </div>
        <div className="story-create-plus" aria-hidden="true">
          +
        </div>
        <div className="story-create-label">Create story</div>
      </div>

      <input
        ref={fileRef}
        type="file"
        hidden
        accept="image/*,video/*"
        onChange={onPickFile}
      />

      {open && (
        <div className="story-create-modal-backdrop" onClick={closeModal}>
          <div
            className="story-create-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="story-create-modal-header">
              <h3>Create story</h3>
              <button
                type="button"
                className="story-create-modal-close"
                aria-label="Close story creation"
                onClick={closeModal}
              >
                X
              </button>
            </div>

            <div className="story-create-modal-body">
              {file ? (
                <div className="story-create-preview">
                  {String(file.type).startsWith("video/") ? (
                    <video controls src={previewUrl} />
                  ) : (
                    <img src={previewUrl} alt="Story preview" />
                  )}
                </div>
              ) : (
                <p className="story-create-empty">Choose an image or video</p>
              )}

              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Say something about this story..."
                maxLength={220}
              />

              {progress > 0 && submitting && (
                <div className="story-create-progress">
                  <span style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
              )}

              {error ? <p className="story-create-error">{error}</p> : null}
            </div>

            <div className="story-create-modal-actions">
              <button type="button" className="btn-secondary" onClick={openFileDialog} disabled={submitting}>
                Change media
              </button>
              <button type="button" onClick={submit} disabled={!file || submitting}>
                {submitting ? "Posting..." : "Share to story"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
