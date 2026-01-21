import { useEffect, useState, useRef } from "react";
import { connectSocket, disconnectSocket } from "./socket";

export default function Messenger({ user, onClose }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [receiverId, setReceiverId] = useState(null);

  const socketRef = useRef(null);
  const endRef = useRef(null);

  /* ===== AUTO SCROLL ===== */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ===== SOCKET LIFECYCLE (FACEBOOK STYLE) ===== */
  useEffect(() => {
    if (!user?._id) return;

    const socket = connectSocket({
      token: localStorage.getItem("token"),
      userId: user._id,
    });

    socketRef.current = socket;

    // Choose first friend (temporary until chat list exists)
    if (Array.isArray(user.friends) && user.friends.length > 0) {
      setReceiverId(user.friends[0]);
    }

    const handleMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket?.on("newMessage", handleMessage);

    return () => {
      socket?.off("newMessage", handleMessage);
      disconnectSocket();
      socketRef.current = null;
    };
  }, [user]);

  /* ===== SEND MESSAGE ===== */
  const send = () => {
    if (!text.trim() || !receiverId || !socketRef.current) return;

    const payload = {
      senderId: user._id,
      receiverId,
      text,
      time: Date.now(),
      senderName: user.name,
    };

    socketRef.current.emit("sendMessage", payload);

    // Optimistic UI (Facebook-style)
    setMessages((prev) => [...prev, payload]);
    setText("");
  };

  const avatar = (name) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name || "User"
    )}&size=48`;

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

      {/* ===== MESSAGES ===== */}
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
              className={`message-row ${isMe ? "me" : "them"}`}
            >
              {!isMe && (
                <img
                  src={avatar(m.senderName)}
                  className="msg-avatar"
                  alt=""
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
                  {new Date(m.time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
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
          placeholder="Type a message…"
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
