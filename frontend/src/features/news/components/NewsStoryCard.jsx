import { useState } from "react";

import NewsPublisherBadge from "./NewsPublisherBadge";
import NewsSourceChip from "./NewsSourceChip";
import NewsWhyThisCard from "./NewsWhyThisCard";

const ARTICLE_LABELS = {
  breaking: "Breaking",
  analysis: "Analysis",
  opinion: "Opinion",
  explainer: "Explainer",
  report: "Report",
};

const formatTime = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export default function NewsStoryCard({
  card,
  onOpen,
  onHide,
  onReport,
  onFollowSource,
  onTrack,
  compact = false,
}) {
  const [showWhy, setShowWhy] = useState(false);
  const story = card?.representativeStory || card;
  const source = story?.source || null;

  const handleOpen = () => {
    onTrack?.({
      cardType: "story",
      storyId: story?.id,
      clusterId: card?.clusterId || "",
      sourceSlug: source?.slug || story?.sourceSlug || "",
      topicTags: card?.topicTags || story?.topicTags || [],
      action: "open",
      feedTab: "for-you",
      surface: compact ? "home" : "news",
    });
    onOpen?.(card);
  };

  return (
    <article className={`card news-card ${compact ? "compact" : ""}`}>
      <div className="news-card-top">
        <div className="news-card-meta">
          <span className={`news-type-badge ${story?.articleType || "report"}`}>
            {ARTICLE_LABELS[story?.articleType] || ARTICLE_LABELS.report}
          </span>
          {source ? <NewsPublisherBadge tier={source.publisherTier} /> : null}
        </div>
        <button
          type="button"
          className="news-inline-action"
          onClick={() => setShowWhy((value) => !value)}
        >
          Why this?
        </button>
      </div>

      <div className="news-card-headline">
        <h3>{story?.title || "Untitled story"}</h3>
        {story?.subtitle ? <p>{story.subtitle}</p> : null}
      </div>

      {story?.media?.url ? (
        <button type="button" className="news-card-media" onClick={handleOpen}>
          <img src={story.media.url} alt={story.media.altText || story.title || "News image"} />
        </button>
      ) : null}

      <p className="news-card-summary">{story?.summaryText || card?.summary || ""}</p>

      <div className="news-card-footer">
        <div className="news-card-source-row">
          <NewsSourceChip source={source} compact />
          <span className="news-card-time">{formatTime(story?.publishedAt)}</span>
        </div>
        <div className="news-card-actions">
          <button type="button" className="news-action-button primary" onClick={handleOpen}>
            {story?.display?.linkOutOnly ? "Read from source" : "Open story"}
          </button>
          <button
            type="button"
            className="news-action-button"
            onClick={() => onFollowSource?.(source?.slug)}
            disabled={!source?.slug}
          >
            Follow source
          </button>
          <button
            type="button"
            className="news-action-button"
            onClick={() => onHide?.({ storyId: story?.id })}
          >
            Hide
          </button>
          <button
            type="button"
            className="news-action-button"
            onClick={() => onReport?.({ storyId: story?.id, clusterId: card?.clusterId || "" })}
          >
            Report
          </button>
        </div>
      </div>

      {showWhy ? <NewsWhyThisCard reasons={card?.whyThis} rights={story?.rights} /> : null}
    </article>
  );
}
