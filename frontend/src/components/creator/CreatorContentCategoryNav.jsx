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
            className={({ isActive }) =>
              `creator-content-category-link${isActive ? " active" : ""}${enabled ? "" : " is-disabled"}`
            }
          >
            <span className="creator-content-category-link__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="creator-content-category-link__copy">
              <strong>{getNavLabel(key)}</strong>
              <small>{enabled ? item.uploadDescription : "Enable this lane to open its dedicated publishing studio."}</small>
            </span>
            <span className={`creator-status-badge ${enabled ? "success" : "neutral"}`}>
              {enabled ? "Ready" : "Disabled"}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
