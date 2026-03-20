const TABS = [
  { id: "for-you", label: "For You" },
  { id: "local", label: "Local" },
  { id: "nigeria", label: "Nigeria" },
  { id: "world", label: "World" },
];

export default function NewsFeedTabs({ activeTab = "for-you", onChange, tabs = TABS }) {
  return (
    <div className="news-tabs" role="tablist" aria-label="News feed tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`news-tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onChange?.(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
