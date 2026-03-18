import { useCallback, useEffect, useState } from "react";

import CreatorFanPagePreview from "../../components/creator/CreatorFanPagePreview";
import { loadCreatorWorkspaceBundle } from "../../components/creator/creatorWorkspaceData";

import "./creator-fan-page-view.css";

export default function CreatorFanPageViewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  const loadPage = useCallback(async () => {
    setLoading(true);

    try {
      const nextWorkspace = await loadCreatorWorkspaceBundle();
      setCreatorProfile(nextWorkspace.creatorProfile);
      setDashboard(nextWorkspace.dashboard);
      setError("");
    } catch (err) {
      setError(err?.message || "Failed to load the fan page preview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  if (loading) {
    return (
      <div className="creator-fan-page-shell">
        <div className="creator-fan-page-status">
          <div className="creator-fan-page-status__card">
            <h2>Loading Fan Page View</h2>
            <p>Building the public fan-facing preview for your creator page.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !creatorProfile || !dashboard) {
    return (
      <div className="creator-fan-page-shell">
        <div className="creator-fan-page-status">
          <div className="creator-fan-page-status__card">
            <h2>Fan Page View unavailable</h2>
            <p>{error || "We could not load the public fan page preview right now."}</p>
            <button
              type="button"
              className="creator-fan-page-status__retry"
              onClick={loadPage}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="creator-fan-page-shell">
      <CreatorFanPagePreview
        creatorProfile={creatorProfile}
        dashboard={dashboard}
        dashboardPath="/creator/dashboard"
      />
    </div>
  );
}
