import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import AdminAvatar from "./AdminAvatar";
import AdminDashboardIcon from "./AdminDashboardIcon";

const defaultQuickLinks = [
  { id: "dashboard", label: "Dashboard", description: "Live admin overview", path: "/admin/dashboard" },
  { id: "analytics", label: "Analytics", description: "Deep analytics board", path: "/admin/analytics" },
  { id: "users", label: "Users", description: "Manage platform users", path: "/admin/users" },
  { id: "posts", label: "Posts", description: "Review platform posts and uploads", path: "/admin/content" },
  { id: "messages", label: "Messages", description: "Monitor message traffic", path: "/admin/messages" },
  { id: "campaigns", label: "Campaigns", description: "Revenue and creator performance", path: "/admin/campaigns" },
  { id: "settings", label: "Settings", description: "Security and admin controls", path: "/admin/settings" },
  { id: "storage", label: "Storage", description: "Inspect collection sizes and cleanup actions", path: "/admin/storage" },
];

export default function AdminHeader({
  title = "Dashboard",
  secondaryText = "Platform oversight",
  notificationCount = 0,
  avatarSrc = "",
  adminName = "Admin User",
  onToggleSidebar,
  notifications = [],
  quickLinks = defaultQuickLinks,
}) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [openPanel, setOpenPanel] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpenPanel("");
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const filteredLinks = useMemo(() => {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) {
      return quickLinks;
    }
    return quickLinks.filter((item) =>
      [item.label, item.description].some((value) =>
        String(value || "").toLowerCase().includes(normalizedQuery)
      )
    );
  }, [query, quickLinks]);

  const runNavigation = (path) => {
    if (!path) {return;}
    setOpenPanel("");
    navigate(path);
  };

  return (
    <header ref={rootRef} className="tdash-header">
      <div className="tdash-header__title-wrap">
        <button type="button" className="tdash-header__menu" onClick={onToggleSidebar} aria-label="Open navigation">
          <AdminDashboardIcon name="menu" size={18} />
        </button>
        <div>
          <h2 className="tdash-header__title">{title}</h2>
        </div>
      </div>

      <div className="tdash-header__actions">
        <div className="tdash-header__action-wrap">
          <button
            type="button"
            className="tdash-header__icon-btn"
            aria-label="Search admin dashboard"
            onClick={() => setOpenPanel((current) => (current === "search" ? "" : "search"))}
          >
            <AdminDashboardIcon name="search" size={18} />
          </button>
          {openPanel === "search" ? (
            <div className="tdash-popover tdash-popover--search" role="dialog" aria-label="Dashboard search">
              <input
                className="tdash-popover__input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search admin destinations"
                autoFocus
              />
              <div className="tdash-popover__list">
                {filteredLinks.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="tdash-popover__item"
                    onClick={() => runNavigation(item.path)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </button>
                ))}
                {!filteredLinks.length ? (
                  <div className="tdash-popover__empty">No matching admin destinations.</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="tdash-header__action-wrap">
          <button
            type="button"
            className="tdash-header__icon-btn tdash-header__icon-btn--alert"
            aria-label="Notifications"
            onClick={() => setOpenPanel((current) => (current === "alerts" ? "" : "alerts"))}
          >
            <AdminDashboardIcon name="bell" size={18} />
            {notificationCount ? <span className="tdash-header__badge">{notificationCount}</span> : null}
          </button>
          {openPanel === "alerts" ? (
            <div className="tdash-popover" role="dialog" aria-label="Admin notifications">
              <div className="tdash-popover__title">Alerts</div>
              <div className="tdash-popover__list">
                {notifications.map((alert) => (
                  <button
                    key={alert.key}
                    type="button"
                    className="tdash-popover__item"
                    onClick={() => runNavigation(alert.actionPath || "/admin/analytics")}
                  >
                    <strong>{alert.title}</strong>
                    <span>{alert.severity} priority</span>
                  </button>
                ))}
                {!notifications.length ? (
                  <div className="tdash-popover__empty">No active admin alerts.</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="tdash-header__action-wrap">
          <button
            type="button"
            className="tdash-header__profile"
            onClick={() => setOpenPanel((current) => (current === "profile" ? "" : "profile"))}
            aria-label="Open admin profile menu"
          >
            <AdminAvatar name={adminName} src={avatarSrc} size={44} />
            <div className="tdash-header__profile-copy">
              <div className="tdash-header__profile-name">{adminName}</div>
              <div className="tdash-header__profile-sub">{secondaryText}</div>
            </div>
            <AdminDashboardIcon name="chevronDown" size={16} className="tdash-header__chevron" />
          </button>
          {openPanel === "profile" ? (
            <div className="tdash-popover tdash-popover--profile" role="menu" aria-label="Admin profile menu">
              <button type="button" className="tdash-popover__item" onClick={() => runNavigation("/admin/analytics")}>
                <strong>Open Analytics</strong>
                <span>Review platform metrics</span>
              </button>
              <button type="button" className="tdash-popover__item" onClick={() => runNavigation("/admin/settings")}>
                <strong>Admin Settings</strong>
                <span>Security and system controls</span>
              </button>
              <button type="button" className="tdash-popover__item" onClick={() => runNavigation("/home")}>
                <strong>Exit Admin</strong>
                <span>Return to the main app</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
