const renderIcon = (icon) => {
  if (typeof icon === "function") {
    const IconComponent = icon;
    return <IconComponent />;
  }
  return <span aria-hidden="true">{icon || "•"}</span>;
};

function SectionList({ title, items, onItemClick }) {
  return (
    <section className="create-menu-section">
      <h4>{title}</h4>
      <div className="create-menu-list" role="menu" aria-label={title}>
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

export default function CreateMenuDropdown({
  id,
  searchValue,
  onSearchChange,
  leftItems,
  createItems,
  onItemClick,
}) {
  return (
    <div className="create-menu-dropdown" id={id} role="menu" aria-label="Create menu">
      <div className="create-menu-grid">
        <div className="create-menu-col menu-col">
          <h3>Menu</h3>
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="create-menu-search"
            placeholder="Search menu"
            aria-label="Search menu"
          />
          <SectionList title="Professional" items={leftItems} onItemClick={onItemClick} />
        </div>

        <div className="create-menu-col create-col">
          <h3>Create</h3>
          <SectionList title="Create" items={createItems} onItemClick={onItemClick} />
        </div>
      </div>
    </div>
  );
}
