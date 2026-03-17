import { Link } from "react-router-dom";

import CreatorContentCategoryNav from "../../components/creator/CreatorContentCategoryNav";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import CreatorUploadSupportPanels from "../../components/creator/upload/CreatorUploadSupportPanels";
import MusicUploadStudio from "../../components/creator/upload/MusicUploadStudio";

export default function CreatorMusicUploadPage() {
  const { creatorProfile, dashboard } = useCreatorWorkspace();
  const musicStats = dashboard.categories?.music || {};
  const musicAnalytics = dashboard.content?.music?.analytics || {};

  return (
    <div className="creator-page-grid creator-upload-page">
      <div className="creator-page-main">
        <section className="creator-panel card creator-upload-hero">
          <div className="creator-panel-head">
            <div>
              <span className="creator-eyebrow">Music Studio</span>
              <h2>Music Uploads</h2>
              <p>A focused music publishing flow with artwork, audio, metadata, pricing, drafts, and live release states.</p>
            </div>
            <Link className="creator-secondary-btn" to="/creator/music">
              Back to Music dashboard
            </Link>
          </div>

          <div className="creator-metric-grid">
            <div className="creator-stats-card creator-stats-card--success">
              <strong>{Number(musicStats.uploads || 0)}</strong>
              <small>Published releases currently live.</small>
            </div>
            <div className="creator-stats-card">
              <strong>{Number(musicStats.drafts || 0)}</strong>
              <small>Drafts waiting for a final publish.</small>
            </div>
            <div className="creator-stats-card">
              <strong>{Number(musicAnalytics.totalStreams || 0)}</strong>
              <small>Total streams across your music lane.</small>
            </div>
          </div>
        </section>

        <section className="creator-panel card">
          <div className="creator-panel-head">
            <div>
              <h2>Content Categories</h2>
              <p>Each category opens its own dedicated upload experience with strict separation in fields, validation, and routing.</p>
            </div>
          </div>
          <CreatorContentCategoryNav creatorTypes={creatorProfile?.creatorTypes} />
        </section>

        <div className="creator-upload-studio creator-upload-studio--music">
          <MusicUploadStudio showNotice={false} />
        </div>
      </div>

      <aside className="creator-page-side">
        <CreatorUploadSupportPanels
          creatorProfile={creatorProfile}
          dashboard={dashboard}
          categoryKey="music"
        />
      </aside>
    </div>
  );
}
