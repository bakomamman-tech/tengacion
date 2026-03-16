import { Link } from "react-router-dom";

import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { formatCurrency } from "../../components/creator/creatorConfig";
import CreatorAudienceDestinationCard from "../../components/creator/upload/CreatorAudienceDestinationCard";
import PodcastUploadStudio from "../../components/creator/upload/PodcastUploadStudio";

export default function CreatorPodcastsUploadPage() {
  const { creatorProfile, dashboard } = useCreatorWorkspace();
  const podcastStats = dashboard.categories?.podcast || dashboard.categories?.podcasts || {};
  const podcastAnalytics = dashboard.content?.podcasts?.analytics || {};
  const publicPodcastsPath = creatorProfile?._id ? `/creators/${creatorProfile._id}/podcasts` : "";
  const audienceHighlights = [
    {
      title: "Set the series first",
      copy: "Save host and topic details once before publishing episodes.",
    },
    {
      title: "Use season and episode numbers",
      copy: "Structured numbering keeps your catalog easy to browse.",
    },
    {
      title: "Lead listeners to the final page",
      copy: "Your public podcast page is where audiences can preview, stream, and buy access to the episode.",
    },
  ];

  return (
    <div className="creator-page-grid creator-upload-page">
      <div className="creator-page-main">
        <section className="creator-panel card creator-upload-hero">
          <div className="creator-panel-head">
            <div>
              <span className="creator-eyebrow">Podcast Studio</span>
              <h2>Upload Podcasts</h2>
              <p>Set the series identity, add episode metadata, and publish audio drops with previews, seasons, and cover art.</p>
            </div>
            <Link className="creator-secondary-btn" to="/creator/podcasts">
              Back to Podcast dashboard
            </Link>
          </div>

          <div className="creator-metric-grid">
            <div className="creator-stats-card creator-stats-card--success">
              <strong>{Number(podcastAnalytics.activeEpisodes || 0)}</strong>
              <small>Podcast episodes currently available to listeners.</small>
            </div>
            <div className="creator-stats-card">
              <strong>{Number(podcastStats.drafts || 0)}</strong>
              <small>Draft episodes waiting for final review.</small>
            </div>
            <div className="creator-stats-card">
              <strong>{Number(podcastAnalytics.totalEpisodes || 0)}</strong>
              <small>Total episodes across all podcast series.</small>
            </div>
          </div>
        </section>

        <div className="creator-upload-studio creator-upload-studio--podcasts">
          <PodcastUploadStudio showNotice={false} />
        </div>
      </div>

      <aside className="creator-page-side">
        <section className="creator-panel card creator-upload-side-card">
          <div className="creator-panel-head">
            <div>
              <h2>Podcast lane snapshot</h2>
              <p>Use this summary to watch earnings and moderation load while publishing episodes.</p>
            </div>
          </div>
          <div className="creator-stack-list">
            <div className="creator-stack-row">
              <span>In review</span>
              <strong>{Number(podcastStats.underReview || 0)}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Podcast earnings</span>
              <strong>{formatCurrency(podcastStats.earnings || 0)}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Available balance</span>
              <strong>{formatCurrency(dashboard.summary?.availableBalance || 0)}</strong>
            </div>
          </div>
        </section>

        <CreatorAudienceDestinationCard
          categoryKey="podcast"
          publicPath={publicPodcastsPath}
          highlights={audienceHighlights}
        />
      </aside>
    </div>
  );
}
