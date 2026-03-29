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

  return alertRoutes[alert.key] || defaultRoute;
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

  const primaryAlert = pickPrimaryAlert(alerts);
  const primaryRoute = getRouteForAlert(primaryAlert);
  const primaryTone = toCardTone(primaryAlert?.severity);

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
    ? `There are ${alerts.length} active alert${alerts.length === 1 ? "" : "s"}. Start with ${primaryRoute.label.toLowerCase()} first, then move through the quick lanes below to clear the rest of the queue.`
    : dataMode === "live"
      ? "No critical alerts are active right now. Use the quick lanes to check Messages, Content, and Analytics before the next issue grows."
      : "The dashboard is in a limited-data state. The quick lanes still point you to the most useful places to inspect first.";

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
      value: formatNumber(recentPosts || totalPosts),
      hint: recentPosts ? `${recentPosts} recent posts are already surfaced.` : "Review the content queue and moderation paths.",
      icon: "posts",
      tone: recentPosts ? "low" : "medium",
      path: "/admin/content",
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
  ];

  const navigateTo = (path) => {
    if (!path || typeof onNavigate !== "function") {
      return;
    }
    onNavigate(path);
  };

  return (
    <section className="tdash-summary">
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

        <div className="tdash-summary__metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className="tdash-summary__metric">
              <span className="tdash-summary__metric-label">{metric.label}</span>
              <strong className="tdash-summary__metric-value">{metric.value}</strong>
              <span className="tdash-summary__metric-note">{metric.note}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="tdash-summary__rail">
        {routeCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`tdash-summary-card tdash-summary-card--${card.tone}`}
            onClick={() => navigateTo(card.path)}
          >
            <div className="tdash-summary-card__top">
              <span className="tdash-summary-card__icon">
                <AdminDashboardIcon name={card.icon} size={16} />
              </span>
              <span className="tdash-summary-card__label">{card.label}</span>
            </div>
            <div className="tdash-summary-card__value">{card.value}</div>
            <div className="tdash-summary-card__hint">{card.hint}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
