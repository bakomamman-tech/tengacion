import { NavLink } from "react-router-dom";

import { CREATOR_CATEGORY_CONFIG, CREATOR_CATEGORY_ORDER, normalizeCreatorLaneKeys } from "./creatorConfig";

const getNavLabel = (key) => {
  if (key === "bookPublishing") {
    return "Book Publishing Uploads";
  }
  return `${CREATOR_CATEGORY_CONFIG[key]?.shortTitle || key} Uploads`;
};

export default function CreatorContentCategoryNav({ creatorTypes = [] }) {
  const enabledCategories = normalizeCreatorLaneKeys(creatorTypes);

  return (
    <nav className="creator-content-category-nav" aria-label="Content categories">
      {CREATOR_CATEGORY_ORDER.map((key) => {
        const item = CREATOR_CATEGORY_CONFIG[key];
        const enabled = enabledCategories.includes(key);

        return (
          <NavLink
            key={key}
            to={enabled ? item.uploadRoute : "/creator/categories"}
            style={{
              "--creator-category-accent":
                item.accent || "var(--creator-accent)",
            }}
            className={({ isActive }) =>
              `creator-content-category-link${isActive ? " active" : ""}${enabled ? "" : " is-disabled"}`
            }
          >
            <span className="creator-content-category-link__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="creator-content-category-link__copy">
              <span className="creator-content-category-link__eyebrow">
                {enabled ? "Publishing studio" : "Activation required"}
              </span>
              <strong>{getNavLabel(key)}</strong>
              <small>{enabled ? item.uploadDescription : "Enable this lane to open its dedicated publishing studio."}</small>
            </span>
            <span className="creator-content-category-link__meta">
              <span className={`creator-status-badge ${enabled ? "success" : "neutral"}`}>
                {enabled ? "Ready" : "Disabled"}
              </span>
              <span
                className="creator-content-category-link__trail"
                aria-hidden="true"
              >
                <span className="creator-content-category-link__intent">
                  {enabled ? "Open studio" : "Enable lane"}
                </span>
                <span className="creator-content-category-link__chevron">
                  &gt;
                </span>
              </span>
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
