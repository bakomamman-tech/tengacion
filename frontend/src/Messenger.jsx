import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getChatContacts,
  getConversationMessages,
  resolveImage,
  sendChatMessage,
} from "./api";
import { connectSocket, disconnectSocket } from "./socket";

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=DFE8F6&color=1D3A6D`;

const normalizeMessage = (message) => ({
  _id: toIdString(message?._id),
  senderId: toIdString(message?.senderId),
  receiverId: toIdString(message?.receiverId),
  senderName: message?.senderName || "",
  senderAvatar: resolveImage(message?.senderAvatar || ""),
  text: message?.text || "",
  time:
    message?.time ||
    (message?.createdAt ? new Date(message.createdAt).getTime() : Date.now()),
  clientId: message?.clientId || "",
  pending: Boolean(message?.pending),
  failed: Boolean(message?.failed),
});

const isForConversation = (message, meId, otherId) => {
  const a = toIdString(message.senderId);
  const b = toIdString(message.receiverId);
  return (
    (a === meId && b === otherId) ||
    (a === otherId && b === meId)
  );
};

export default function Messenger({ user, onClose }) {
  const meId = useMemo(() => toIdString(user?._id || user?.id), [user]);
  const token = localStorage.getItem("token");

  const [text, setText] = useState("");
  const [contacts, setContacts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");

  const socketRef = useRef(null);
  const selectedIdRef = useRef("");
  const endRef = useRef(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c._id === selectedId) || null,
    [contacts, selectedId]
  );

  const getAvatar = useCallback(
    (entity) => resolveImage(entity?.avatar) || fallbackAvatar(entity?.name),
    []
  );

  const moveContactToTop = useCallback((contactId, lastMessage, lastMessageAt) => {
    setContacts((prev) => {
      const idx = prev.findIndex((c) => c._id === contactId);
      if (idx === -1) return prev;
      const copy = [...prev];
      const updated = {
        ...copy[idx],
        lastMessage,
        lastMessageAt,
      };
      copy.splice(idx, 1);
      return [updated, ...copy];
    });
  }, []);

  useEffect(() => {
    let alive = true;

    const loadContacts = async () => {
      if (!meId) return;
      setLoadingContacts(true);
      setError("");

      try {
        const data = await getChatContacts();
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        setContacts(list);
        setSelectedId((prev) => prev || list[0]?._id || "");
      } catch (err) {
        if (!alive) return;
        setContacts([]);
        setError(err.message || "Failed to load contacts");
      } finally {
        if (alive) setLoadingContacts(false);
      }
    };

    loadContacts();

    return () => {
      alive = false;
    };
  }, [meId]);

  useEffect(() => {
    let alive = true;

    const loadConversation = async () => {
      if (!selectedId) {
        setMessages([]);
        return;
      }

      setLoadingMessages(true);
      setError("");

      try {
        const data = await getConversationMessages(selectedId);
        if (!alive) return;
        const next = Array.isArray(data) ? data.map(normalizeMessage) : [];
        setMessages(next);
      } catch (err) {
        if (!alive) return;
        setMessages([]);
        setError(err.message || "Failed to load messages");
      } finally {
        if (alive) setLoadingMessages(false);
      }
    };

    loadConversation();

    return () => {
      alive = false;
    };
  }, [selectedId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!meId || !token) return undefined;

    const socket = connectSocket({ token, userId: meId });
    if (!socket) return undefined;
    socketRef.current = socket;

    const handleOnlineUsers = (ids = []) => {
      setOnlineUsers(new Set(ids.map((id) => toIdString(id))));
    };

    const handleIncomingMessage = (rawMessage) => {
      const message = normalizeMessage(rawMessage);
      const activeContactId = selectedIdRef.current;

      if (isForConversation(message, meId, activeContactId)) {
        setMessages((prev) => {
          const byServerId =
            message._id && prev.some((m) => m._id && m._id === message._id);
          if (byServerId) return prev;

          const optimisticIndex =
            message.clientId
              ? prev.findIndex((m) => m.clientId === message.clientId)
              : -1;

          if (optimisticIndex >= 0) {
            const next = [...prev];
            next[optimisticIndex] = { ...message, pending: false, failed: false };
            return next;
          }

          return [...prev, message];
        });
      }

      const otherId =
        toIdString(message.senderId) === meId
          ? toIdString(message.receiverId)
          : toIdString(message.senderId);
      moveContactToTop(otherId, message.text, message.time);
    };

    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("newMessage", handleIncomingMessage);

    return () => {
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("newMessage", handleIncomingMessage);
      disconnectSocket();
      socketRef.current = null;
    };
  }, [meId, token, moveContactToTop]);

  const replaceMessageByClientId = useCallback((clientId, patch) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.clientId === clientId ? { ...m, ...patch } : m
      )
    );
  }, []);

  const sendViaSocket = useCallback(
    (receiverId, textValue, clientId) =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) {
          reject(new Error("Socket unavailable"));
          return;
        }

        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("Socket timeout"));
          }
        }, 6000);

        socket.emit(
          "sendMessage",
          { receiverId, text: textValue, clientId },
          (ack) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);

            if (ack?.ok && ack.message) {
              resolve(normalizeMessage(ack.message));
              return;
            }

            reject(new Error(ack?.error || "Socket send failed"));
          }
        );
      }),
    []
  );

  const send = async () => {
    const value = text.trim();
    if (!value || !selectedId || !meId) return;

    const now = Date.now();
    const clientId = `c_${now}_${Math.random().toString(36).slice(2, 8)}`;

    const optimistic = normalizeMessage({
      _id: clientId,
      senderId: meId,
      receiverId: selectedId,
      senderName: user?.name || "",
      text: value,
      time: now,
      clientId,
      pending: true,
    });

    setMessages((prev) => [...prev, optimistic]);
    moveContactToTop(selectedId, value, now);
    setText("");
    setError("");

    try {
      const persisted = await sendViaSocket(selectedId, value, clientId);
      replaceMessageByClientId(clientId, {
        ...persisted,
        pending: false,
        failed: false,
      });
      return;
    } catch {
      // Fallback to REST if socket delivery fails.
    }

    try {
      const persisted = await sendChatMessage(selectedId, value, clientId);
      replaceMessageByClientId(clientId, {
        ...normalizeMessage(persisted),
        pending: false,
        failed: false,
      });
    } catch (err) {
      replaceMessageByClientId(clientId, {
        pending: false,
        failed: true,
      });
      setError(err.message || "Failed to send message");
    }
  };

  return (
    <div className="messenger">
      <div className="messenger-header">
        <div className="mh-left">
          <strong>Messenger</strong>
        </div>
        <button className="mh-close" onClick={onClose} aria-label="Close chat">
          x
        </button>
      </div>

      <div className="messenger-body">
        <aside className="messenger-threads">
          <div className="threads-title">Chats</div>

          {loadingContacts && <div className="threads-state">Loading chats...</div>}

          {!loadingContacts && contacts.length === 0 && (
            <div className="threads-state">No active conversations.</div>
          )}

          {!loadingContacts &&
            contacts.map((contact) => {
              const active = contact._id === selectedId;
              return (
                <button
                  key={contact._id}
                  className={`thread-item ${active ? "active" : ""}`}
                  onClick={() => setSelectedId(contact._id)}
                >
                  <div className="thread-avatar-wrap">
                    <img src={getAvatar(contact)} className="thread-avatar" alt="" />
                    {onlineUsers.has(contact._id) && <span className="online-dot" />}
                  </div>

                  <div className="thread-meta">
                    <div className="thread-name">{contact.name || contact.username}</div>
                    <div className="thread-last">
                      {contact.lastMessage || "Start chatting"}
                    </div>
                  </div>
                </button>
              );
            })}
        </aside>

        <section className="messenger-chat">
          {!selectedContact && (
            <div className="chat-empty">Select a chat to start messaging.</div>
          )}

          {selectedContact && (
            <>
              <div className="chat-topbar">
                <img src={getAvatar(selectedContact)} alt="" className="chat-top-avatar" />
                <div>
                  <div className="chat-top-name">
                    {selectedContact.name || selectedContact.username}
                  </div>
                  <div className="chat-top-status">
                    {onlineUsers.has(selectedContact._id) ? "Online" : "Offline"}
                  </div>
                </div>
              </div>

              <div className="messenger-messages">
                {loadingMessages && <div className="ms-empty">Loading messages...</div>}

                {!loadingMessages && messages.length === 0 && (
                  <div className="ms-empty">No messages yet. Say hello.</div>
                )}

                {!loadingMessages &&
                  messages.map((m) => {
                    const isMe = toIdString(m.senderId) === meId;
                    const bubbleClass = `${isMe ? "me" : "them"} ${
                      m.failed ? "failed" : ""
                    }`;
                    return (
                      <div key={m._id || m.clientId} className={`message-row ${bubbleClass}`}>
                        {!isMe && (
                          <img
                            src={m.senderAvatar || getAvatar(selectedContact)}
                            className="msg-avatar"
                            alt=""
                          />
                        )}

                        <div className="msg-bubble">
                          <div className="msg-text">{m.text}</div>
                          <div className="msg-time">
                            {new Date(m.time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {m.pending ? " • Sending" : ""}
                            {m.failed ? " • Failed" : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                <div ref={endRef} />
              </div>

              <div className="messenger-input">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Type a message..."
                />

                <button onClick={send} disabled={!text.trim()}>
                  Send
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {error && <div className="messenger-error">{error}</div>}
    </div>
  );
}
