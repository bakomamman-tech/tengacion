import { startTransition, useEffect, useMemo, useState } from "react";
import { AnimatePresence, m } from "framer-motion";

import AdminHeader from "../components/adminDashboard/AdminHeader";
import AdminSidebar from "../components/adminDashboard/AdminSidebar";
import StatCard from "../components/adminDashboard/StatCard";
import AnalyticsChartCard from "../components/adminDashboard/AnalyticsChartCard";
import DevicesUsageCard from "../components/adminDashboard/DevicesUsageCard";
import RecentPostsCard from "../components/adminDashboard/RecentPostsCard";
import TopUsersCard from "../components/adminDashboard/TopUsersCard";
import KPICompactCard from "../components/adminDashboard/KPICompactCard";
import AudienceAgeCard from "../components/adminDashboard/AudienceAgeCard";
import { loadAdminDashboard } from "../services/adminDashboard";

import "./admin-dashboard.css";

function DashboardNotice({ mode, error }) {
  if (mode === "live" && !error) {
    return null;
  }

  const label =
    mode === "hybrid"
      ? "Using live analytics with seeded fallbacks"
      : "Showing seeded dashboard analytics";

  return (
    <div className="tdash-notice" role="status">
      <span className="tdash-notice__pill">{mode === "hybrid" ? "Hybrid" : "Seeded"}</span>
      <span>{error || label}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="tdash-skeleton">
      <div className="tdash-skeleton__row">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="tdash-skeleton__card" />
        ))}
      </div>
      <div className="tdash-skeleton__main">
        <div className="tdash-skeleton__panel tdash-skeleton__panel--wide" />
        <div className="tdash-skeleton__panel" />
      </div>
      <div className="tdash-skeleton__main">
        <div className="tdash-skeleton__panel tdash-skeleton__panel--wide" />
        <div className="tdash-skeleton__stack">
          <div className="tdash-skeleton__panel" />
          <div className="tdash-skeleton__panel" />
        </div>
      </div>
    </div>
  );
}

const MotionDiv = m.div;

export default function AdminDashboardPage({ user, activeNav = "dashboard" }) {
  const [range, setRange] = useState("30d");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [activeTab, setActiveTab] = useState(activeNav === "analytics" ? "reach" : "activity");

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    loadAdminDashboard({ range })
      .then((payload) => {
        if (ignore) {
          return;
        }
        setDashboard(payload);
        setActiveTab((current) => {
          const availableTabs = payload?.chart?.tabs?.map((tab) => tab.id) || [];
          if (availableTabs.includes(current)) {
            return current;
          }
          return payload?.chart?.activeTab || "activity";
        });
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [range]);

  useEffect(() => {
    if (activeNav === "analytics") {
      setActiveTab("reach");
    }
  }, [activeNav]);

  const avatarSrc = useMemo(() => {
    if (!user) {
      return "";
    }
    if (typeof user.avatar === "string") {
      return user.avatar;
    }
    return user.avatar?.url || "";
  }, [user]);

  const content = dashboard;

  return (
    <div className="tdash-page">
      <div className="tdash-shell">
        <div className="tdash-shell__sidebar-desktop">
          <AdminSidebar activeKey={activeNav} navDots={content?.navDots} avatarSrc={avatarSrc} />
        </div>

        <AnimatePresence>
          {sidebarOpen ? (
            <MotionDiv
              className="tdash-mobile-sidebar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button type="button" className="tdash-mobile-sidebar__backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />
              <MotionDiv
                className="tdash-mobile-sidebar__panel"
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
              >
                <AdminSidebar
                  activeKey={activeNav}
                  navDots={content?.navDots}
                  avatarSrc={avatarSrc}
                  onClose={() => setSidebarOpen(false)}
                />
              </MotionDiv>
            </MotionDiv>
          ) : null}
        </AnimatePresence>

        <main className="tdash-main">
          <AdminHeader
            title="Dashboard"
            secondaryText={content?.header?.secondaryText || "Platform oversight"}
            notificationCount={content?.header?.notificationCount || 0}
            avatarSrc={avatarSrc}
            onToggleSidebar={() => setSidebarOpen(true)}
          />

          {loading && !content ? <DashboardSkeleton /> : null}

          {content ? (
            <MotionDiv
              className="tdash-content"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <DashboardNotice mode={content.dataMode} error={content.error} />

              <section className="tdash-stats-grid">
                {(content.overview?.cards || []).map((card) => (
                  <StatCard key={card.id} card={card} />
                ))}
              </section>

              <section className="tdash-main-grid">
                <AnalyticsChartCard
                  tabs={content.chart?.tabs || []}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  rangeOptions={content.chart?.rangeOptions || []}
                  activeRange={range}
                  onRangeChange={(nextRange) =>
                    startTransition(() => {
                      setRange(nextRange);
                    })
                  }
                  series={content.chart?.series || []}
                />

                <div className="tdash-stack">
                  <DevicesUsageCard data={content.devicesUsage} />
                  <RecentPostsCard items={content.recentPosts?.items || []} />
                </div>
              </section>

              <section className="tdash-lower-grid">
                <TopUsersCard items={content.topUsers?.items || []} />

                <div className="tdash-stack">
                  <KPICompactCard items={content.kpis?.items || []} />
                  <AudienceAgeCard items={content.audienceAge?.items || []} />
                </div>
              </section>
            </MotionDiv>
          ) : null}
        </main>
      </div>
    </div>
  );
}
