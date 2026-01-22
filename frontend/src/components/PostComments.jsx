import { useState } from "react";

export default function PostComments({ postId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;

    const newComment = {
      id: Date.now(),
      user: "you",
      text,
    };

    setComments((prev) => [...prev, newComment]);
    setText("");
  };

  return (
    <div className="comments">
      {comments.map((c) => (
        <div key={c.id} className="comment">
          <b>{c.user}</b> {c.text}
        </div>
      ))}

      <div className="comment-input">
        <img src="/avatar.png" alt="me" />
        <input
          placeholder="Write a comment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>
    </div>
  );
}
