import { Link } from "react-router-dom";

import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { formatCurrency } from "../../components/creator/creatorConfig";
import BookUploadStudio from "../../components/creator/upload/BookUploadStudio";

export default function CreatorBooksUploadPage() {
  const { dashboard } = useCreatorWorkspace();
  const bookStats = dashboard.categories?.bookPublishing || dashboard.categories?.books || {};
  const bookAnalytics = dashboard.content?.books?.analytics || {};

  return (
    <div className="creator-page-grid creator-upload-page">
      <div className="creator-page-main">
        <section className="creator-panel card creator-upload-hero">
          <div className="creator-panel-head">
            <div>
              <span className="creator-eyebrow">Book Studio</span>
              <h2>Upload Book</h2>
              <p>Prepare ebooks and digital manuscripts with cover art, preview excerpts, metadata, and pricing in one focused page.</p>
            </div>
            <Link className="creator-secondary-btn" to="/creator/books">
              Back to Book Publishing
            </Link>
          </div>

          <div className="creator-metric-grid">
            <div className="creator-stats-card creator-stats-card--success">
              <strong>{Number(bookStats.uploads || 0)}</strong>
              <small>Published books available on your creator page.</small>
            </div>
            <div className="creator-stats-card">
              <strong>{Number(bookStats.drafts || 0)}</strong>
              <small>Draft manuscripts you can revisit later.</small>
            </div>
            <div className="creator-stats-card">
              <strong>{Number(bookAnalytics.totalDownloads || 0)}</strong>
              <small>Total book downloads and reader retrievals.</small>
            </div>
          </div>
        </section>

        <div className="creator-upload-studio creator-upload-studio--books">
          <BookUploadStudio showNotice={false} />
        </div>
      </div>

      <aside className="creator-page-side">
        <section className="creator-panel card creator-upload-side-card">
          <div className="creator-panel-head">
            <div>
              <h2>Book lane snapshot</h2>
              <p>Track performance and moderation status before publishing the next title.</p>
            </div>
          </div>
          <div className="creator-stack-list">
            <div className="creator-stack-row">
              <span>In review</span>
              <strong>{Number(bookStats.underReview || 0)}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Book earnings</span>
              <strong>{formatCurrency(bookStats.earnings || 0)}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Available balance</span>
              <strong>{formatCurrency(dashboard.summary?.availableBalance || 0)}</strong>
            </div>
          </div>
        </section>

        <section className="creator-panel card creator-upload-side-card">
          <div className="creator-panel-head">
            <div>
              <h2>Submission checklist</h2>
              <p>A few quick checks can save time in review.</p>
            </div>
          </div>
          <div className="creator-quick-list">
            <div className="creator-quick-action">
              <span>Choose the right format</span>
              <small>Match the uploaded file type to the format you select.</small>
            </div>
            <div className="creator-quick-action">
              <span>Upload artwork</span>
              <small>Clear cover art makes your release easier to trust and discover.</small>
            </div>
            <div className="creator-quick-action">
              <span>Add preview text</span>
              <small>Short excerpts help readers sample the work before purchase.</small>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
