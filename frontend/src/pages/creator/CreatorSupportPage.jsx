import { Link } from "react-router-dom";

export default function CreatorSupportPage() {
  return (
    <div className="creator-page-stack">
      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Support shortcuts</h2>
            <p>Use the built-in platform routes for creator questions, policy review, and issue reporting.</p>
          </div>
        </div>
        <div className="creator-quick-list">
          <Link className="creator-quick-action" to="/help-support">
            <span>Help center</span>
            <small>Get help with creator setup, publishing, and workspace questions.</small>
          </Link>
          <Link className="creator-quick-action" to="/feedback?type=bug">
            <span>Report a problem</span>
            <small>Share a bug report if a creator tool, upload form, or dashboard state looks wrong.</small>
          </Link>
          <Link className="creator-quick-action" to="/terms">
            <span>Terms of Service</span>
            <small>Review the platform rules tied to creator accounts and uploaded content.</small>
          </Link>
          <Link className="creator-quick-action" to="/copyright-policy">
            <span>Copyright policy</span>
            <small>Read how Tengacion handles screening, rights declarations, and review flows.</small>
          </Link>
        </div>
      </section>
    </div>
  );
}
