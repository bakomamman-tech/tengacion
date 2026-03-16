import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import {
  getCreatorDashboardSummary,
  getCreatorPrivateContent,
  getCreatorWorkspaceProfile,
} from "../../api";
import CreatorHeader from "./CreatorHeader";
import CreatorSidebar from "./CreatorSidebar";
import { CREATOR_CATEGORY_CONFIG, CREATOR_CATEGORY_ORDER, normalizeCreatorLaneKeys } from "./creatorConfig";

import "../../pages/creator/creator-workspace.css";

function CreatorWorkspaceSkeleton() {
  return (
    <div className="creator-shell">
      <aside className="creator-sidebar skeleton" />
      <main className="creator-main">
        <div className="creator-page-loading card">Loading creator workspace...</div>
      </main>
    </div>
  );
}

export default function CreatorWorkspaceLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const creatorProfileRef = useRef(null);
  const dashboardRef = useRef(null);

  useEffect(() => {
    creatorProfileRef.current = creatorProfile;
  }, [creatorProfile]);

  useEffect(() => {
    dashboardRef.current = dashboard;
  }, [dashboard]);

  const loadWorkspace = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const [profilePayload, summaryPayload, contentPayload] = await Promise.all([
        getCreatorWorkspaceProfile(),
        getCreatorDashboardSummary(),
        getCreatorPrivateContent(),
      ]);
      setCreatorProfile(
        profilePayload ||
          summaryPayload?.creatorProfile ||
          contentPayload?.creatorProfile ||
          null
      );
      setDashboard({
        ...(summaryPayload || {}),
        content: contentPayload?.content || summaryPayload?.content || {},
      });
      setError("");
    } catch (err) {
      if (!silent || !creatorProfileRef.current || !dashboardRef.current) {
        setError(err?.message || "Failed to load your creator workspace.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading) {
    return <CreatorWorkspaceSkeleton />;
  }

  if (error || !creatorProfile || !dashboard) {
    return (
      <div className="creator-shell">
        <main className="creator-main">
          <section className="creator-page-error card">
            <h2>Creator workspace unavailable</h2>
            <p>{error || "We could not load your creator workspace right now."}</p>
            <button type="button" className="creator-primary-btn" onClick={() => loadWorkspace()}>
              Try again
            </button>
          </section>
        </main>
      </div>
    );
  }

  const contextValue = {
    creatorProfile,
    dashboard,
    refreshWorkspace: async () => {
      await loadWorkspace({ silent: true });
    },
    setCreatorProfile,
    setDashboard,
  };

  const normalizedCreatorTypes = normalizeCreatorLaneKeys(creatorProfile?.creatorTypes);
  const currentCategory = CREATOR_CATEGORY_ORDER.find((key) =>
    location.pathname.startsWith(CREATOR_CATEGORY_CONFIG[key].route)
  );
  const pageMeta = currentCategory
    ? {
        title: CREATOR_CATEGORY_CONFIG[currentCategory].title,
        subtitle: CREATOR_CATEGORY_CONFIG[currentCategory].description,
      }
    : location.pathname.startsWith("/creator/earnings")
      ? {
          title: "Earnings",
          subtitle: "Track your creator share, category performance, and current balance health.",
        }
      : location.pathname.startsWith("/creator/payouts")
        ? {
            title: "Payouts",
            subtitle: "Review payout details, settlement readiness, and the balance available for withdrawal.",
          }
        : location.pathname.startsWith("/creator/categories")
          ? {
              title: "Content Categories",
              subtitle: "Choose the creator lanes you want active, then visit those dashboards to register uploads there too.",
            }
        : location.pathname.startsWith("/creator/settings")
          ? {
              title: "Account Settings",
              subtitle: "Manage creator identity, payout details, and the content lanes enabled on your profile.",
            }
          : location.pathname.startsWith("/creator/verification")
            ? {
                title: "Copyright & Verification",
                subtitle: "Review screening results, flagged uploads, and the status of your verification pipeline.",
              }
            : location.pathname.startsWith("/creator/support")
              ? {
                  title: "Support",
                  subtitle: "Reach help resources, report issues, and review creator-facing policies.",
                }
              : {
                  title: "Content Dashboard",
                  subtitle:
                    "Manage your categories, publishing health, and creator earnings from one premium workspace.",
                };
  const isSettingsPage = location.pathname.startsWith("/creator/settings");

  return (
    <div className="creator-shell">
      <div
        className={`creator-sidebar-backdrop ${mobileOpen ? "is-open" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <CreatorSidebar
        creatorProfile={creatorProfile}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />

      <main className="creator-main">
        <CreatorHeader
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          creatorProfile={creatorProfile}
          summary={dashboard.summary}
          onToggleMenu={() => setMobileOpen((open) => !open)}
          action={
            isSettingsPage ? (
              <button type="submit" form="creator-settings-form" className="creator-secondary-btn">
                Save creator profile
              </button>
            ) : (
              <Link className="creator-secondary-btn" to="/creator/settings">
                Edit creator profile
              </Link>
            )
          }
          primaryAction={
            <div className="creator-mobile-tabs">
              <NavLink className="creator-chip-link" to="/creator/dashboard">
                Overview
              </NavLink>
              <NavLink className="creator-chip-link" to="/creator/categories">
                Categories
              </NavLink>
              {normalizedCreatorTypes.map((key) => (
                <NavLink key={key} className="creator-chip-link" to={CREATOR_CATEGORY_CONFIG[key]?.route || "/creator/dashboard"}>
                  {CREATOR_CATEGORY_CONFIG[key]?.shortTitle || key}
                </NavLink>
              ))}
            </div>
          }
        />

        <Outlet context={contextValue} />
      </main>
    </div>
  );
}
