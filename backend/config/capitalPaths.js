const paths = [
  {
    key: "no_external_capital_yet",
    label: "No external capital yet",
  },
  {
    key: "targeted_advisor_review",
    label: "Targeted advisor review",
  },
  {
    key: "targeted_angel_or_seed_outreach",
    label: "Targeted angel or seed outreach",
  },
  {
    key: "strategic_partner_capital",
    label: "Strategic partner capital",
  },
  {
    key: "enterprise_prepayment_strategy",
    label: "Enterprise prepayment strategy",
  },
  {
    key: "creator_institution_partnership_funding",
    label: "Creator institution partnership funding",
  },
  {
    key: "revenue_backed_growth",
    label: "Revenue-backed growth",
  },
  {
    key: "grant_or_ecosystem_program",
    label: "Grant or ecosystem program",
  },
  {
    key: "defer_and_prove_milestones",
    label: "Defer and prove milestones",
  },
];

const packetSections = [
  {
    key: "readiness_scorecard",
    label: "Readiness scorecard",
  },
  {
    key: "financial_model",
    label: "Financial model",
  },
  {
    key: "use_of_funds_plan",
    label: "Use-of-funds plan",
  },
  {
    key: "risk_register",
    label: "Risk register",
  },
  {
    key: "diligence_packet_status",
    label: "Diligence packet status",
  },
  {
    key: "team_capacity",
    label: "Team capacity",
  },
  {
    key: "legal_and_tax_review_needs",
    label: "Legal and tax review needs",
  },
  {
    key: "akuso_and_ai_claim_limits",
    label: "Akuso and AI claim limits",
  },
];

module.exports = {
  paths,
  pathKeys: paths.map(
    (entry) => entry.key
  ),

  packetSections,
  packetSectionKeys:
    packetSections.map(
      (entry) => entry.key
    ),
};