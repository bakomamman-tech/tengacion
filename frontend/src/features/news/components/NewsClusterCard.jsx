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

export default function NewsClusterCard({
  card,
  onOpen,
  onHide,
  onReport,
  onFollowSource,
  onTrack,
  compact = false,
}) {
  const [showWhy, setShowWhy] = useState(false);
  const story = card?.representativeStory || null;
  const source = story?.source || null;

  const handleOpen = () => {
    onTrack?.({
      cardType: "cluster",
      clusterId: card?.clusterId,
      storyId: story?.id || "",
      sourceSlug: source?.slug || story?.sourceSlug || "",
      topicTags: card?.topicTags || [],
      action: "open",
      feedTab: "for-you",
      surface: compact ? "home" : "news",
    });
    onOpen?.(card);
  };

  return (
    <article className={`card news-card news-cluster-card ${compact ? "compact" : ""}`}>
      <div className="news-card-top">
        <div className="news-card-meta">
          <span className={`news-type-badge ${card?.articleType || "report"}`}>
            {ARTICLE_LABELS[card?.articleType] || ARTICLE_LABELS.report}
          </span>
          {source ? <NewsPublisherBadge tier={source.publisherTier} /> : null}
          <span className="news-coverage-badge">
            {card?.sourceCount || 1} source{Number(card?.sourceCount || 1) === 1 ? "" : "s"}
          </span>
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
        <h3>{card?.title || story?.title || "Coverage cluster"}</h3>
        <p>{card?.summary || story?.summaryText || ""}</p>
      </div>

      {story?.media?.url ? (
        <button type="button" className="news-card-media" onClick={handleOpen}>
          <img src={story.media.url} alt={story.media.altText || story.title || "News image"} />
        </button>
      ) : null}

      <div className="news-card-cluster-footer">
        <div className="news-card-source-row">
          <NewsSourceChip source={source} compact />
          <span className="news-card-topic-row">
            {(card?.topicTags || []).slice(0, 3).map((tag) => (
              <span key={tag} className="news-topic-chip">
                {tag.replace(/-/g, " ")}
              </span>
            ))}
          </span>
        </div>
        <div className="news-card-actions">
          <button type="button" className="news-action-button primary" onClick={handleOpen}>
            Compare coverage
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
            onClick={() => onHide?.({ clusterId: card?.clusterId })}
          >
            Hide
          </button>
          <button
            type="button"
            className="news-action-button"
            onClick={() => onReport?.({ clusterId: card?.clusterId, storyId: story?.id || "" })}
          >
            Report
          </button>
        </div>
      </div>

      {showWhy ? <NewsWhyThisCard reasons={card?.whyThis} rights={card?.rights} /> : null}
    </article>
  );
}
