const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </svg>
);

function MenuIcon({ name }) {
  switch (name) {
    case "ads":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 13.5h4.2l7.6-4.4v9.8l-7.6-4.4H4z" />
          <path d="M8.2 13.7l1.8 4.4" />
        </svg>
      );
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <path d="M8 15.5v-4.2M12 15.5V9.5M16 15.5V7.2" />
        </svg>
      );
    case "creator":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.6l2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.6-5 2.6.9-5.5-4-3.9 5.6-.8z" />
        </svg>
      );
    case "friends":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="9" r="3" />
          <circle cx="16.6" cy="10.3" r="2.6" />
          <path d="M3.8 19a5.3 5.3 0 0 1 10.4 0" />
          <path d="M13.2 19a4.5 4.5 0 0 1 7 0" />
        </svg>
      );
    case "groups":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="9.2" r="2.8" />
          <circle cx="16.2" cy="9.2" r="2.8" />
          <path d="M3.6 19.4a4.8 4.8 0 0 1 8.8 0" />
          <path d="M11.6 19.4a4.8 4.8 0 0 1 8.8 0" />
        </svg>
      );
    case "events":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M4 9.2h16M8 3.8v3M16 3.8v3M8.5 13h3.4v3.4H8.5z" />
        </svg>
      );
    case "birthdays":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 10.5h14v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5z" />
          <path d="M4.5 10.5h15M12 10.5v10M12 6.2c-1.8 0-3-.8-3-2.1a1.8 1.8 0 0 1 3-1.3M12 6.2c1.8 0 3-.8 3-2.1a1.8 1.8 0 0 0-3-1.3" />
        </svg>
      );
    case "saved":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v13L12 15.4 5.5 19V6A1.5 1.5 0 0 1 7 4.5z" />
        </svg>
      );
    case "home":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 10.5L12 4l8 6.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-4.3v-6.2H9.8v6.2H5.5A1.5 1.5 0 0 1 4 19z" />
        </svg>
      );
    case "trending":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 17.5l5-5 3.2 3.2 5.8-7.2" />
          <path d="M14.4 8.5H19v4.6" />
        </svg>
      );
    case "live":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="8" width="8" height="8" rx="2" />
          <path d="M16 10.2l3-1.8v7.2l-3-1.8M4.4 7.8a7.3 7.3 0 0 0 0 8.4M19.6 7.8a7.3 7.3 0 0 1 0 8.4" />
        </svg>
      );
    case "gaming":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7.4 7.4h9.2a4 4 0 0 1 3.8 5l-1.2 4.1a2.7 2.7 0 0 1-4.8.8L12 14.2l-2.4 3.1a2.7 2.7 0 0 1-4.8-.8l-1.2-4.1a4 4 0 0 1 3.8-5z" />
          <path d="M8.2 11.2h2.8M9.6 9.8v2.8M16.3 10.8h.1M18 12.5h.1" />
        </svg>
      );
    case "reels":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="4.5" width="14" height="15" rx="3" />
          <path d="M8.2 4.5l2.7 4M13.1 4.5l2.7 4M5 8.5h14M10.2 11.4l4.6 2.6-4.6 2.6z" />
        </svg>
      );
    case "notifications":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4.2a4.8 4.8 0 0 0-4.8 4.8v2.3c0 .8-.2 1.5-.6 2.2l-1.2 2a1 1 0 0 0 .9 1.5h11.4a1 1 0 0 0 .9-1.5l-1.2-2c-.4-.7-.6-1.4-.6-2.2V9A4.8 4.8 0 0 0 12 4.2z" />
          <path d="M9.8 18.4a2.4 2.4 0 0 0 4.4 0" />
        </svg>
      );
    case "messages":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5.5 5.5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.8 3v-3H5.5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" />
        </svg>
      );
    case "security":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.8l7 2.7v5.8c0 4.4-2.8 7.7-7 8.9-4.2-1.2-7-4.5-7-8.9V6.5z" />
          <path d="M9.6 12.3l1.6 1.6 3.5-3.8" />
        </svg>
      );
    case "privacy":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6.5" y="10.2" width="11" height="9" rx="2" />
          <path d="M9 10.2V7.8a3 3 0 0 1 6 0v2.4M12 14.2v2.2" />
        </svg>
      );
    case "rooms":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4.5" y="6.2" width="15" height="11.6" rx="3" />
          <path d="M9 11.5h6M12 8.5v6" />
        </svg>
      );
    case "post":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4.8h10a2 2 0 0 1 2 2v10.4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.8a2 2 0 0 1 2-2z" />
          <path d="M9 9h6M9 12h6M9 15h4" />
        </svg>
      );
    case "story":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5.5" y="4.8" width="13" height="14.4" rx="3" />
          <circle cx="10" cy="10.2" r="1.5" />
          <path d="M7.8 15.2l2.6-2.3 2 1.7 3.8-3.6" />
        </svg>
      );
    case "reel-create":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="4.5" width="14" height="15" rx="3" />
          <path d="M8.2 4.5l2.7 4M13.1 4.5l2.7 4M5 8.5h14M10 11.2l5 2.8-5 2.8z" />
        </svg>
      );
    case "broadcast":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6.4 6.4a8 8 0 0 0 0 11.2M17.6 6.4a8 8 0 0 1 0 11.2M3.8 3.8a11.7 11.7 0 0 0 0 16.4M20.2 3.8a11.7 11.7 0 0 1 0 16.4" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

const renderIcon = (icon) => {
  if (typeof icon === "function") {
    const IconComponent = icon;
    return <IconComponent />;
  }
  if (typeof icon === "string") {
    return <MenuIcon name={icon} />;
  }
  return <MenuIcon />;
};

function MenuSection({ title, items, onItemClick }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="create-menu-section">
      <div className="create-menu-section-head">
        <h4>{title}</h4>
      </div>
      <div className="create-menu-list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="create-menu-item"
            onClick={() => onItemClick(item)}
          >
            <span className="create-menu-item-icon">{renderIcon(item.icon)}</span>
            <span className="create-menu-item-copy">
              <strong>{item.label}</strong>
              {item.description ? <small>{item.description}</small> : null}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CreateRail({ items, onItemClick }) {
  return (
    <div className="create-menu-side-card">
      <div className="create-menu-side-head">
        <h3>Create</h3>
      </div>
      {items.length ? (
        <div className="create-menu-list create-menu-list--create">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="create-menu-item create-menu-item--create"
              onClick={() => onItemClick(item)}
            >
              <span className="create-menu-item-icon">{renderIcon(item.icon)}</span>
              <span className="create-menu-item-copy">
                <strong>{item.label}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="create-menu-empty">No create actions match that search.</p>
      )}
    </div>
  );
}

export default function CreateMenuDropdown({
  id,
  searchValue,
  onSearchChange,
  menuSections,
  createItems,
  onItemClick,
  onClose,
}) {
  const visibleSections = (Array.isArray(menuSections) ? menuSections : []).filter(
    (section) => Array.isArray(section.items) && section.items.length
  );

  return (
    <div className="create-menu-dropdown" id={id} role="dialog" aria-label="Tengacion menu">
      <div className="create-menu-grid">
        <div className="create-menu-main">
          <div className="create-menu-top">
            <h3>Menu</h3>
            <button
              type="button"
              className="create-menu-close"
              onClick={onClose}
              aria-label="Close menu"
              title="Close menu"
            >
              <CloseIcon />
            </button>
          </div>

          <label className="create-menu-search-shell">
            <span className="create-menu-search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              className="create-menu-search"
              placeholder="Search menu"
              aria-label="Search menu"
            />
          </label>

          <div className="create-menu-sections">
            {visibleSections.length ? (
              visibleSections.map((section) => (
                <MenuSection
                  key={section.id}
                  title={section.title}
                  items={section.items}
                  onItemClick={onItemClick}
                />
              ))
            ) : (
              <p className="create-menu-empty">No menu destinations match that search.</p>
            )}
          </div>
        </div>

        <aside className="create-menu-side">
          <CreateRail items={createItems} onItemClick={onItemClick} />
        </aside>
      </div>
    </div>
  );
}
