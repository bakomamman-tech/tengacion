import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AdminShell from "../components/AdminShell";
import { adminGetCreatorDetail } from "../api";

const currency = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

export default function AdminCreatorDetailPage({ user }) {
  const { creatorId } = useParams();
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCreator(await adminGetCreatorDetail(creatorId));
    } catch (err) {
      setError(err?.message || "Failed to load creator details");
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminShell title="Creator Detail" subtitle="Read-only creator profile and monetization summary." user={user} actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}>
      {error ? <div className="adminx-error">{error}</div> : null}
      {loading ? <div className="adminx-loading">Loading creator details...</div> : null}
      {!loading && creator ? (
        <>
          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-row"><h2 className="adminx-panel-title">{creator.displayName}</h2><span className="adminx-badge">@{creator.user?.username || "creator"}</span></div>
            <p className="adminx-muted">{creator.tagline || creator.bio || "No bio yet."}</p>
            <div className="adminx-mobile-stack">
              {(creator.genres || []).map((genre) => <span key={genre} className="adminx-badge">{genre}</span>)}
            </div>
          </section>

          <section className="adminx-stats-grid">
            {[
              ["Tracks", creator.stats?.tracks],
              ["Podcasts", creator.stats?.podcasts],
              ["Albums", creator.stats?.albums],
              ["Books", creator.stats?.books],
              ["Videos", creator.stats?.videos],
              ["Purchases", creator.stats?.purchases],
              ["Revenue", currency(creator.stats?.totalRevenue)],
            ].map(([label, value]) => (
              <article key={label} className="adminx-stat-card">
                <div className="adminx-kpi-label">{label}</div>
                <div className="adminx-kpi-value">{typeof value === "string" ? value : Number(value || 0).toLocaleString()}</div>
              </article>
            ))}
          </section>

          <section className="adminx-panel adminx-panel--span-12">
            <h2 className="adminx-panel-title">Identity</h2>
            <div className="adminx-list-grid">
              <div>Name: {creator.user?.name || "-"}</div>
              <div>Username: @{creator.user?.username || "-"}</div>
              <div>Email: {creator.user?.email || "-"}</div>
            </div>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
