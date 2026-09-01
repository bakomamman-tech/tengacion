import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminAnalyticsPage from "../AdminAnalytics";
import {
  adminGetAnalyticsCommerceOps,
  adminGetAnalyticsContentUploads,
  adminGetAnalyticsEngagement,
  adminGetAnalyticsFanRetention,
  adminGetAnalyticsOverview,
  adminGetAnalyticsProductScorecard,
  adminGetAnalyticsRecommendations,
  adminGetAnalyticsRecentActivity,
  adminGetAnalyticsReliabilityHealth,
  adminGetAnalyticsReportsSummary,
  adminGetAnalyticsRevenue,
  adminGetAnalyticsSystemAlerts,
  adminGetAnalyticsTopContent,
  adminGetAnalyticsTopCreators,
  adminGetAnalyticsUserGrowth,
  adminGetExecutiveOperatingDashboard,
  adminUpdateRecommendationPolicy,
} from "../../api";

vi.mock("../../components/AdminShell", () => ({
  default: ({ title, subtitle, actions, children }) => (
    <div>
      <header>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div>{actions}</div>
      </header>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("recharts", () => {
  const ChartStub = () => null;
  return {
    ResponsiveContainer: ChartStub,
    AreaChart: ChartStub,
    Area: ChartStub,
    CartesianGrid: ChartStub,
    XAxis: ChartStub,
    YAxis: ChartStub,
    Tooltip: ChartStub,
    Legend: ChartStub,
    BarChart: ChartStub,
    Bar: ChartStub,
    LineChart: ChartStub,
    Line: ChartStub,
  };
});

vi.mock("../../api", () => ({
  adminGetAnalyticsCommerceOps: vi.fn(),
  adminGetAnalyticsContentUploads: vi.fn(),
  adminGetAnalyticsEngagement: vi.fn(),
  adminGetAnalyticsFanRetention: vi.fn(),
  adminGetAnalyticsOverview: vi.fn(),
  adminGetAnalyticsProductScorecard: vi.fn(),
  adminGetAnalyticsRecommendations: vi.fn(),
  adminGetAnalyticsRecentActivity: vi.fn(),
  adminGetAnalyticsReliabilityHealth: vi.fn(),
  adminGetAnalyticsReportsSummary: vi.fn(),
  adminGetAnalyticsRevenue: vi.fn(),
  adminGetAnalyticsSystemAlerts: vi.fn(),
  adminGetAnalyticsTopContent: vi.fn(),
  adminGetAnalyticsTopCreators: vi.fn(),
  adminGetAnalyticsUserGrowth: vi.fn(),
  adminGetExecutiveOperatingDashboard: vi.fn(),
  adminUpdateRecommendationPolicy: vi.fn(),
  adminGetLaunchGrowthOperatingSystem: vi.fn().mockResolvedValue({}),
  adminGetScaleEvidenceOperatingSystem: vi.fn().mockResolvedValue({}),
  adminGetExpansionPlatformOperatingSystem: vi.fn().mockResolvedValue({}),
  adminGetEcosystemNetworkOperatingSystem: vi.fn().mockResolvedValue({}),
  adminGetNetworkIntelligenceOperatingSystem: vi.fn().mockResolvedValue({}),
  adminGetAutomationOrchestrationOperatingSystem: vi.fn().mockResolvedValue({}),
}));

const emptyAnalyticsPayload = { summary: {}, series: [], items: [], alerts: [] };

describe("AdminAnalytics product scorecard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    [
      adminGetAnalyticsCommerceOps,
      adminGetAnalyticsContentUploads,
      adminGetAnalyticsEngagement,
      adminGetAnalyticsFanRetention,
      adminGetAnalyticsOverview,
      adminGetAnalyticsRecentActivity,
      adminGetAnalyticsReliabilityHealth,
      adminGetAnalyticsReportsSummary,
      adminGetAnalyticsRevenue,
      adminGetAnalyticsSystemAlerts,
      adminGetAnalyticsTopContent,
      adminGetAnalyticsTopCreators,
      adminGetAnalyticsUserGrowth,
      adminGetExecutiveOperatingDashboard,
    ].forEach((request) => {
      vi.mocked(request).mockResolvedValue(emptyAnalyticsPayload);
    });
    vi.mocked(adminGetAnalyticsRecommendations).mockResolvedValue({
      summary: { requests: 4, conversionRate: 0.05 },
      surfaces: [],
      policy: {
        enabled: true,
        maxRepeatedCreatorCount: 2,
        maxContentTypeStreak: 2,
        minimumExplorationShare: 0.15,
        hideRatePenalty: 18,
        reportRatePenalty: 40,
        conversionRateBoost: 16,
      },
    });
    vi.mocked(adminGetAnalyticsFanRetention).mockResolvedValue({
      summary: { entrants: 3, d7RetentionRate: 0.33 },
      cohorts: [],
      priorities: [],
    });
    vi.mocked(adminGetExecutiveOperatingDashboard).mockResolvedValue({
      summary: { onTarget: 1, watch: 0, offTarget: 0 },
      metrics: [
        {
          key: "checkout_success",
          label: "Checkout success",
          current: 0.96,
          previous: 0.91,
          fourWeekAverage: 0.93,
          target: 0.95,
          format: "percent",
          status: "on_target",
          drilldown: "/admin/transactions",
        },
      ],
      actions: [],
    });
    vi.mocked(adminUpdateRecommendationPolicy).mockResolvedValue({ success: true });

    vi.mocked(adminGetAnalyticsProductScorecard).mockResolvedValue({
      capture: {
        status: "insufficient_telemetry_window",
        ready: false,
        message: "Production telemetry currently spans 5 of 30 required calendar days.",
        requiredWindowDays: 30,
        observedWindowDays: 5,
      },
      summary: {
        totalRouteViews: 12,
        authenticatedViews: 9,
        anonymousViews: 3,
        uniqueAuthenticatedUsers: 4,
        viewedFeatureCount: 2,
        registryFeatureCount: 38,
        productionFeatureCoverageRate: 0.0833,
        unclassifiedViews: 0,
      },
      distributions: {
        lifecycle: [
          { key: "production", views: 11, share: 0.9167 },
          { key: "beta", views: 1, share: 0.0833 },
        ],
        surface: [],
        access: [],
      },
      features: [
        {
          featureId: "public_marketing",
          title: "Public marketing and company information",
          lifecycle: "production",
          surface: "public",
          views: 8,
          share: 0.6667,
        },
        {
          featureId: "home",
          title: "Home feed",
          lifecycle: "production",
          surface: "home",
          views: 4,
          share: 0.3333,
        },
      ],
      zeroViewProductionFeatures: [{ featureId: "news" }, { featureId: "messages" }],
    });
  });

  it("shows honest baseline readiness and governed feature adoption", async () => {
    render(
      <MemoryRouter>
        <AdminAnalyticsPage user={{ id: "admin-1", role: "admin" }} />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Baseline Product Scorecard" })).toBeInTheDocument();
    expect(screen.getByText("Insufficient Telemetry Window")).toBeInTheDocument();
    expect(
      screen.getByText("Production telemetry currently spans 5 of 30 required calendar days.")
    ).toBeInTheDocument();
    expect(screen.getByText("Public marketing and company information")).toBeInTheDocument();
    expect(screen.getByText("8 views")).toBeInTheDocument();
    expect(screen.getByText("Zero-view production features 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Executive Operating Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fan Retention Cohorts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recommendation Trust and Diversity" })).toBeInTheDocument();

    await waitFor(() => {
      expect(adminGetAnalyticsProductScorecard).toHaveBeenCalledWith({
        range: "30d",
        category: "all",
        interval: "daily",
      });
    });
  });
});
