import { useEffect, useState, useRef } from "react";
import socket from "./socket";

export default function Messenger({ user, onClose }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [receiverId, setReceiverId] = useState(null);

  const endRef = useRef(null);

  /* ===== AUTO SCROLL ===== */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ===== SOCKET SETUP ===== */
  useEffect(() => {
    if (!user) return;

    socket.emit("join", user._id);

    // choose first friend if available
    if (Array.isArray(user.friends) && user.friends.length > 0) {
      setReceiverId(user.friends[0]);
    }

    const handleNewMessage = (msg) => {
      setMessages((m) => [...m, msg]);
    };

    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [user]);

  const send = () => {
    if (!text.trim() || !receiverId) return;

    socket.emit("sendMessage", {
      senderId: user._id,
      receiverId,
      text,
    });

    // optimistic UI
    setMessages((m) => [
      ...m,
      {
        senderId: user._id,
        text,
        senderName: user.name,
        time: Date.now(),
      },
    ]);

    setText("");
  };

  const avatar = (name) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name || "User"
    )}`;

  return (
    <div className="messenger">
      {/* ===== HEADER ===== */}
      <div className="messenger-header">
        <div className="mh-left">
          💬 <b>Messenger</b>
        </div>

        <button className="mh-close" onClick={onClose}>
          ✖
        </button>
      </div>

      {/* ===== BODY ===== */}
      <div className="messenger-messages">
        {messages.length === 0 && (
          <div className="ms-empty">
            Start a conversation
          </div>
        )}

        {messages.map((m, i) => {
          const isMe = m.senderId === user._id;

          return (
            <div
              key={i}
              className={
                isMe ? "message-row me" : "message-row them"
              }
            >
              {!isMe && (
                <img
                  src={avatar(m.senderName)}
                  className="msg-avatar"
                />
              )}

              <div className="msg-bubble">
                {!isMe && (
                  <div className="msg-name">
                    {m.senderName || "User"}
                  </div>
                )}

                <div className="msg-text">{m.text}</div>

                <div className="msg-time">
                  {m.time
                    ? new Date(m.time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* ===== INPUT ===== */}
      <div className="messenger-input">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..."
        />

        <button
          onClick={send}
          disabled={!text.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
