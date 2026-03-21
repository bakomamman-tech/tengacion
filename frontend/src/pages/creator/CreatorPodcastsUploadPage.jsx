import { Link } from "react-router-dom";

import CreatorContentCategoryNav from "../../components/creator/CreatorContentCategoryNav";
import CreatorFanPageWorkspacePreview from "../../components/creator/CreatorFanPageWorkspacePreview";
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
              <h2>Podcast Uploads</h2>
              <p>A dedicated episode publishing flow for audio or video podcasts with clean sequencing, pricing, previews, transcripts, and podcast-only metadata.</p>
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

        <CreatorFanPageWorkspacePreview
          creatorProfile={creatorProfile}
          dashboard={dashboard}
          currentCategoryKey="podcast"
        />

        <div className="creator-upload-studio creator-upload-studio--podcasts">
          <PodcastUploadStudio showNotice={false} />
        </div>
      </div>

      <aside className="creator-page-side">
        <section className="creator-panel card">
          <div className="creator-panel-head">
            <div>
              <h2>Content Categories</h2>
              <p>Switch between music, podcasts, and books without mixing forms, files, or publishing rules.</p>
            </div>
          </div>
          <CreatorContentCategoryNav creatorTypes={creatorProfile?.creatorTypes} />
        </section>

        <CreatorUploadSupportPanels
          creatorProfile={creatorProfile}
          dashboard={dashboard}
          categoryKey="podcast"
        />
      </aside>
    </div>
  );
}
