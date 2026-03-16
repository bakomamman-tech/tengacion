import { NavLink } from "react-router-dom";

import { CREATOR_CATEGORY_CONFIG, CREATOR_CATEGORY_ORDER, CREATOR_STATIC_NAV, normalizeCreatorLaneKeys } from "./creatorConfig";

export default function CreatorSidebar({ creatorProfile, mobileOpen = false, onNavigate }) {
  const enabledLanes = normalizeCreatorLaneKeys(creatorProfile?.creatorTypes);
  const enabledCategories = CREATOR_CATEGORY_ORDER.filter((key) =>
    enabledLanes.includes(key)
  );

  return (
    <aside className={`creator-sidebar ${mobileOpen ? "is-open" : ""}`}>
      <div className="creator-sidebar-brand">
        <div className="creator-sidebar-logo">T</div>
        <div className="creator-sidebar-brand-copy">
          <strong>Tengacion</strong>
          <span>Creator Workspace</span>
        </div>
      </div>

      <nav className="creator-sidebar-nav" aria-label="Creator workspace navigation">
        <div className="creator-sidebar-group">
          <span className="creator-sidebar-label">Workspace</span>
          <NavLink to="/creator/dashboard" className="creator-sidebar-link" onClick={onNavigate}>
            Overview
          </NavLink>
          <NavLink to="/creator/categories" className="creator-sidebar-link" onClick={onNavigate}>
            Content Categories
          </NavLink>
          {enabledCategories.map((key) => (
            <NavLink
              key={key}
              to={CREATOR_CATEGORY_CONFIG[key].route}
              className="creator-sidebar-link"
              onClick={onNavigate}
            >
              {CREATOR_CATEGORY_CONFIG[key].shortTitle}
            </NavLink>
          ))}
        </div>

        <div className="creator-sidebar-group">
          <span className="creator-sidebar-label">Account</span>
          {CREATOR_STATIC_NAV.filter((item) => item.key !== "dashboard").map((item) => (
            <NavLink
              key={item.key}
              to={item.route}
              className="creator-sidebar-link"
              onClick={onNavigate}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  );
}
