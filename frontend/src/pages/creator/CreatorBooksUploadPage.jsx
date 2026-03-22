import { Link } from "react-router-dom";

import CreatorFanPageWorkspacePreview from "../../components/creator/CreatorFanPageWorkspacePreview";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import CreatorUploadSupportPanels from "../../components/creator/upload/CreatorUploadSupportPanels";
import BookUploadStudio from "../../components/creator/upload/BookUploadStudio";

export default function CreatorBooksUploadPage() {
  const { creatorProfile, dashboard } = useCreatorWorkspace();
  const bookStats = dashboard.categories?.bookPublishing || dashboard.categories?.books || {};
  const bookAnalytics = dashboard.content?.books?.analytics || {};

  return (
    <div className="creator-page-grid creator-upload-page">
      <div className="creator-page-main">
        <section className="creator-panel card creator-upload-hero">
          <div className="creator-panel-head">
            <div>
              <span className="creator-eyebrow">Book Studio</span>
              <h2>Book Publishing Uploads</h2>
              <p>A calm, premium publishing flow for digital books with supported manuscript formats, metadata, and polished draft or publish states.</p>
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

        <CreatorFanPageWorkspacePreview
          creatorProfile={creatorProfile}
          dashboard={dashboard}
          currentCategoryKey="bookPublishing"
        />

        <div className="creator-upload-studio creator-upload-studio--books">
          <BookUploadStudio showNotice={false} />
        </div>
      </div>

      <aside className="creator-page-side">
        <CreatorUploadSupportPanels
          creatorProfile={creatorProfile}
          dashboard={dashboard}
          categoryKey="bookPublishing"
        />
      </aside>
    </div>
  );
}
