const EMOJIS = ["😀", "😂", "❤️", "👍", "🎉", "😮", "😢", "🔥"];

export default function EmojiPanel({ open, onPick }) {
  if (!open) {
    return null;
  }

  return (
    <div className="live-popover">
      <p className="live-popover-title">Reactions</p>
      <div className="live-emoji-grid">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="live-emoji-btn"
            onClick={() => onPick(emoji)}
            aria-label={`Send ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
