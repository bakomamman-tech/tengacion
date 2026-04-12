import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import Messenger from "../Messenger";

export default function MessagesPage({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedChatId = String(searchParams.get("chat") || "").trim();

  const syncSelectedChat = useCallback(
    (nextChatId = "") => {
      const normalizedNext = String(nextChatId || "").trim();
      if (normalizedNext === selectedChatId) {
        return;
      }

      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        if (normalizedNext) {
          params.set("chat", normalizedNext);
        } else {
          params.delete("chat");
        }
        return params;
      });
    },
    [selectedChatId, setSearchParams]
  );

  const closeMessages = useCallback(() => {
    navigate("/home", { replace: true });
  }, [navigate]);

  const minimizeMessages = useCallback(() => {
    navigate("/home", {
      replace: true,
      state: {
        openMessenger: true,
        messengerTargetId: selectedChatId,
      },
    });
  }, [navigate, selectedChatId]);

  return (
    <>
      <Navbar user={user} />

      <div className="app-shell messages-page-shell">
        <aside className="sidebar">
          <Sidebar user={user} />
        </aside>

        <main className="feed messages-page">
          <section className="messenger-panel messenger-panel--inline messages-page__panel">
            <Messenger
              user={user}
              initialSelectedId={selectedChatId}
              conversationOnly={false}
              autoSelectFirstConversation={false}
              onSelectedConversationChange={syncSelectedChat}
              onClose={closeMessages}
              onMinimize={minimizeMessages}
            />
          </section>
        </main>
      </div>
    </>
  );
}
