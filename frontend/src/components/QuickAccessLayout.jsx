import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import Messenger from "../Messenger";
import FriendRequests from "../FriendRequests";
import RightQuickNav from "./RightQuickNav";
import { resolveImage } from "../api";

export default function QuickAccessLayout({
  user,
  title,
  subtitle,
  children,
  showAppSidebar = true,
  showRightRail = true,
  showHero = true,
  shellClassName = "",
  mainClassName = "",
}) {
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatDockMeta, setChatDockMeta] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState("");

  const logout = () => {
    navigate("/");
  };

  const shellClasses = [
    "app-shell",
    "quick-access-shell",
    !showAppSidebar && !showRightRail ? "quick-access-shell--solo" : "",
    !showAppSidebar && showRightRail ? "quick-access-shell--no-left" : "",
    showAppSidebar && !showRightRail ? "quick-access-shell--no-right" : "",
    shellClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const mainClasses = ["feed", "quick-access-main", mainClassName].filter(Boolean).join(" ");

  const messengerPanel = chatOpen ? (
    <section className="messenger-panel">
      <Messenger
        user={user}
        initialSelectedId={selectedChatId}
        conversationOnly={Boolean(selectedChatId)}
        onClose={() => {
          setSelectedChatId("");
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
  ) : null;

  const messengerDock = !chatOpen && chatMinimized ? (
    <button
      type="button"
      className={`messenger-dock${showRightRail ? "" : " messenger-dock--floating"}`}
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
  ) : null;

  return (
    <>
      <Navbar
        user={user}
        onLogout={logout}
        onOpenMessenger={(payload = {}) => {
          setSelectedChatId(String(payload?.contactId || ""));
          if (payload?.contact) {
            setChatDockMeta({
              name: payload.contact?.name || payload.contact?.username || "Messenger",
              avatar: payload.contact?.avatar || "",
            });
          }
          setChatOpen(true);
          setChatMinimized(false);
        }}
        onOpenCreatePost={(target = "post") => {
          if (target === "story") {
            navigate("/home", { state: { openStoryCreator: true } });
            return;
          }

          navigate("/home", {
            state: {
              openComposer: true,
              composerMode: target === "reel" ? "reel" : "",
            },
          });
        }}
      />

      <div className={shellClasses}>
        {showAppSidebar ? (
          <aside className="sidebar">
            <Sidebar
              user={user}
              openChat={() => {
                setSelectedChatId("");
                setChatOpen(true);
                setChatMinimized(false);
              }}
              openProfile={() => navigate(`/profile/${user?.username}`)}
            />
          </aside>
        ) : null}

        <main className={mainClasses}>
          {showHero ? (
            <section className="card quick-access-hero">
              <div>
                <h1>{title}</h1>
                <p>{subtitle}</p>
              </div>
            </section>
          ) : null}
          {children}
        </main>

        {showRightRail ? (
          <aside className="home-right-rail quick-access-rail">
            <RightQuickNav />
            <FriendRequests />
            {messengerPanel}
            {messengerDock}
          </aside>
        ) : null}
      </div>

      {!showRightRail ? messengerPanel : null}
      {!showRightRail ? messengerDock : null}
    </>
  );
}
