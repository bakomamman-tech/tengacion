const categories = [
  {
    key: "weak_revenue_quality",
    label: "Weak revenue quality",
  },
  {
    key: "disputed_gmv",
    label: "Disputed GMV",
  },
  {
    key: "creator_earnings_uncertainty",
    label: "Creator earnings uncertainty",
  },
  {
    key: "payout_exposure_uncertainty",
    label: "Payout exposure uncertainty",
  },
  {
    key: "refund_or_dispute_uncertainty",
    label: "Refund or dispute uncertainty",
  },
  {
    key: "poor_retention",
    label: "Poor retention",
  },
  {
    key: "unclear_acquisition_efficiency",
    label: "Unclear acquisition efficiency",
  },
  {
    key: "stale_data_room_evidence",
    label: "Stale data-room evidence",
  },
  {
    key: "legal_tax_compliance_audit_or_security",
    label:
      "Unresolved legal, tax, compliance, audit, or security blocker",
  },
  {
    key: "risky_partner_terms",
    label: "Risky partner terms",
  },
  {
    key: "unsupported_akuso_claims",
    label: "Unsupported Akuso claims",
  },
];

const decisions = [
  "close_with_evidence",
  "narrow_claim",
  "delay_outreach",
  "change_financing_path",
  "accept_risk_with_advisor_review",
];

module.exports = {
  categories,
  categoryKeys: categories.map(
    (entry) => entry.key
  ),
  decisions,
};