import { Link } from "react-router-dom";

import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import CreatorUploadSupportPanels from "../../components/creator/upload/CreatorUploadSupportPanels";
import PodcastUploadStudio from "../../components/creator/upload/PodcastUploadStudio";

export default function CreatorPodcastsUploadPage() {
  const { creatorProfile, dashboard } = useCreatorWorkspace();
  const podcastStats = dashboard.categories?.podcast || dashboard.categories?.podcasts || {};
  const podcastAnalytics = dashboard.content?.podcasts?.analytics || {};

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
        <CreatorUploadSupportPanels
          creatorProfile={creatorProfile}
          dashboard={dashboard}
          categoryKey="podcast"
        />
      </aside>
    </div>
  );
}
