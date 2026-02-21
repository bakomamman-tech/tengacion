import { useEffect, useMemo, useRef, useState } from "react";

const EMOJIS = [
  "\u{1F44D}",
  "\u{1F60D}",
  "\u{1F602}",
  "\u{1F973}",
  "\u{1F60E}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{2764}\u{FE0F}",
];

const GIF_TOKENS = ["[GIF: Celebration]", "[GIF: Laugh]", "[GIF: Wow]"];
const STICKER_TOKENS = ["[Sticker: Fire]", "[Sticker: Clap]", "[Sticker: Star]"];

const normalizeComment = (comment, index) => {
  if (!comment || typeof comment !== "object") {
    return null;
  }

  const id = comment._id || comment.id || `${index}-${Date.now()}`;
  const authorRaw = comment.author;
  const authorName =
    comment.authorName ||
    comment.userName ||
    (authorRaw && typeof authorRaw === "object" ? authorRaw.name : "") ||
    "User";

  return {
    id,
    authorName,
    text: typeof comment.text === "string" ? comment.text : "",
    createdAt: comment.createdAt || null,
    mediaPreview: comment.mediaPreview || "",
  };
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

function ToolIcon({ name }) {
  const icons = {
    sticker: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1.4" y="1.4" width="21.2" height="21.2" rx="6" fill="#f0e8ff" />
        <path d="M6.5 8.2h11v7.6h-11z" fill="#7b61ff" opacity="0.2" />
        <path
          d="M9.1 10.8c.5 0 .9-.4.9-.9 0-.6-.4-1-.9-1-.6 0-1 .4-1 1 0 .5.4.9 1 .9zm5.8 0c.5 0 .9-.4.9-.9 0-.6-.4-1-.9-1-.6 0-1 .4-1 1 0 .5.4.9 1 .9z"
          fill="#6f50f3"
        />
        <path
          d="M7.6 14.8c1.3 1.1 2.8 1.7 4.4 1.7s3.2-.6 4.4-1.7"
          stroke="#6f50f3"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
    emoji: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.4" fill="#ffca3a" />
        <circle cx="8.8" cy="10.1" r="1.2" fill="#975f00" />
        <circle cx="15.2" cy="10.1" r="1.2" fill="#975f00" />
        <path
          d="M8.2 14.3c1 1.2 2.3 1.8 3.8 1.8s2.8-.6 3.8-1.8"
          stroke="#975f00"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
    photo: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1.3" y="1.3" width="21.4" height="21.4" rx="5.5" fill="#3ecf78" />
        <rect x="5" y="5.5" width="14" height="12.4" rx="2.2" fill="#defcea" />
        <circle cx="9.1" cy="9.5" r="1.4" fill="#2b9a5e" />
        <path d="M6 17.3l3.7-3.3 2.7 2.2 2.1-1.7 3.5 2.8H6z" fill="#248a52" />
      </svg>
    ),
    effects: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.6" fill="#e9f2ff" />
        <path
          d="M12 5.2l1.6 3.3 3.7.6-2.7 2.7.6 3.7-3.2-1.7-3.2 1.7.6-3.7L6.7 9.1l3.7-.6L12 5.2z"
          fill="#4a83ff"
        />
      </svg>
    ),
  };

  return <span className="comment-tool-icon">{icons[name] || icons.effects}</span>;
}

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2.1 9.2l15.1-6.1c.7-.3 1.4.4 1.1 1.1L12.2 19.3c-.3.8-1.5.8-1.8 0l-1.9-5.1L2.1 12c-.8-.3-.8-1.5 0-1.8z" />
    </svg>
  );
}

export default function PostComments({
  postId,
  initialComments = [],
  initialCount = 0,
  onCountChange,
}) {
  const [comments, setComments] = useState(() =>
    (Array.isArray(initialComments) ? initialComments : [])
      .map((comment, index) => normalizeComment(comment, index))
      .filter(Boolean)
  );
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [pickedImage, setPickedImage] = useState("");
  const [error, setError] = useState("");
  const imageInputRef = useRef(null);

  useEffect(() => {
    const normalized = (Array.isArray(initialComments) ? initialComments : [])
      .map((comment, index) => normalizeComment(comment, index))
      .filter(Boolean);
    setComments(normalized);
  }, [postId, initialComments]);

  const baseCount = useMemo(() => {
    const fallback = comments.length;
    const safeInitial = Number(initialCount);
    if (!Number.isFinite(safeInitial) || safeInitial < 0) {
      return fallback;
    }

    return Math.max(safeInitial, fallback);
  }, [initialCount, comments.length]);

  useEffect(() => {
    onCountChange?.(baseCount);
  }, [baseCount, onCountChange]);

  const closePickers = () => {
    setShowEmojiPicker(false);
    setShowGifPicker(false);
  };

  const clearPickedImage = () => {
    setPickedImage("");
  };

  const submit = async () => {
    if ((!text.trim() && !pickedImage) || loading) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const payloadText = text.trim() || "Image reply";
      const res = await fetch(`/api/posts/${postId}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ text: payloadText }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to send comment");
      }

      const serverComment = normalizeComment(data?.comment, Date.now()) || {
        id: Date.now().toString(),
        authorName: "You",
        text: payloadText,
        createdAt: new Date().toISOString(),
        mediaPreview: "",
      };

      const nextComment = {
        ...serverComment,
        authorName: "You",
        mediaPreview: pickedImage || "",
      };

      setComments((prev) => [...prev, nextComment]);
      const nextCount = Number(data?.commentsCount);
      const fallbackCount = comments.length + 1;
      onCountChange?.(
        Number.isFinite(nextCount) && nextCount >= 0 ? nextCount : fallbackCount
      );

      setText("");
      setPickedImage("");
      closePickers();
    } catch (err) {
      setError(err.message || "Failed to send comment");
    } finally {
      setLoading(false);
    }
  };

  const addEmoji = (emoji) => {
    setText((current) => `${current}${emoji}`);
    setShowEmojiPicker(false);
  };

  const addGifToken = (token) => {
    setText((current) => `${current}${current ? " " : ""}${token}`);
    setShowGifPicker(false);
  };

  const addSticker = () => {
    const token = STICKER_TOKENS[Math.floor(Math.random() * STICKER_TOKENS.length)];
    setText((current) => `${current}${current ? " " : ""}${token}`);
  };

  const addEffect = () => {
    setText((current) => `${current}${current ? " " : ""}\u2728`);
  };

  const pickImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPickedImage(dataUrl);
      setError("");
    } catch {
      setError("Failed to read image");
    }
  };

  return (
    <div className="comments comments-v2">
      {comments.map((comment) => (
        <article key={comment.id} className="comment comment-v2">
          <div className="comment-author">{comment.authorName}</div>
          {comment.text && <p>{comment.text}</p>}
          {comment.mediaPreview && (
            <img
              className="comment-inline-media"
              src={comment.mediaPreview}
              alt="Comment attachment preview"
            />
          )}
        </article>
      ))}

      <div className="comment-composer-shell">
        <img src="/avatar.png" alt="me" />

        <div className="comment-composer-main">
          <div className="comment-input-row">
            <input
              placeholder="Comment as you..."
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />

            <button
              type="button"
              className={`comment-send-btn ${text.trim() || pickedImage ? "ready" : ""}`}
              disabled={(!text.trim() && !pickedImage) || loading}
              onClick={submit}
              aria-label="Send comment"
              title="Send"
            >
              <SendIcon />
            </button>
          </div>

          {pickedImage && (
            <div className="comment-picked-media">
              <img src={pickedImage} alt="Picked comment attachment" />
              <button type="button" onClick={clearPickedImage}>
                Remove
              </button>
            </div>
          )}

          <div className="comment-tools-row">
            <button
              type="button"
              className="comment-tool-btn sticker"
              onClick={addSticker}
              title="Sticker"
            >
              <ToolIcon name="sticker" />
            </button>
            <button
              type="button"
              className="comment-tool-btn emoji"
              onClick={() => {
                setShowEmojiPicker((value) => !value);
                setShowGifPicker(false);
              }}
              title="Emoji"
            >
              <ToolIcon name="emoji" />
            </button>
            <button
              type="button"
              className="comment-tool-btn photo"
              onClick={() => imageInputRef.current?.click()}
              title="Photo"
            >
              <ToolIcon name="photo" />
            </button>
            <button
              type="button"
              className="comment-tool-btn gif"
              onClick={() => {
                setShowGifPicker((value) => !value);
                setShowEmojiPicker(false);
              }}
              title="GIF"
            >
              <span className="comment-tool-gif">GIF</span>
            </button>
            <button
              type="button"
              className="comment-tool-btn effects"
              onClick={addEffect}
              title="Effects"
            >
              <ToolIcon name="effects" />
            </button>
          </div>

          <input
            ref={imageInputRef}
            type="file"
            hidden
            accept="image/*"
            onChange={pickImage}
          />

          {showEmojiPicker && (
            <div className="comment-picker-row emoji">
              {EMOJIS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => addEmoji(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {showGifPicker && (
            <div className="comment-picker-row gif">
              {GIF_TOKENS.map((token) => (
                <button key={token} type="button" onClick={() => addGifToken(token)}>
                  {token}
                </button>
              ))}
            </div>
          )}

          {error && <p className="comment-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
