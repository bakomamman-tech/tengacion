import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../pages/admin-analytics.css";

const ADMIN_ITEMS = [
  { key: "overview", label: "Overview", path: "/admin/dashboard" },
  { key: "creator-earnings", label: "Earnings From Creators", path: "/admin/creator-earnings" },
  { key: "users", label: "Users", path: "/admin/users" },
  { key: "content", label: "Content", path: "/admin/content" },
  { key: "messages", label: "Messages", path: "/admin/messages" },
  { key: "campaigns", label: "Campaigns", path: "/admin/campaigns" },
  { key: "raffle", label: "Raffle Cards", path: "/admin/recharge-raffle" },
  { key: "marketplace", label: "Marketplace", path: "/admin/marketplace" },
  { key: "transactions", label: "Transactions", path: "/admin/transactions" },
  { key: "reports", label: "Moderation", path: "/admin/reports" },
  { key: "analytics", label: "Analytics", path: "/admin/analytics" },
  { key: "assistant", label: "Assistant Ops", path: "/admin/assistant" },
  { key: "settings", label: "Settings", path: "/admin/settings" },
  { key: "storage", label: "Storage", path: "/admin/storage" },
];

export default function AdminShell({ title, subtitle = "", user, actions = null, children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const activePath = useMemo(() => {
    if (location.pathname === "/admin") {return "/admin/dashboard";}
    if (location.pathname.startsWith("/admin/creators/")) {return "/admin/content";}
    if (location.pathname.startsWith("/admin/moderation")) {return "/admin/reports";}
    if (location.pathname.startsWith("/admin/assistant")) {return "/admin/assistant";}
    if (location.pathname.startsWith("/admin/storage")) {return "/admin/storage";}
    if (location.pathname.startsWith("/admin/recharge-raffle")) {return "/admin/recharge-raffle";}
    return ADMIN_ITEMS.find((item) => location.pathname.startsWith(item.path))?.path || "/admin/dashboard";
  }, [location.pathname]);

  return (
    <div className="adminx-shell">
      <aside className="adminx-sidebar">
        <div className="adminx-brand" role="button" tabIndex={0} onClick={() => navigate("/admin/dashboard")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") {navigate("/admin/dashboard");} }}>
          <div className="adminx-brand-mark">T</div>
          <div>
            <div className="adminx-brand-name">Tengacion</div>
            <div className="adminx-brand-sub">Admin Console</div>
          </div>
        </div>

        <nav className="adminx-nav">
          {ADMIN_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`adminx-nav-item ${activePath === item.path ? "is-active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="adminx-sidebar-foot">
          <div className="adminx-user-chip">
            <div className="adminx-user-avatar">{String(user?.name || user?.username || "A").slice(0, 1).toUpperCase()}</div>
            <div>
              <div className="adminx-user-name">{user?.name || user?.username || "Admin"}</div>
              <div className="adminx-user-role">{user?.role || "admin"}</div>
            </div>
          </div>
          <button type="button" className="adminx-nav-item adminx-nav-item--ghost" onClick={() => navigate("/home")}>Exit Admin</button>
        </div>
      </aside>

      <main className="adminx-main">
        <header className="adminx-header">
          <div>
            <h1 className="adminx-title">{title}</h1>
            {subtitle ? <p className="adminx-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="adminx-header-actions">{actions}</div> : null}
        </header>

        <section className="adminx-content">{children}</section>
      </main>
    </div>
  );
}
