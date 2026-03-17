import { Link } from "react-router-dom";

import { formatCurrency } from "../creatorConfig";

const CATEGORY_META = {
  music: {
    dashboardKey: "music",
    label: "Music",
    formats: "MP3, WAV, FLAC, M4A, AAC, OGG",
    tips: [
      "Paid music releases should include a preview sample before publishing.",
      "Use crisp square cover art for the strongest storefront presentation.",
      "Double-check titles, credits, and release type before going live.",
    ],
  },
  bookPublishing: {
    dashboardKey: "bookPublishing",
    label: "Book Publishing",
    formats: "PDF, EPUB, MOBI, TXT",
    tips: [
      "Keep manuscript files polished and export-ready before upload.",
      "Add a clear synopsis and language metadata for stronger discovery.",
      "Use the optional copyright declaration if you want that captured on the release.",
    ],
  },
  podcast: {
    dashboardKey: "podcast",
    label: "Podcast",
    formats: "MP3, WAV, FLAC, M4A, AAC, OGG",
    tips: [
      "Premium podcast episodes should include a preview sample before publishing.",
      "Series name, season number, and episode number help keep your catalog organized.",
      "Transcript uploads are optional but useful for accessibility and repurposing.",
    ],
  },
};

const toNumber = (value) => Number(value || 0);

const maskAccountNumber = (value = "") => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) {
    return "Not set";
  }
  if (digits.length <= 4) {
    return digits;
  }
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

export default function CreatorUploadSupportPanels({
  creatorProfile,
  dashboard,
  categoryKey = "music",
}) {
  const summary = dashboard?.summary || {};
  const categories = dashboard?.categories || {};
  const meta = CATEGORY_META[categoryKey] || CATEGORY_META.music;
  const laneStats = categories[meta.dashboardKey] || {};

  const libraryCounts = {
    singles: toNumber(dashboard?.content?.music?.tracks?.length),
    albums: toNumber(dashboard?.content?.music?.albums?.length),
    books: toNumber(dashboard?.content?.books?.items?.length),
    videos: toNumber(dashboard?.content?.music?.videos?.length),
    podcasts: toNumber(dashboard?.content?.podcasts?.episodes?.length),
  };

  const creatorName =
    creatorProfile?.displayName ||
    creatorProfile?.fullName ||
    creatorProfile?.user?.name ||
    "Creator";
  const creatorInitial = String(creatorName).trim().charAt(0).toUpperCase() || "C";
  const maskedAccount = maskAccountNumber(creatorProfile?.accountNumber || "");

  const grossRevenue = toNumber(summary.grossRevenue);
  const totalEarnings = toNumber(summary.totalEarnings);
  const platformShare = Math.max(0, grossRevenue - totalEarnings);

  return (
    <>
      <section className="creator-panel card creator-upload-side-card">
        <div className="creator-panel-head">
          <div>
            <h2>{meta.label} guide</h2>
            <p>Accepted formats and quick publishing reminders for this studio.</p>
          </div>
        </div>
        <div className="creator-upload-guide">
          <div className="creator-upload-guide-formats">
            <span>Accepted formats</span>
            <strong>{meta.formats}</strong>
          </div>
          <div className="creator-upload-guide-list">
            {meta.tips.map((tip) => (
              <div key={tip} className="creator-upload-guide-item">
                <span />
                <small>{tip}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="creator-panel card creator-upload-side-card">
        <div className="creator-panel-head">
          <div>
            <h2>Earnings</h2>
            <p>Current balances and lane performance while you publish.</p>
          </div>
        </div>
        <div className="creator-stack-list">
          <div className="creator-stack-row">
            <span>Total earnings</span>
            <strong>{formatCurrency(totalEarnings)}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Available balance</span>
            <strong>{formatCurrency(summary.availableBalance || 0)}</strong>
          </div>
          <div className="creator-stack-row">
            <span>{meta.label} earnings</span>
            <strong>{formatCurrency(laneStats.earnings || 0)}</strong>
          </div>
        </div>
        <Link className="creator-secondary-btn" to="/creator/earnings">
          Open earnings
        </Link>
      </section>

      <section className="creator-panel card creator-upload-side-card">
        <div className="creator-panel-head">
          <div>
            <h2>Payout account</h2>
            <p>Creator identity and settlement split used for payouts.</p>
          </div>
        </div>
        <div className="creator-upload-account">
          <div className="creator-avatar-mark creator-avatar-mark--small">{creatorInitial}</div>
          <div>
            <strong>{creatorName}</strong>
            <p>Account {maskedAccount}</p>
          </div>
        </div>
        <div className="creator-stack-list">
          <div className="creator-stack-row">
            <span>40% Creator</span>
            <strong>{formatCurrency(totalEarnings)}</strong>
          </div>
          <div className="creator-stack-row">
            <span>60% Tengacion</span>
            <strong>{formatCurrency(platformShare)}</strong>
          </div>
        </div>
        <div className="creator-category-actions">
          <Link className="creator-primary-btn" to="/creator/payouts">
            Manage accounts
          </Link>
          <Link className="creator-secondary-btn" to="/creator/settings">
            Update details
          </Link>
        </div>
      </section>

      <section className="creator-panel card creator-upload-side-card">
        <div className="creator-panel-head">
          <div>
            <h2>Library</h2>
            <p>Content counts currently in your creator workspace.</p>
          </div>
        </div>
        <div className="creator-stack-list">
          <div className="creator-stack-row">
            <span>Singles</span>
            <strong>{libraryCounts.singles}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Albums</span>
            <strong>{libraryCounts.albums}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Books</span>
            <strong>{libraryCounts.books}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Videos</span>
            <strong>{libraryCounts.videos}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Podcasts</span>
            <strong>{libraryCounts.podcasts}</strong>
          </div>
        </div>
      </section>
    </>
  );
}
