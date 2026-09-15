const capitalTitles = [
  "Run Controlled Outreach Or Strategic Conversations",
  "Update Financial Model And Allocation Plan From Feedback",
  "Publish Capital Readiness And Runway Report",
  "Decide The Next Capital Maturity Focus",
];

const distributionTitles = [
  "Create the distribution thesis and channel scorecard",
  "Select the first category and creator supply pilots",
  "Instrument fan activation and referral loops",
  "Standardize sales, partner, sponsor, and campaign packages",
  "Align brand, support, moderation, finance, and local market gates",
  "Prepare Akuso for go-to-market support",
  "Launch the first creator category pilots",
  "Run fan acquisition and referral pilots",
  "Test sales, partner, sponsor, and campaign operations",
  "Build channel-level finance and operating review",
  "Measure brand, trust, support, and local readiness impact",
  "Use Akuso in controlled go-to-market workflows",
  "Make channel scale decisions",
  "Convert winning category and creator motions into playbooks",
  "Turn fan and community loops into lifecycle programs",
  "Establish revenue operations for repeatable sales and partnerships",
  "Publish distribution operating report and next-cycle decision",
  "Mature Akuso distribution governance",
];

const revenueTitles = [
  "Define The Revenue Thesis And Line Scorecard",
  "Create Pricing, Package, Discount, And Promotion Guardrails",
  "Map Creator Monetization And Category Earnings Playbooks",
  "Instrument Fan Revenue Lifecycle And Subscription Events",
  "Establish Revenue Quality, Finance, And Claim Controls",
  "Scope Akuso Revenue Support And Blocked Decisions",
  "Launch First Revenue Line Pilots",
  "Test Subscriptions, Bundles, And Lifecycle Revenue",
  "Validate Partner, Sponsor, Enterprise, And Institution Packages",
  "Validate Revenue Quality And Cohort Economics",
  "Improve Creator And Fan Trust In Monetization",
  "Pilot Akuso Commercial Workflows",
  "Make Revenue Engine Scale Decisions",
  "Convert Winning Creator Monetization Motions Into Playbooks",
  "Build Fan Lifecycle Revenue Programs",
  "Stabilize Commercial Revenue Operations",
  "Publish Revenue Operating Report And Next-cycle Decision",
  "Mature Akuso Revenue Governance",
];

const commercialTitles = [
  "Build Profitability And Contribution Margin Scorecard",
  "Measure Revenue Concentration And Dependency Risk",
  "Establish Pricing Fairness And Value Review",
  "Review Creator And Fan Value Distribution",
  "Improve Cash Conversion And Working Capital Visibility",
  "Validate Partner And Channel Margin Quality",
  "Reduce Support And Operating Cost Per Revenue Workflow",
  "Detect Commercial Leakage, Abuse, And Promotion Risk",
  "Measure Akuso Commercial ROI And Cost Discipline",
  "Decide The Next Commercial Growth Path",
];

const sources = {
  capital: "docs/tengacion-capital-30-60-90-roadmap.md",
  distribution: "docs/tengacion-distribution-30-60-90-roadmap.md",
  revenue: "docs/tengacion-revenue-30-60-90-roadmap.md",
  commercial: "docs/tengacion-next-fifty-commercial-readiness-controls.md",
};

const decisionKeys = new Set([
  "CAPITAL-015",
  "DISTRIBUTION-013",
  "DISTRIBUTION-017",
  "REVENUE-013",
  "REVENUE-017",
  "COMMERCIAL-010",
]);

const scopeKeys = new Set([
  "DISTRIBUTION-001",
  "REVENUE-001",
]);

const contract = (key, title, cycle) => {
  const kind = decisionKeys.has(key)
    ? "decision"
    : scopeKeys.has(key)
      ? "scope"
      : "review";

  return {
    key,
    title,
    cycle,
    kind,
    source: sources[cycle],
    requirements: [
      `Objective: ${title}`,
      `current ${cycle} evidence with named owner, source, confidence, observation date, and expiry`,
      "reviewable dependencies, blockers, operating risk, support impact, trust impact, and rollback or reversal conditions",
      "explicit human authority boundaries for pricing, contracts, financing, payouts, refunds, account actions, risk acceptance, spending, and money movement",
      ...(kind === "decision"
        ? ["human-selected decision, alternatives, rationale, review date, and reversal condition"]
        : []),
    ],
    acceptanceCriteria: [
      `${cycle} readiness is derived from current evidence rather than configuration or intent`,
      "owner attestation and independent review are required before approval",
      kind === "decision"
        ? "the decision record is advisory and cannot execute the underlying commercial or financial action"
        : "missing, stale, disputed, or blocked evidence prevents a confident readiness claim",
    ],
  };
};

const numbered = (prefix, cycle, titles, start = 1) =>
  titles.map((title, index) =>
    contract(
      `${prefix}-${String(start + index).padStart(3, "0")}`,
      title,
      cycle
    )
  );

module.exports = [
  ...numbered("CAPITAL", "capital", capitalTitles, 12),
  ...numbered("DISTRIBUTION", "distribution", distributionTitles),
  ...numbered("REVENUE", "revenue", revenueTitles),
  ...numbered("COMMERCIAL", "commercial", commercialTitles),
];
