import { useEffect, useMemo, useRef, useState } from "react";
import { createStoryWithUploadProgress, resolveImage } from "../api";
import Button from "../components/ui/Button";
import { UPLOAD_LIMITS } from "../config/uploadLimits";
import StoryMusicPicker from "./StoryMusicPicker";

const ACCEPTED_TYPES = ["image/", "video/"];

const isAcceptedType = (file) =>
  Boolean(file) &&
  ACCEPTED_TYPES.some((prefix) => String(file.type || "").toLowerCase().startsWith(prefix));

export default function CreateStory({ user, onCreated, openSignal = 0 }) {
  const fileRef = useRef(null);
  const captionRef = useRef(null);
  const lastOpenSignalRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [visibility, setVisibility] = useState("friends");
  const [musicPanelOpen, setMusicPanelOpen] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState(null);

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

  useEffect(() => {
    if (openSignal === lastOpenSignalRef.current) {
      return;
    }
    lastOpenSignalRef.current = openSignal;
    setOpen(true);
    setError("");
  }, [openSignal]);

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
    const isVideo = String(picked.type || "").toLowerCase().startsWith("video/");
    const maxBytes = isVideo
      ? UPLOAD_LIMITS.PROFILE_STORY_VIDEO_BYTES
      : UPLOAD_LIMITS.IMAGE_BYTES;
    if ((Number(picked.size) || 0) > maxBytes) {
      setError(isVideo ? "Story videos must be 25MB or smaller." : "Story images must be 10MB or smaller.");
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
    setMusicPanelOpen(false);
    setSelectedMusic(null);
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
        visibility,
        musicAttachment: selectedMusic,
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
          <span className="icon-glyph-center">+</span>
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
            className={`story-create-modal${musicPanelOpen ? " story-create-modal--with-music" : ""}`}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <aside className="story-create-sidebar">
              <div className="story-create-modal-header">
                <h3>Your story</h3>
                <Button
                  className="story-create-modal-close"
                  aria-label="Close story creation"
                  onClick={closeModal}
                  variant="icon"
                  size="sm"
                  iconOnly
                >
                  <span className="icon-glyph-center">X</span>
                </Button>
              </div>

              <div className="story-create-profile">
                <img src={avatar} alt="" />
                <div>
                  <strong>{user?.name || user?.username || "Your story"}</strong>
                  <span>Build a story your friends will remember</span>
                </div>
              </div>

              <div className="story-create-tools" aria-label="Story tools">
                <button type="button" onClick={openFileDialog} disabled={submitting}>
                  <span className="story-create-tool-icon" aria-hidden="true">▣</span>
                  <span>{file ? "Change media" : "Choose media"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => captionRef.current?.focus()}
                  disabled={submitting}
                >
                  <span className="story-create-tool-icon story-create-tool-icon--text" aria-hidden="true">Aa</span>
                  <span>Add text</span>
                </button>
                <button
                  type="button"
                  className={musicPanelOpen ? "is-active" : ""}
                  onClick={() => setMusicPanelOpen((current) => !current)}
                  disabled={submitting}
                  aria-expanded={musicPanelOpen}
                >
                  <span className="story-create-tool-icon" aria-hidden="true">♫</span>
                  <span>{selectedMusic ? "Edit music" : "Add music"}</span>
                </button>
              </div>

              <div className="story-create-sidebar-fields">
                <label>
                  <span>Story text</span>
                  <textarea
                    ref={captionRef}
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Say something about this story..."
                    maxLength={220}
                  />
                </label>
                <label>
                  <span>Audience</span>
                  <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                    <option value="public">Public</option>
                    <option value="friends">Friends</option>
                    <option value="close_friends">Close Friends</option>
                  </select>
                </label>
              </div>

              {selectedMusic ? (
                <div className="story-create-soundtrack">
                  <img
                    src={resolveImage(selectedMusic.coverImage) || selectedMusic.coverImage}
                    alt={selectedMusic.title || "Selected soundtrack"}
                  />
                  <div>
                    <span>30-second soundtrack</span>
                    <strong>{selectedMusic.title}</strong>
                    <small>{selectedMusic.creatorName || "Tengacion creator"}</small>
                  </div>
                  <button
                    type="button"
                    className="story-create-soundtrack__remove"
                    onClick={() => setSelectedMusic(null)}
                    disabled={submitting}
                  >
                    Remove
                  </button>
                </div>
              ) : null}

              {progress > 0 && submitting && (
                <div className="story-create-progress">
                  <span style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
              )}
              {error ? <p className="story-create-error">{error}</p> : null}

              <div className="story-create-modal-actions">
                <Button variant="secondary" onClick={closeModal} disabled={submitting}>
                  Discard
                </Button>
                <Button variant="primary" loading={submitting} onClick={submit} disabled={!file}>
                  Share to story
                </Button>
              </div>
            </aside>

            <main className="story-create-workspace">
              <div className="story-create-workspace__header">
                <span>Preview</span>
                <small>{selectedMusic ? "Music attached · 30 seconds" : "Story preview"}</small>
              </div>
              <div className={`story-create-workspace__stage${musicPanelOpen ? " is-music-open" : ""}`}>
                <div className="story-create-canvas">
                  {file ? (
                    <div className="story-create-preview">
                      {String(file.type).startsWith("video/") ? (
                        <video controls src={previewUrl} />
                      ) : (
                        <img src={previewUrl} alt="Story preview" />
                      )}
                    </div>
                  ) : (
                    <button type="button" className="story-create-empty" onClick={openFileDialog}>
                      Choose an image or video
                    </button>
                  )}
                  {caption ? <p className="story-create-preview-text">{caption}</p> : null}
                  {selectedMusic ? (
                    <div className="story-create-preview-music">
                      <span aria-hidden="true">♫</span>
                      <div>
                        <strong>{selectedMusic.title}</strong>
                        <small>{selectedMusic.creatorName || "Tengacion creator"} · 30 sec</small>
                      </div>
                    </div>
                  ) : null}
                </div>

                {musicPanelOpen ? (
                  <div className="story-create-modal-music">
                    <StoryMusicPicker
                      value={selectedMusic}
                      onSelect={setSelectedMusic}
                      onClear={() => setSelectedMusic(null)}
                      onClose={() => setMusicPanelOpen(false)}
                    />
                  </div>
                ) : null}
              </div>
            </main>
          </div>
        </div>
      )}
    </>
  );
}
