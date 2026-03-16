import { NavLink, useLocation } from "react-router-dom";
import { resolveImage } from "../../api";

import { CREATOR_CATEGORY_CONFIG, CREATOR_CATEGORY_ORDER, CREATOR_STATIC_NAV, normalizeCreatorLaneKeys } from "./creatorConfig";

const getUploadNavLabel = (key) => `${CREATOR_CATEGORY_CONFIG[key]?.shortTitle || key} Uploads`;

export default function CreatorSidebar({ creatorProfile, mobileOpen = false, onNavigate }) {
  const location = useLocation();
  const avatarSrc =
    resolveImage(creatorProfile?.user?.avatar || "") ||
    resolveImage(creatorProfile?.coverImageUrl || "") ||
    "";
  const creatorName = creatorProfile?.displayName || creatorProfile?.fullName || "Creator";
  const enabledLanes = normalizeCreatorLaneKeys(creatorProfile?.creatorTypes);
  const enabledCategories = CREATOR_CATEGORY_ORDER.filter((key) =>
    enabledLanes.includes(key)
  );
  const isCategorySectionActive =
    location.pathname.startsWith("/creator/categories") ||
    enabledCategories.some(
      (key) =>
        location.pathname.startsWith(CREATOR_CATEGORY_CONFIG[key].route) ||
        location.pathname.startsWith(CREATOR_CATEGORY_CONFIG[key].uploadRoute)
    );

  return (
    <aside className={`creator-sidebar ${mobileOpen ? "is-open" : ""}`}>
      <div className="creator-sidebar-brand">
        <div className="creator-sidebar-logo">
          {avatarSrc ? <img src={avatarSrc} alt={creatorName} /> : creatorName.slice(0, 1).toUpperCase()}
        </div>
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
          <div className="creator-sidebar-tree" role="group" aria-label="Content Categories">
            <NavLink
              to="/creator/categories"
              className={`creator-sidebar-link creator-sidebar-link--parent${isCategorySectionActive ? " active" : ""}`}
              onClick={onNavigate}
            >
              Content Categories
            </NavLink>
            {enabledCategories.length ? (
              <div className="creator-sidebar-submenu">
                {enabledCategories.map((key) => (
                  <NavLink
                    key={key}
                    to={CREATOR_CATEGORY_CONFIG[key].uploadRoute}
                    className="creator-sidebar-link creator-sidebar-link--child"
                    onClick={onNavigate}
                  >
                    {getUploadNavLabel(key)}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>
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
