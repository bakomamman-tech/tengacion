import AdminAvatar from "./AdminAvatar";
import AdminDashboardIcon from "./AdminDashboardIcon";

export default function AdminHeader({
  title = "Dashboard",
  secondaryText = "Platform oversight",
  notificationCount = 0,
  avatarSrc = "",
  onToggleSidebar,
}) {
  return (
    <header className="tdash-header">
      <div className="tdash-header__title-wrap">
        <button type="button" className="tdash-header__menu" onClick={onToggleSidebar} aria-label="Open navigation">
          <AdminDashboardIcon name="menu" size={18} />
        </button>
        <div>
          <h2 className="tdash-header__title">{title}</h2>
        </div>
      </div>

      <div className="tdash-header__actions">
        <button type="button" className="tdash-header__icon-btn" aria-label="Search dashboard">
          <AdminDashboardIcon name="search" size={18} />
        </button>
        <button type="button" className="tdash-header__icon-btn tdash-header__icon-btn--alert" aria-label="Notifications">
          <AdminDashboardIcon name="bell" size={18} />
          {notificationCount ? <span className="tdash-header__badge">{notificationCount}</span> : null}
        </button>

        <div className="tdash-header__profile">
          <AdminAvatar name="Admin User" src={avatarSrc} size={44} />
          <div className="tdash-header__profile-copy">
            <div className="tdash-header__profile-name">Admin User</div>
            <div className="tdash-header__profile-sub">{secondaryText}</div>
          </div>
          <AdminDashboardIcon name="chevronDown" size={16} className="tdash-header__chevron" />
        </div>
      </div>
    </header>
  );
}
