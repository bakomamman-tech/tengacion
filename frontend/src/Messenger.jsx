import { useEffect, useState } from "react";
import socket from "./socket";

export default function Messenger({ user, onClose }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [receiverId, setReceiverId] = useState(null);

  useEffect(() => {
    if (!user) return;

    socket.emit("join", user._id);

    if (user.friends && user.friends.length > 0) {
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
      text
    });

    setText("");
  };

  return (
    <div className="messenger">
      <div className="messenger-header">
        <span>💬 Messenger</span>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            color: "inherit",
            fontSize: 18,
            border: "none",
            cursor: "pointer"
          }}
        >
          ✖
        </button>
      </div>

      <div className="messenger-messages">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.senderId === user._id ? "message-me" : "message-them"}
          >
            <b>{m.senderName || "User"}</b>
            <div>{m.text}</div>
          </div>
        ))}
      </div>

      <div className="messenger-input">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..."
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
