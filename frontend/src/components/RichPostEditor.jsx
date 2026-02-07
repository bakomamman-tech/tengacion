import { useState, useRef, useEffect } from "react";

export default function RichPostEditor({ value, onChange, placeholder, autoFocus }) {
  const [showEmojis, setShowEmojis] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [showHashtags, setShowHashtags] = useState(false);
  const editorRef = useRef(null);

  const emojis = ["😀", "😂", "❤️", "😍", "😭", "😡", "🎉", "🚀", "💯", "🔥", "👍", "🎨"];
  const suggestedHashtags = ["#Tengacion", "#NewPost", "#Trending", "#Creator", "#Tech"];

  const insertEmoji = (emoji) => {
    const cursorPos = editorRef.current.selectionStart;
    const newValue = 
      value.substring(0, cursorPos) + emoji + value.substring(cursorPos);
    onChange({ target: { value: newValue } });
    setShowEmojis(false);
  };

  const insertHashtag = (hashtag) => {
    const newValue = value + (value ? " " : "") + hashtag;
    onChange({ target: { value: newValue } });
    setShowHashtags(false);
  };

  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="rich-editor-wrapper">
      <div className="editor-container">
        <textarea
          ref={editorRef}
          className="rich-editor"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
        
        {/* Write Suggestions */}
        {value.length >= 3 && (
          <div className="editor-hints">
            📝 {value.length} characters | Keep it engaging!
          </div>
        )}
      </div>

      {/* EDITOR TOOLBAR */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <button
            className="toolbar-btn"
            onClick={() => setShowEmojis(!showEmojis)}
            title="Add emoji"
          >
            😊 Emoji
          </button>

          <button
            className="toolbar-btn"
            onClick={() => setShowHashtags(!showHashtags)}
            title="Add hashtag"
          >
            # Hashtag
          </button>

          <button
            className="toolbar-btn"
            title="Mention someone"
          >
            @ Mention
          </button>
        </div>

        <div className="toolbar-right">
          <span className="char-count">{value.length}</span>
        </div>
      </div>

      {/* EMOJI PICKER */}
      {showEmojis && (
        <div className="emoji-picker">
          {emojis.map((emoji, idx) => (
            <button
              key={idx}
              className="emoji-btn"
              onClick={() => insertEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* HASHTAG SUGGESTIONS */}
      {showHashtags && (
        <div className="hashtag-picker">
          <p className="picker-title">Suggested hashtags:</p>
          {suggestedHashtags.map((tag, idx) => (
            <button
              key={idx}
              className="hashtag-btn"
              onClick={() => insertHashtag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
