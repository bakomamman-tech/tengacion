import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock("../../api", () => ({
  API_BASE:
    "http://example.test/api",
  apiRequest: mocks.apiRequest,
}));

vi.mock(
  "../../components/AdminShell",
  () => ({
    default: ({ children }) => (
      <div>{children}</div>
    ),
  })
);

import ExternalReadiness from "../ExternalReadiness";

const capital010Package = {
  key: "CAPITAL-010",
  title:
    "Close Or Narrow Capital Blockers",
  cycle: "capital",
  kind: "risk",

  requirements: [
    "Blocker categories:",
    "weak revenue quality",
    "disputed GMV",
    "creator earnings uncertainty",
    "payout exposure uncertainty",
    "refund or dispute uncertainty",
    "poor retention",
    "unclear acquisition efficiency",
    "stale data-room evidence",
    "unresolved legal, tax, compliance, audit, or security blocker",
    "risky partner terms",
    "unsupported Akuso claims",
    "For each blocker, decide:",
    "close with evidence",
    "narrow the claim",
    "delay outreach",
    "change financing path",
    "accept risk with advisor review",
  ],

  acceptanceCriteria: [
    "blockers have clear decisions",
    "outreach scope matches readiness",
    "capital conversations are not used to outrun operating gaps",
  ],

  operationalStatus:
    "evidence_needed",
};

const auditPackage = {
  key: "AUDIT-012",
  title:
    "Retest High-risk Findings",
  cycle: "audit",
  kind: "retest",
  requirements: [],
  acceptanceCriteria: [],
  operationalStatus:
    "evidence_needed",
};

const capital009Record = {
  id: "capital-009-record",
  _id: "capital-009-record",
  __v: 2,

  packageKey: "CAPITAL-009",
  title:
    "Unit economics review",

  status: "draft",
  readiness:
    "evidence_needed",

  blockers: [],

  unitEconomicsAnalysis: {
    riskTriggers: [
      {
        key:
          "retention_floor",
        state: "triggered",
      },
      {
        key:
          "cac_ceiling",
        state: "clear",
      },
    ],
  },
};

const capital010Record = {
  id: "capital-010-record",
  _id: "capital-010-record",
  __v: 4,

  packageKey: "CAPITAL-010",

  title:
    "Retention outreach hold",

  owner: "owner-1",

  domain:
    "external_reporting",

  scope:
    "Capital readiness blocker review",

  exclusions: "",

  dueAt:
    "2026-09-20T12:00:00.000Z",

  expiresAt:
    "2026-10-20T12:00:00.000Z",

  cadence: "once",

  withdrawalRule: "",

  publicSummary: "",

  audience: "internal",

  classification:
    "restricted",

  evidence: [],

  responses: [],

  dependencies: [],

  findingIds: [],

  relatedControlKeys: [],

  risk: {
    severity: "medium",
  },

  capitalBlocker: {
    category:
      "poor_retention",

    resolution:
      "delay_outreach",

    rationale:
      "Retention evidence is not yet sufficient for external capital conversations.",

    outreachConstraint:
      "Do not begin investor or strategic partner outreach until retention evidence is independently reviewed.",

    economicsRiskKeys: [
      "retention_floor",
    ],
  },

  status: "draft",

  readiness:
    "evidence_needed",

  blockers: [
    "owner_signoff_missing",
  ],

  capitalBlockerAnalysis: {
    category:
      "poor_retention",

    resolution:
      "delay_outreach",

    state:
      "candidate_for_independent_review",

    blockers: [],

    humanDecisionRecorded:
      false,

    realWorldClosureEstablished:
      false,

    outreachAuthorized:
      false,

    financingChangeAuthorized:
      false,

    riskAcceptedBySoftware:
      false,

    moneyMovementAuthorized:
      false,

    externalUse:
      "requires_current_evidence_and_independent_human_review",
  },
};

const report = {
  summary: {
    packageCount: 47,
    records: 2,
    readyRecords: 0,
    alerts: 0,

    decision:
      "hold_for_evidence",
  },

  limits: {
    scope:
      "Internal all-time readiness inventory.",
    truncated: false,
  },

  packages: [
    auditPackage,
    capital010Package,
  ],

  records: [
    capital009Record,
    capital010Record,
  ],

  calendar: [],
  alerts: [],
  shares: [],
  questions: [],

  domains: [
    "external_reporting",
  ],

  financialKeys: [],

  unitEconomicsConfig: {
    metrics: [],
  },

  capitalBlockerConfig: {
    categories: [
      {
        key:
          "weak_revenue_quality",
        label:
          "Weak revenue quality",
      },
      {
        key:
          "disputed_gmv",
        label:
          "Disputed GMV",
      },
      {
        key:
          "creator_earnings_uncertainty",
        label:
          "Creator earnings uncertainty",
      },
      {
        key:
          "payout_exposure_uncertainty",
        label:
          "Payout exposure uncertainty",
      },
      {
        key:
          "refund_or_dispute_uncertainty",
        label:
          "Refund or dispute uncertainty",
      },
      {
        key:
          "poor_retention",
        label:
          "Poor retention",
      },
      {
        key:
          "unclear_acquisition_efficiency",
        label:
          "Unclear acquisition efficiency",
      },
      {
        key:
          "stale_data_room_evidence",
        label:
          "Stale data-room evidence",
      },
      {
        key:
          "legal_tax_compliance_audit_or_security",
        label:
          "Unresolved legal, tax, compliance, audit, or security blocker",
      },
      {
        key:
          "risky_partner_terms",
        label:
          "Risky partner terms",
      },
      {
        key:
          "unsupported_akuso_claims",
        label:
          "Unsupported Akuso claims",
      },
    ],

    decisions: [
      "close_with_evidence",
      "narrow_claim",
      "delay_outreach",
      "change_financing_path",
      "accept_risk_with_advisor_review",
    ],
  },
};

const renderPage = async () => {
  render(
    <ExternalReadiness
      user={{
        _id: "owner-1",
        role: "admin",
      }}
    />
  );

  await screen.findByText(
    "Operating report"
  );
};

const selectCapital010 =
  async () => {
    const selector =
      screen.getByLabelText(
        "Roadmap package"
      );

    fireEvent.change(
      selector,
      {
        target: {
          value:
            "CAPITAL-010",
        },
      }
    );

    await screen.findByText(
      "CAPITAL-010 Capital Blockers"
    );
  };

describe(
  "CAPITAL-010 frontend governance workspace",
  () => {
    beforeEach(() => {
      mocks.apiRequest.mockReset();

      mocks.apiRequest.mockResolvedValue(
        report
      );
    });

    test(
      "renders CAPITAL-010 with explicit human-review-only authority boundaries",
      async () => {
        await renderPage();
        await selectCapital010();

        expect(
          screen.getByText(
            /Human review only/i
          )
        ).toBeTruthy();

        expect(
          screen.getByText(
            /does not establish real-world closure/i
          )
        ).toBeTruthy();

        expect(
          screen.getByText(
            /authorize investor or partner outreach/i
          )
        ).toBeTruthy();

        expect(
          screen.getByText(
            /approve spending, or move money/i
          )
        ).toBeTruthy();
      }
    );

    test(
      "shows resolution-specific fields for claim narrowing, outreach delay and financing changes",
      async () => {
        await renderPage();
        await selectCapital010();

        const resolution =
          screen.getByLabelText(
            "Resolution decision"
          );

        fireEvent.change(
          resolution,
          {
            target: {
              value:
                "narrow_claim",
            },
          }
        );

        expect(
          screen.getByLabelText(
            "Original claim"
          )
        ).toBeTruthy();

        expect(
          screen.getByLabelText(
            "Revised narrower claim"
          )
        ).toBeTruthy();

        fireEvent.change(
          resolution,
          {
            target: {
              value:
                "delay_outreach",
            },
          }
        );

        expect(
          screen.getByLabelText(
            "Outreach constraint"
          )
        ).toBeTruthy();

        fireEvent.change(
          resolution,
          {
            target: {
              value:
                "change_financing_path",
            },
          }
        );

        expect(
          screen.getByLabelText(
            "Proposed financing path"
          )
        ).toBeTruthy();
      }
    );

    test(
      "shows advisor-review controls and preserves critical-risk warning",
      async () => {
        await renderPage();
        await selectCapital010();

        fireEvent.change(
          screen.getByLabelText(
            "Resolution decision"
          ),
          {
            target: {
              value:
                "accept_risk_with_advisor_review",
            },
          }
        );

        expect(
          screen.getByText(
            /Critical risk cannot be accepted through this record/i
          )
        ).toBeTruthy();

        expect(
          screen.getByLabelText(
            "Severity"
          )
        ).toBeTruthy();

        expect(
          screen.getByLabelText(
            "Mitigation"
          )
        ).toBeTruthy();

        expect(
          screen.getByLabelText(
            "Compensating control"
          )
        ).toBeTruthy();

        expect(
          screen.getByLabelText(
            "Review trigger"
          )
        ).toBeTruthy();

        expect(
          screen.getByLabelText(
            /Accepted until/i
          )
        ).toBeTruthy();

        expect(
          screen.getByText(
            "Advisor review evidence"
          )
        ).toBeTruthy();
      }
    );

    test(
      "surfaces CAPITAL-009 risk triggers for governed linkage",
      async () => {
        await renderPage();
        await selectCapital010();

        expect(
          screen.getByText(
            "retention_floor"
          )
        ).toBeTruthy();

        expect(
          screen.getByText(
            "cac_ceiling"
          )
        ).toBeTruthy();

        expect(
          screen.getByLabelText(
            /Economics risk keys/i
          )
        ).toBeTruthy();
      }
    );

    test(
      "locks review transitions when a saved CAPITAL-010 decision has unsaved governance edits",
      async () => {
        await renderPage();
        await selectCapital010();

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Retention outreach hold",
            }
          )
        );

        await screen.findByText(
          /Review saved version 4/i
        );

        fireEvent.change(
          screen.getByLabelText(
            "Reason for this action"
          ),
          {
            target: {
              value:
                "Review current blocker decision",
            },
          }
        );

        const approve =
          screen.getByRole(
            "button",
            {
              name: "Approve",
            }
          );

        expect(
          approve.disabled
        ).toBe(false);

        fireEvent.change(
          screen.getByLabelText(
            "Decision rationale"
          ),
          {
            target: {
              value:
                "Retention evidence changed and this decision now requires another saved review.",
            },
          }
        );

        await waitFor(() => {
          expect(
            screen.getByText(
              /unsaved CAPITAL-009 or CAPITAL-010 or CAPITAL-011 governance changes must be saved/i
            )
          ).toBeTruthy();

          expect(
            approve.disabled
          ).toBe(true);
        });
      }
    );

    test(
      "shows saved CAPITAL-010 analysis while keeping software authority false",
      async () => {
        await renderPage();
        await selectCapital010();

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Retention outreach hold",
            }
          )
        );

        await screen.findByText(
          "Saved CAPITAL-010 analysis"
        );

        expect(
          screen.getByText(
            /Real-world closure established by software: No/i
          )
        ).toBeTruthy();

        expect(
          screen.getByText(
            /Outreach authorized by software: No/i
          )
        ).toBeTruthy();

        expect(
          screen.getByText(
            /Financing change authorized by software: No/i
          )
        ).toBeTruthy();

        expect(
          screen.getByText(
            /Risk accepted by software: No/i
          )
        ).toBeTruthy();

        expect(
          screen.getByText(
            /Money movement authorized by software: No/i
          )
        ).toBeTruthy();
      }
    );
  }
);