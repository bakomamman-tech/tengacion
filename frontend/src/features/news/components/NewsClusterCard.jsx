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

export default function NewsClusterCard({
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
  const story = card?.representativeStory || null;
  const source = story?.source || null;
  const publishedLabel = formatRelativeTime(story?.publishedAt);
  const publishedTitle = formatAbsoluteTime(story?.publishedAt);
  const primaryTopic = card?.topicTags?.[0] || "";
  const explanation = card?.reasonLabel || card?.whyThis?.[0] || "";

  const handleOpen = () => {
    onTrack?.({
      cardType: "cluster",
      clusterId: card?.clusterId,
      storyId: story?.id || "",
      sourceSlug: source?.slug || story?.sourceSlug || "",
      topicTags: card?.topicTags || [],
      action: "open",
      feedTab: activeTab,
      surface: compact ? "home" : "news",
    });
    onOpen?.(card);
  };

  return (
    <article className={`card news-card news-cluster-card ${compact ? "compact" : ""}`}>
      <div className="news-card-frame">
        <button type="button" className="news-card-media" onClick={handleOpen}>
          {story?.media?.url ? (
            <img src={story.media.url} alt={story.media.altText || story.title || "News image"} />
          ) : (
            <span className="news-card-media-fallback">
              <span>{primaryTopic ? formatTopicLabel(primaryTopic) : "Coverage cluster"}</span>
            </span>
          )}
        </button>

        <div className="news-card-body">
          <div className="news-card-topline">
            <div className="news-card-source-row">
              <NewsSourceChip source={source} compact />
              {source ? <NewsPublisherBadge tier={source.publisherTier} /> : null}
              <span className="news-coverage-badge">
                {card?.sourceCount || 1} source{Number(card?.sourceCount || 1) === 1 ? "" : "s"}
              </span>
            </div>
            {publishedLabel ? (
              <time className="news-card-time" dateTime={story?.publishedAt} title={publishedTitle}>
                {publishedLabel}
              </time>
            ) : null}
          </div>

          <div className="news-card-meta">
            <span className={`news-type-badge ${card?.articleType || "report"}`}>
              {ARTICLE_LABELS[card?.articleType] || ARTICLE_LABELS.report}
            </span>
            {primaryTopic ? (
              <span className="news-topic-chip">{formatTopicLabel(primaryTopic)}</span>
            ) : null}
            {story?.isOpinion ? <span className="news-opinion-badge">Editorial</span> : null}
          </div>

          <div className="news-card-headline">
            <button type="button" className="news-card-headline-button" onClick={handleOpen}>
              <h3>{card?.title || story?.title || "Coverage cluster"}</h3>
            </button>
            <p>{card?.summary || story?.summaryText || ""}</p>
          </div>

          <div className="news-card-byline-row">
            <span>
              Compare how different trusted publishers are covering this story.
            </span>
            {activeTab === "for-you" && explanation ? (
              <span className="news-card-explanation">{explanation}</span>
            ) : null}
          </div>

          <div className="news-card-utility-row">
            <button
              type="button"
              className={`news-inline-action ${saved ? "saved" : ""}`}
              onClick={() =>
                onToggleSave?.({
                  articleId: story?.id,
                  saved,
                  feedTab: activeTab,
                })
              }
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
                  title: card?.title || story?.title || "Tengacion News",
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
                Compare coverage
              </button>
              <a
                className="news-action-button primary"
                href={story?.canonicalUrl || "#"}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  onTrack?.({
                    cardType: "cluster",
                    clusterId: card?.clusterId,
                    storyId: story?.id || "",
                    sourceSlug: source?.slug || story?.sourceSlug || "",
                    topicTags: card?.topicTags || [],
                    action: "click",
                    feedTab: activeTab,
                    surface: compact ? "home" : "news",
                  })
                }
              >
                Read original
              </a>
            </div>
            <div className="news-card-secondary-actions">
              <button
                type="button"
                className="news-text-action"
                onClick={() => onHide?.({ clusterId: card?.clusterId })}
              >
                Hide
              </button>
              <button
                type="button"
                className="news-text-action"
                onClick={() => onReport?.({ clusterId: card?.clusterId, storyId: story?.id || "" })}
              >
                Report
              </button>
            </div>
          </div>

          {showWhy ? <NewsWhyThisCard reasons={card?.whyThis} rights={card?.rights} /> : null}
        </div>
      </div>
    </article>
  );
}
