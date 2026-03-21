import { useState } from "react";

import { formatAbsoluteTime, formatRelativeTime, formatTopicLabel } from "../utils/newsUi";
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

export default function NewsStoryCard({
  card,
  activeTab = "for-you",
  onOpen,
  onHide,
  onReport,
  onFollowSource,
  onTrack,
  onToggleSave,
  onShare,
  saved = false,
  saving = false,
  compact = false,
}) {
  const [showWhy, setShowWhy] = useState(false);
  const story = card?.representativeStory || card;
  const source = story?.source || null;
  const publishedLabel = formatRelativeTime(story?.publishedAt);
  const publishedTitle = formatAbsoluteTime(story?.publishedAt);
  const primaryTopic = card?.topicTags?.[0] || story?.topicTags?.[0] || "";
  const explanation = card?.reasonLabel || card?.whyThis?.[0] || "";

  const handleOpen = () => {
    onTrack?.({
      cardType: "story",
      storyId: story?.id,
      clusterId: card?.clusterId || "",
      sourceSlug: source?.slug || story?.sourceSlug || "",
      topicTags: card?.topicTags || story?.topicTags || [],
      action: "open",
      feedTab: activeTab,
      surface: compact ? "home" : "news",
    });
    onOpen?.(card);
  };

  const handleReadOriginal = () => {
    onTrack?.({
      cardType: "story",
      storyId: story?.id,
      clusterId: card?.clusterId || "",
      sourceSlug: source?.slug || story?.sourceSlug || "",
      topicTags: card?.topicTags || story?.topicTags || [],
      action: "click",
      feedTab: activeTab,
      surface: compact ? "home" : "news",
    });
  };

  return (
    <article className={`card news-card news-story-card ${compact ? "compact" : ""}`}>
      <div className="news-card-frame">
        <button type="button" className="news-card-media" onClick={handleOpen}>
          {story?.media?.url ? (
            <img src={story.media.url} alt={story.media.altText || story.title || "News image"} />
          ) : (
            <span className="news-card-media-fallback">
              <span>{primaryTopic ? formatTopicLabel(primaryTopic) : "Trusted coverage"}</span>
            </span>
          )}
        </button>

        <div className="news-card-body">
          <div className="news-card-topline">
            <div className="news-card-source-row">
              <NewsSourceChip source={source} compact />
              {source ? <NewsPublisherBadge tier={source.publisherTier} /> : null}
            </div>
            {publishedLabel ? (
              <time className="news-card-time" dateTime={story?.publishedAt} title={publishedTitle}>
                {publishedLabel}
              </time>
            ) : null}
          </div>

          <div className="news-card-meta">
            <span className={`news-type-badge ${story?.articleType || "report"}`}>
              {ARTICLE_LABELS[story?.articleType] || ARTICLE_LABELS.report}
            </span>
            {primaryTopic ? (
              <span className="news-topic-chip">{formatTopicLabel(primaryTopic)}</span>
            ) : null}
            {story?.isOpinion ? <span className="news-opinion-badge">Editorial</span> : null}
          </div>

          <div className="news-card-headline">
            <button type="button" className="news-card-headline-button" onClick={handleOpen}>
              <h3>{story?.title || "Untitled story"}</h3>
            </button>
            {story?.summaryText || card?.summary ? (
              <p>{story?.summaryText || card?.summary || ""}</p>
            ) : null}
          </div>

          <div className="news-card-byline-row">
            {story?.authorByline ? <span>{story.authorByline}</span> : <span>Source-linked summary</span>}
            {activeTab === "for-you" && explanation ? (
              <span className="news-card-explanation">{explanation}</span>
            ) : null}
          </div>

          <div className="news-card-utility-row">
            <button
              type="button"
              className={`news-inline-action ${saved ? "saved" : ""}`}
              onClick={() => onToggleSave?.({ articleId: story?.id, saved, feedTab: activeTab })}
              disabled={saving}
              aria-pressed={saved}
            >
              {saving ? "Saving..." : saved ? "Saved" : "Save"}
            </button>
            <button
              type="button"
              className="news-inline-action"
              onClick={() =>
                onShare?.({
                  title: story?.title || card?.title || "Tengacion News",
                  canonicalUrl: story?.canonicalUrl || "",
                })
              }
            >
              Share
            </button>
            <button
              type="button"
              className="news-inline-action"
              onClick={() => onFollowSource?.(source?.slug)}
              disabled={!source?.slug}
            >
              Follow
            </button>
            {activeTab === "for-you" ? (
              <button
                type="button"
                className="news-inline-action"
                onClick={() => setShowWhy((value) => !value)}
              >
                Why you're seeing this
              </button>
            ) : null}
          </div>

          <div className="news-card-footer">
            <div className="news-card-actions">
              <button type="button" className="news-action-button" onClick={handleOpen}>
                View summary
              </button>
              <a
                className="news-action-button primary"
                href={story?.canonicalUrl || "#"}
                target="_blank"
                rel="noreferrer"
                onClick={handleReadOriginal}
              >
                Read original
              </a>
            </div>
            <div className="news-card-secondary-actions">
              <button
                type="button"
                className="news-text-action"
                onClick={() => onHide?.({ storyId: story?.id })}
              >
                Hide
              </button>
              <button
                type="button"
                className="news-text-action"
                onClick={() => onReport?.({ storyId: story?.id, clusterId: card?.clusterId || "" })}
              >
                Report
              </button>
            </div>
          </div>

          {showWhy ? <NewsWhyThisCard reasons={card?.whyThis} rights={story?.rights} /> : null}
        </div>
      </div>
    </article>
  );
}
