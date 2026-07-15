import { NavLink } from "react-router-dom";

import AdminAvatar from "./AdminAvatar";
import AdminDashboardIcon from "./AdminDashboardIcon";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "dashboard", path: "/admin/dashboard" },
      { key: "analytics", label: "Analytics", icon: "analytics", path: "/admin/analytics", dotKey: "analytics" },
      { key: "assurance", label: "Assurance", icon: "analytics", path: "/admin/assurance" },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "assistant", label: "Assistant Ops", icon: "spark", path: "/admin/assistant", dotKey: "assistant" },
      { key: "posts", label: "Posts", icon: "posts", path: "/admin/content", dotKey: "content" },
      { key: "users", label: "Users", icon: "users", path: "/admin/users" },
      { key: "messages", label: "Messages", icon: "messages", path: "/admin/messages", dotKey: "messages" },
      { key: "campaigns", label: "Campaigns", icon: "campaigns", path: "/admin/campaigns", dotKey: "campaigns" },
      { key: "top-up-promo", label: "Top-Up Bank Account Promo", icon: "spark", path: "/admin/top-up-bank-account-promo" },
    ],
  },
  {
    label: "Finance & programs",
    items: [
      { key: "creator-earnings", label: "Creator Earnings", icon: "finance", path: "/admin/creator-earnings" },
      { key: "tuition-payments", label: "Tuition Payments", icon: "finance", path: "/admin/tuition-payments" },
      { key: "raffle", label: "Raffle Cards", icon: "spark", path: "/admin/recharge-raffle" },
    ],
  },
  {
    label: "System",
    items: [
      { key: "settings", label: "Settings", icon: "settings", path: "/admin/settings", dotKey: "settings" },
      { key: "storage", label: "Storage", icon: "settings", path: "/admin/storage" },
    ],
  },
];

export default function AdminSidebar({
  activeKey = "dashboard",
  adminName = "Admin User",
  avatarSrc = "",
  navDots = {},
  onClose,
  roleLabel = "Admin",
}) {
  return (
    <aside className="tdash-sidebar">
      <div className="tdash-sidebar__brand">
        <span className="tdash-sidebar__brand-mark">
          <AdminDashboardIcon name="dashboard" size={20} />
        </span>
        <div>
          <p className="tdash-sidebar__eyebrow">Tengacion</p>
          <h1 className="tdash-sidebar__title">Admin Dashboard</h1>
        </div>
      </div>

      <nav className="tdash-sidebar__nav" aria-label="Admin dashboard sections">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="tdash-sidebar__group">
            <div className="tdash-sidebar__group-label">{group.label}</div>
            <div className="tdash-sidebar__group-items">
              {group.items.map((item) => {
                const dotActive = item.dotKey ? Boolean(navDots[item.dotKey]) : false;

                return (
                  <NavLink
                    key={item.key}
                    to={item.path}
                    className={({ isActive }) =>
                      `tdash-sidebar__item ${isActive || activeKey === item.key ? "is-active" : ""}`
                    }
                    onClick={onClose}
                  >
                    <span className="tdash-sidebar__item-icon">
                      <AdminDashboardIcon name={item.icon} size={18} />
                    </span>
                    <span className="tdash-sidebar__item-label">{item.label}</span>
                    {dotActive ? <span className="tdash-sidebar__dot" aria-label="Needs attention" /> : null}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="tdash-sidebar__footer">
        <div className="tdash-sidebar__profile">
          <AdminAvatar name={adminName} src={avatarSrc} size={46} status />
          <div>
            <div className="tdash-sidebar__profile-name">{adminName}</div>
            <div className="tdash-sidebar__profile-role">{roleLabel}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
