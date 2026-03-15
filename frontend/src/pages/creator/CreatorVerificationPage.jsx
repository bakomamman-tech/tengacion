import CopyrightStatusBadge from "../../components/creator/CopyrightStatusBadge";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { formatShortDate } from "../../components/creator/creatorConfig";

export default function CreatorVerificationPage() {
  const { dashboard } = useCreatorWorkspace();
  const items = [
    ...(dashboard.content?.music?.tracks || []),
    ...(dashboard.content?.music?.albums || []),
    ...(dashboard.content?.music?.videos || []),
    ...(dashboard.content?.books?.items || []),
    ...(dashboard.content?.podcasts?.episodes || []),
  ].filter((entry) => entry.copyrightScanStatus && entry.copyrightScanStatus !== "passed");

  return (
    <div className="creator-page-stack">
      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Copyright & verification</h2>
            <p>
              Tengacion screens uploads with metadata and duplicate checks first, then leaves room for deeper AI-assisted
              verification services later.
            </p>
          </div>
        </div>

        <div className="creator-stack-list">
          {Object.entries(dashboard.verificationOverview || {}).map(([key, value]) => (
            <div key={key} className="creator-stack-row">
              <CopyrightStatusBadge status={key} />
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Items needing attention</h2>
            <p>Flagged or blocked uploads will appear here with their verification notes.</p>
          </div>
        </div>
        <div className="creator-activity-list">
          {items.length ? (
            items.map((item) => (
              <article key={item._id} className="creator-activity-item">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.verificationNotes || "This upload needs review."}</p>
                </div>
                <div className="creator-activity-meta">
                  <CopyrightStatusBadge status={item.copyrightScanStatus} />
                  <span>{formatShortDate(item.updatedAt || item.createdAt)}</span>
                </div>
              </article>
            ))
          ) : (
            <div className="creator-empty-card">Everything currently passes metadata screening.</div>
          )}
        </div>
      </section>
    </div>
  );
}
