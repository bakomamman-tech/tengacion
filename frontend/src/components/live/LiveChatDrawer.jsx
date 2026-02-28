export default function LiveChatDrawer({
  open,
  messages,
  draft,
  onDraftChange,
  onSend,
  onClose,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="live-chat-drawer">
      <div className="live-chat-head">
        <strong>Live chat</strong>
        <button type="button" className="live-chat-close" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="live-chat-body">
        {!messages.length ? (
          <p className="live-chat-empty">No messages yet.</p>
        ) : (
          messages.map((entry) => (
            <div key={entry.id} className="live-chat-msg">
              <b>{entry.sender}</b>
              <span>{entry.text}</span>
            </div>
          ))
        )}
      </div>
      <div className="live-chat-input-row">
        <input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Type a message"
        />
        <button type="button" onClick={onSend} disabled={!draft.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
