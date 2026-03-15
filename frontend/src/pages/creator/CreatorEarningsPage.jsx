import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { formatCurrency } from "../../components/creator/creatorConfig";

export default function CreatorEarningsPage() {
  const { dashboard } = useCreatorWorkspace();

  return (
    <div className="creator-page-stack">
      <section className="creator-metric-grid">
        <article className="creator-metric-card card">
          <span>Total earnings</span>
          <strong>{formatCurrency(dashboard.summary?.totalEarnings || 0)}</strong>
        </article>
        <article className="creator-metric-card card">
          <span>Available balance</span>
          <strong>{formatCurrency(dashboard.summary?.availableBalance || 0)}</strong>
        </article>
        <article className="creator-metric-card card">
          <span>Pending balance</span>
          <strong>{formatCurrency(dashboard.summary?.pendingBalance || 0)}</strong>
        </article>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Category earnings</h2>
            <p>See which content lanes are currently driving your creator income.</p>
          </div>
        </div>

        <div className="creator-stack-list">
          {Object.entries(dashboard.categories || {}).map(([key, value]) => (
            <div key={key} className="creator-stack-row">
              <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
              <strong>{formatCurrency(value?.earnings || 0)}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
