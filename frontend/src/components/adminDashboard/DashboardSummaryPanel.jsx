import AdminDashboardIcon from "./AdminDashboardIcon";

const severityRank = {
  high: 3,
  medium: 2,
  low: 1,
};

const alertRoutes = {
  failed_payments: {
    label: "Transactions",
    path: "/admin/transactions",
    hint: "Failed payments need to be resolved first.",
    icon: "finance",
  },
  upload_failures: {
    label: "Content",
    path: "/admin/content",
    hint: "Creator uploads are failing and need review.",
    icon: "posts",
  },
  login_warnings: {
    label: "Analytics",
    path: "/admin/analytics",
    hint: "Suspicious login activity is worth checking now.",
    icon: "analytics",
  },
  open_reports: {
    label: "Reports",
    path: "/admin/reports",
    hint: "Open reports are waiting for moderation.",
    icon: "posts",
  },
  book_reviews: {
    label: "Book Reviews",
    path: "/admin/content?category=books&status=under_review",
    hint: "Manuscripts are waiting for review before buyers can purchase.",
    icon: "posts",
  },
  unresolved_reports_backlog: {
    label: "Reports",
    path: "/admin/reports",
    hint: "The report queue is building up.",
    icon: "posts",
  },
  repeat_upload_failures: {
    label: "Content",
    path: "/admin/content",
    hint: "Some creators are failing upload again and again.",
    icon: "posts",
  },
  akuso_prompt_injection_attempts: {
    label: "Assistant Ops",
    path: "/admin/assistant/metrics",
    hint: "Akuso security signals need a closer look.",
    icon: "analytics",
  },
  akuso_openai_failures: {
    label: "Assistant Ops",
    path: "/admin/assistant/metrics",
    hint: "Model reliability has degraded for Akuso.",
    icon: "analytics",
  },
  akuso_local_fallback_rate: {
    label: "Assistant Ops",
    path: "/admin/assistant/metrics",
    hint: "Akuso is relying on local fallbacks more than usual.",
    icon: "analytics",
  },
  akuso_feedback_quality: {
    label: "Assistant Ops",
    path: "/admin/assistant/reviews",
    hint: "Negative Akuso feedback is building up in the queue.",
    icon: "analytics",
  },
};

const defaultRoute = {
  label: "Analytics",
  path: "/admin/analytics",
  hint: "Open platform health and live signals.",
  icon: "analytics",
};

const formatNumber = (value) => Number(value || 0).toLocaleString();

const pickPrimaryAlert = (alerts = []) =>
  [...alerts]
    .filter(Boolean)
    .sort(
      (left, right) =>
        (severityRank[right?.severity] || 0) - (severityRank[left?.severity] || 0)
    )[0] || null;

const getRouteForAlert = (alert) => {
  if (!alert) {
    return defaultRoute;
  }

  const configuredRoute = alertRoutes[alert.key] || defaultRoute;
  return alert.actionPath
    ? { ...configuredRoute, path: alert.actionPath }
    : configuredRoute;
};

const toCardTone = (severity) => {
  if (severity === "high") {
    return "high";
  }
  if (severity === "medium") {
    return "medium";
  }
  return "low";
};

export default function DashboardSummaryPanel({ dashboard, onNavigate }) {
  const alerts = Array.isArray(dashboard?.header?.alerts) ? dashboard.header.alerts : [];
  const navDots = dashboard?.navDots || {};
  const diagnostics = dashboard?.diagnostics || {};
  const recentPosts = Array.isArray(dashboard?.recentPosts?.items) ? dashboard.recentPosts.items.length : 0;
  const dataMode = dashboard?.dataMode || "limited";
  const scopeLabel = dashboard?.filter?.label || "Last 30 days";

  const overviewMap = new Map(
    (dashboard?.overview?.cards || []).map((card) => [card.id, card])
  );

  const totalUsers = Number(overviewMap.get("total-users")?.value || 0);
  const activeUsers = Number(overviewMap.get("active-users")?.value || 0);
  const reach = Number(overviewMap.get("reach")?.value || 0);
  const totalPosts = Number(diagnostics.totalPosts || 0);
  const totalMessages = Number(diagnostics.totalMessages || 0);
  const pendingBookReviews = Number(diagnostics.pendingBookReviews || 0);

  const primaryAlert = pickPrimaryAlert(alerts);
  const primaryRoute = getRouteForAlert(primaryAlert);
  const primaryTone = toCardTone(primaryAlert?.severity);
  const sortedAlerts = [...alerts]
    .filter(Boolean)
    .sort(
      (left, right) =>
        (severityRank[right?.severity] || 0) - (severityRank[left?.severity] || 0)
    );

  const summaryBadge = primaryAlert
    ? `${primaryAlert.severity} priority`
    : dataMode === "live"
      ? "Healthy"
      : "Limited data";

  const summaryTitle = primaryAlert
    ? primaryAlert.title
    : dataMode === "live"
      ? "Platform pulse is stable"
      : "Live signals are still warming up";

  const summaryCopy = primaryAlert
    ? primaryAlert.description || `There are ${alerts.length} active alert${alerts.length === 1 ? "" : "s"}. Start with ${primaryRoute.label.toLowerCase()} and work down the priority queue.`
    : dataMode === "live"
      ? "No critical alerts are active. The core operating signals are available below for routine review."
      : "Live signals are limited for this window. Use the quick lanes to inspect the areas most likely to need attention.";

  const routeCards = [
    {
      key: "primary",
      label: primaryRoute.label,
      value: primaryAlert ? formatNumber(primaryAlert.value) : "Open",
      hint: primaryAlert ? primaryRoute.hint : "Open the best next place to investigate.",
      icon: primaryRoute.icon,
      tone: primaryTone,
      path: primaryRoute.path,
    },
    {
      key: "messages",
      label: "Messages",
      value: formatNumber(totalMessages),
      hint: navDots.messages ? "Traffic is active and needs a quick scan." : "Review the inbox and conversation flow.",
      icon: "messages",
      tone: navDots.messages ? "medium" : "low",
      path: "/admin/messages",
    },
    {
      key: "content",
      label: "Content",
      value: formatNumber(pendingBookReviews || recentPosts || totalPosts),
      hint: pendingBookReviews
        ? `${pendingBookReviews} book manuscript${pendingBookReviews === 1 ? "" : "s"} need approval.`
        : recentPosts
          ? `${recentPosts} recent posts are already surfaced.`
          : "Review the content queue and moderation paths.",
      icon: "posts",
      tone: pendingBookReviews ? "medium" : recentPosts ? "low" : "medium",
      path: pendingBookReviews ? "/admin/content?category=books&status=under_review" : "/admin/content",
    },
    {
      key: "analytics",
      label: "Analytics",
      value: formatNumber(reach || activeUsers || totalUsers),
      hint: "Open the health board for a wider system read.",
      icon: "analytics",
      tone: navDots.analytics ? "medium" : "low",
      path: "/admin/analytics",
    },
  ];

  const followUpRoute = routeCards.find((card) => card.path !== primaryRoute.path) || routeCards[1];

  const queueItems = sortedAlerts.length
    ? sortedAlerts.slice(0, 4).map((alert) => {
        const route = getRouteForAlert(alert);
        return {
          key: alert.key,
          title: alert.title,
          hint: alert.description || route.hint,
          icon: route.icon,
          path: route.path,
          tone: toCardTone(alert.severity),
          value: formatNumber(alert.value),
          meta: `${alert.severity || "low"} priority`,
        };
      })
    : routeCards.slice(1).map((card) => ({
        key: card.key,
        title: card.label,
        hint: card.hint,
        icon: card.icon,
        path: card.path,
        tone: card.tone,
        value: card.value,
        meta: "Quick lane",
      }));

  const metrics = [
    {
      label: "Alerts",
      value: formatNumber(alerts.length),
      note: alerts.length ? "Needs attention" : "No active alerts",
    },
    {
      label: "Users",
      value: formatNumber(activeUsers || totalUsers),
      note: activeUsers ? `${formatNumber(activeUsers)} active in range` : "Registered accounts",
    },
    {
      label: "Reach",
      value: formatNumber(reach),
      note: "Exposure across the selected range",
    },
    {
      label: "Messages",
      value: formatNumber(totalMessages),
      note: navDots.messages ? "Conversation traffic is active" : "Monitor the inbox",
    },
    {
      label: "Book Review",
      value: formatNumber(pendingBookReviews),
      note: pendingBookReviews ? "Awaiting approval" : "No pending manuscripts",
    },
  ];

  const navigateTo = (path) => {
    if (!path || typeof onNavigate !== "function") {
      return;
    }
    onNavigate(path);
  };

  return (
    <section className={`tdash-summary tdash-summary--${primaryTone}`}>
      <div className="tdash-summary__hero">
        <div className="tdash-summary__eyebrow">
          <span className={`tdash-summary__badge tdash-summary__badge--${primaryTone}`}>
            {summaryBadge}
          </span>
          <span>Action center</span>
          <span className="tdash-summary__scope">{scopeLabel}</span>
        </div>

        <h3 className="tdash-summary__title">{summaryTitle}</h3>
        <p className="tdash-summary__copy">{summaryCopy}</p>

        <div className="tdash-summary__actions">
          <button
            type="button"
            className="tdash-summary__primary"
            onClick={() => navigateTo(primaryRoute.path)}
          >
            Open {primaryRoute.label}
          </button>
          <button
            type="button"
            className="tdash-summary__secondary"
            onClick={() => navigateTo(followUpRoute?.path || "/admin/analytics")}
          >
            Open {followUpRoute?.label || "Analytics"}
          </button>
        </div>
      </div>

      <aside className="tdash-summary__rail" aria-label={alerts.length ? "Active alert queue" : "Admin quick lanes"}>
        <div className="tdash-summary__rail-head">
          <div>
            <span>{alerts.length ? "Needs review" : "Ready when needed"}</span>
            <h4>{alerts.length ? "Priority queue" : "Quick lanes"}</h4>
          </div>
          <strong>{alerts.length || queueItems.length}</strong>
        </div>

        <div className="tdash-summary__queue">
          {queueItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tdash-queue-item tdash-queue-item--${item.tone}`}
            onClick={() => navigateTo(item.path)}
          >
            <span className="tdash-queue-item__icon">
              <AdminDashboardIcon name={item.icon} size={17} />
            </span>
            <span className="tdash-queue-item__copy">
              <span className="tdash-queue-item__meta">{item.meta}</span>
              <strong>{item.title}</strong>
              <small>{item.hint}</small>
            </span>
            <span className="tdash-queue-item__value">
              <strong>{item.value}</strong>
              <AdminDashboardIcon name="arrowRight" size={15} />
            </span>
          </button>
          ))}
        </div>

        {alerts.length > queueItems.length ? (
          <button type="button" className="tdash-summary__queue-more" onClick={() => navigateTo("/admin/analytics")}>
            +{alerts.length - queueItems.length} more active alert{alerts.length - queueItems.length === 1 ? "" : "s"}
            <AdminDashboardIcon name="arrowRight" size={15} />
          </button>
        ) : null}
      </aside>

      <div className="tdash-summary__metrics" aria-label="Operational tracking metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="tdash-summary__metric">
            <span className="tdash-summary__metric-label">{metric.label}</span>
            <strong className="tdash-summary__metric-value">{metric.value}</strong>
            <span className="tdash-summary__metric-note">{metric.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
