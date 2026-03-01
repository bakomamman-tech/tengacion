import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import Messenger from "../Messenger";
import FriendRequests from "../FriendRequests";
import RightQuickNav from "./RightQuickNav";
import { resolveImage } from "../api";

export default function QuickAccessLayout({ user, title, subtitle, children }) {
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatDockMeta, setChatDockMeta] = useState(null);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <>
      <Navbar
        user={user}
        onLogout={logout}
        onOpenMessenger={() => {
          setChatOpen(true);
          setChatMinimized(false);
        }}
        onOpenCreatePost={() => navigate("/home", { state: { openComposer: true } })}
      />

      <div className="app-shell quick-access-shell">
        <aside className="sidebar">
          <Sidebar
            user={user}
            openChat={() => {
              setChatOpen(true);
              setChatMinimized(false);
            }}
            openProfile={() => navigate(`/profile/${user?.username}`)}
          />
        </aside>

        <main className="feed quick-access-main">
          <section className="card quick-access-hero">
            <div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
          </section>
          {children}
        </main>

        <aside className="home-right-rail quick-access-rail">
          <RightQuickNav />
          <FriendRequests />

          {chatOpen && (
            <section className="messenger-panel">
              <Messenger
                user={user}
                onClose={() => {
                  setChatOpen(false);
                  setChatMinimized(false);
                }}
                onMinimize={(meta) => {
                  setChatDockMeta(meta || null);
                  setChatOpen(false);
                  setChatMinimized(true);
                }}
              />
            </section>
          )}
          {!chatOpen && chatMinimized && (
            <button
              type="button"
              className="messenger-dock"
              onClick={() => {
                setChatOpen(true);
                setChatMinimized(false);
              }}
              title="Restore chat"
            >
              <img
                src={
                  resolveImage(chatDockMeta?.avatar) ||
                  resolveImage(user?.avatar) ||
                  "/avatar.png"
                }
                alt=""
              />
              <span>{chatDockMeta?.name || "Messenger"}</span>
            </button>
          )}
        </aside>
      </div>
    </>
  );
}
