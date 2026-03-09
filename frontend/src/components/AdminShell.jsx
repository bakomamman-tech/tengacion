import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../pages/admin-analytics.css";

const ADMIN_ITEMS = [
  { key: "overview", label: "Overview", path: "/admin" },
  { key: "users", label: "Users", path: "/admin/users" },
  { key: "content", label: "Content", path: "/admin/content" },
  { key: "transactions", label: "Transactions", path: "/admin/transactions" },
  { key: "reports", label: "Reports", path: "/admin/reports" },
  { key: "analytics", label: "Analytics", path: "/admin/analytics" },
];

export default function AdminShell({ title, subtitle = "", user, actions = null, children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const activePath = useMemo(() => {
    if (location.pathname === "/admin") return "/admin";
    if (location.pathname.startsWith("/admin/creators/")) return "/admin/content";
    return ADMIN_ITEMS.find((item) => location.pathname.startsWith(item.path))?.path || "/admin";
  }, [location.pathname]);

  return (
    <div className="adminx-shell">
      <aside className="adminx-sidebar">
        <div className="adminx-brand" role="button" tabIndex={0} onClick={() => navigate("/admin")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate("/admin"); }}>
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
