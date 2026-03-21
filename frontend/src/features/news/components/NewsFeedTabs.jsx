import { motion } from "framer-motion";

const TABS = [
  { id: "for-you", label: "For You" },
  { id: "local", label: "Local" },
  { id: "nigeria", label: "Nigeria" },
  { id: "world", label: "World" },
];

export default function NewsFeedTabs({ activeTab = "for-you", onChange, tabs = TABS }) {
  const MotionSpan = motion.span;
  const ids = tabs.map((tab) => tab.id);

  const handleKeyDown = (event, currentId) => {
    const currentIndex = ids.indexOf(currentId);
    if (currentIndex === -1) {
      return;
    }

    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % ids.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + ids.length) % ids.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = ids.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    onChange?.(ids[nextIndex]);
    window.requestAnimationFrame(() => {
      document.getElementById(`news-tab-${ids[nextIndex]}`)?.focus();
    });
  };

  return (
    <div className="news-tabs" role="tablist" aria-label="News feed tabs">
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`news-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`news-panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            className={`news-tab ${active ? "active" : ""}`}
            onClick={() => onChange?.(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, tab.id)}
          >
            {active ? <MotionSpan layoutId="news-tab-highlight" className="news-tab-highlight" /> : null}
            <span className="news-tab-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
