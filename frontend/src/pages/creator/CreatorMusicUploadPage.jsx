import { Link } from "react-router-dom";

import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { formatCurrency } from "../../components/creator/creatorConfig";
import MusicUploadStudio from "../../components/creator/upload/MusicUploadStudio";

export default function CreatorMusicUploadPage() {
  const { dashboard } = useCreatorWorkspace();
  const musicStats = dashboard.categories?.music || {};
  const musicAnalytics = dashboard.content?.music?.analytics || {};

  return (
    <div className="creator-page-grid creator-upload-page">
      <div className="creator-page-main">
        <section className="creator-panel card creator-upload-hero">
          <div className="creator-panel-head">
            <div>
              <span className="creator-eyebrow">Music Studio</span>
              <h2>Upload Music</h2>
              <p>Publish tracks, albums, EPs, and music videos from one dedicated studio built around your creator workflow.</p>
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

        <div className="creator-upload-studio creator-upload-studio--music">
          <MusicUploadStudio showNotice={false} />
        </div>
      </div>

      <aside className="creator-page-side">
        <section className="creator-panel card creator-upload-side-card">
          <div className="creator-panel-head">
            <div>
              <h2>Lane snapshot</h2>
              <p>Keep an eye on review pressure and earnings before you publish.</p>
            </div>
          </div>
          <div className="creator-stack-list">
            <div className="creator-stack-row">
              <span>In review</span>
              <strong>{Number(musicStats.underReview || 0)}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Music earnings</span>
              <strong>{formatCurrency(musicStats.earnings || 0)}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Available</span>
              <strong>{formatCurrency(dashboard.summary?.availableBalance || 0)}</strong>
            </div>
          </div>
        </section>

        <section className="creator-panel card creator-upload-side-card">
          <div className="creator-panel-head">
            <div>
              <h2>Publishing checklist</h2>
              <p>These details help your release move through screening faster.</p>
            </div>
          </div>
          <div className="creator-quick-list">
            <div className="creator-quick-action">
              <span>Use a clean release title</span>
              <small>Match the title, artwork, and file metadata as closely as possible.</small>
            </div>
            <div className="creator-quick-action">
              <span>Add preview assets</span>
              <small>Preview samples and thumbnails improve discovery and trust.</small>
            </div>
            <div className="creator-quick-action">
              <span>Check pricing once</span>
              <small>Draft first if you want to review your release before it goes live.</small>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
