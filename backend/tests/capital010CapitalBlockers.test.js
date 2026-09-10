const mongoose = require("mongoose");

const Record = require("../models/ExternalReadinessRecord");
const Finding = require("../models/AuditFinding");

const {
  categories,
  categoryKeys,
  decisions,
} = require("../config/capitalBlockers");

const catalog = require("../config/externalReadinessCatalog");

const {
  analyzeCapitalBlocker,
} = require("../services/capitalBlockerAnalysis");

const service = require("../services/externalReadinessService");

const NOW = new Date("2026-09-10T12:00:00.000Z");

const currentEvidence = (
  overrides = {}
) => ({
  source: "Controlled test evidence",
  summary: "Current evidence for CAPITAL-010 validation",
  observedAt: new Date("2026-09-09T12:00:00.000Z"),
  expiresAt: new Date("2026-10-10T12:00:00.000Z"),
  confidence: "current",
  ...overrides,
});

const baseModel = (
  overrides = {}
) => {
  const actor =
    new mongoose.Types.ObjectId();

  return {
    packageKey: "CAPITAL-010",
    title: "Capital blocker decision",
    owner: actor,
    domain: "external_reporting",
    scope: "Capital readiness blocker review",
    dueAt: new Date(
      Date.now() + 86400000
    ),
    expiresAt: new Date(
      Date.now() + 7 * 86400000
    ),
    createdBy: actor,
    lastChangedBy: actor,
    ...overrides,
  };
};

describe(
  "CAPITAL-010 Close Or Narrow Capital Blockers",
  () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test(
      "catalog exposes CAPITAL-010 as a risk package",
      () => {
        const spec =
          catalog.find(
            (entry) =>
              entry.key ===
              "CAPITAL-010"
          );

        expect(spec).toBeDefined();
        expect(spec.kind).toBe("risk");
        expect(spec.title).toBe(
          "Close Or Narrow Capital Blockers"
        );
      }
    );

    test(
      "configuration preserves all roadmap blocker categories and decisions",
      () => {
        expect(categories).toHaveLength(11);
        expect(categoryKeys).toHaveLength(11);
        expect(decisions).toHaveLength(5);

        expect(
          categoryKeys
        ).toContain(
          "weak_revenue_quality"
        );

        expect(
          categoryKeys
        ).toContain(
          "unsupported_akuso_claims"
        );

        expect(decisions).toContain(
          "close_with_evidence"
        );

        expect(decisions).toContain(
          "accept_risk_with_advisor_review"
        );
      }
    );

    test(
      "empty blocker decision remains incomplete",
      () => {
        const result =
          analyzeCapitalBlocker(
            {
              capitalBlocker: {},
              evidence: [],
              status: "draft",
            },
            NOW
          );

        expect(
          result.blockers
        ).toEqual(
          expect.arrayContaining([
            "capital_blocker_category_missing",
            "capital_blocker_decision_missing",
            "capital_blocker_rationale_missing",
          ])
        );

        expect(
          result.state
        ).toBe(
          "incomplete_or_on_hold"
        );
      }
    );

    test(
      "close with evidence requires current linked evidence",
      () => {
        const result =
          analyzeCapitalBlocker(
            {
              status: "draft",
              evidence: [],
              capitalBlocker: {
                category:
                  "weak_revenue_quality",
                resolution:
                  "close_with_evidence",
                rationale:
                  "Revenue-quality blocker appears resolved.",
                evidenceIndexes: [],
              },
            },
            NOW
          );

        expect(
          result.blockers
        ).toContain(
          "capital_blocker_current_evidence_required"
        );
      }
    );

    test(
      "close with evidence becomes reviewable with current evidence",
      () => {
        const result =
          analyzeCapitalBlocker(
            {
              status: "draft",
              evidence: [
                currentEvidence(),
              ],
              capitalBlocker: {
                category:
                  "weak_revenue_quality",
                resolution:
                  "close_with_evidence",
                rationale:
                  "Current evidence supports closing the blocker for review.",
                evidenceIndexes: [0],
              },
            },
            NOW
          );

        expect(
          result.blockers
        ).toEqual([]);

        expect(
          result.state
        ).toBe(
          "candidate_for_independent_review"
        );

        expect(
          result.realWorldClosureEstablished
        ).toBe(false);

        expect(
          result.outreachAuthorized
        ).toBe(false);

        expect(
          result.moneyMovementAuthorized
        ).toBe(false);
      }
    );

    test(
      "stale evidence cannot close a blocker",
      () => {
        const result =
          analyzeCapitalBlocker(
            {
              status: "draft",
              evidence: [
                currentEvidence({
                  expiresAt:
                    new Date(
                      "2026-09-10T11:00:00.000Z"
                    ),
                }),
              ],
              capitalBlocker: {
                category:
                  "disputed_gmv",
                resolution:
                  "close_with_evidence",
                rationale:
                  "Attempted closure using stale evidence.",
                evidenceIndexes: [0],
              },
            },
            NOW
          );

        expect(
          result.blockers
        ).toContain(
          "capital_blocker_current_evidence_required"
        );
      }
    );

    test(
      "narrow claim requires original and materially revised claims",
      () => {
        const result =
          analyzeCapitalBlocker(
            {
              status: "draft",
              evidence: [
                currentEvidence(),
              ],
              capitalBlocker: {
                category:
                  "creator_earnings_uncertainty",
                resolution:
                  "narrow_claim",
                rationale:
                  "The claim needs narrower scope.",
                originalClaim:
                  "Creators always achieve reliable earnings.",
                revisedClaim:
                  "Creators always achieve reliable earnings.",
                evidenceIndexes: [0],
              },
            },
            NOW
          );

        expect(
          result.blockers
        ).toContain(
          "capital_blocker_claim_narrowing_required"
        );
      }
    );

    test(
      "narrow claim passes when the revised claim differs and evidence is current",
      () => {
        const result =
          analyzeCapitalBlocker(
            {
              status: "draft",
              evidence: [
                currentEvidence(),
              ],
              capitalBlocker: {
                category:
                  "creator_earnings_uncertainty",
                resolution:
                  "narrow_claim",
                rationale:
                  "Only the evidenced cohort should be described.",
                originalClaim:
                  "All creators have predictable earnings.",
                revisedClaim:
                  "Observed earnings are available only for the reviewed creator cohort.",
                evidenceIndexes: [0],
              },
            },
            NOW
          );

        expect(
          result.blockers
        ).toEqual([]);
      }
    );

    test(
      "delay outreach requires an explicit outreach constraint",
      () => {
        const result =
          analyzeCapitalBlocker(
            {
              status: "draft",
              evidence: [],
              capitalBlocker: {
                category:
                  "poor_retention",
                resolution:
                  "delay_outreach",
                rationale:
                  "Retention evidence is not ready.",
              },
            },
            NOW
          );

        expect(
          result.blockers
        ).toContain(
          "capital_blocker_outreach_constraint_required"
        );
      }
    );

    test(
      "delay outreach does not automatically require generic risk mitigation",
      () => {
        const future =
          new Date(
            NOW.getTime() +
              86400000
          );

        const blockers =
          service.localBlockers(
            {
              packageKey:
                "CAPITAL-010",
              expiresAt: future,
              dueAt: future,
              evidence: [],
              responses: [],
              audience: "internal",
              owner: null,
              ownerAttestedBy: null,
              risk: {},
              capitalBlocker: {
                category:
                  "poor_retention",
                resolution:
                  "delay_outreach",
                rationale:
                  "Retention is not sufficiently evidenced.",
                outreachConstraint:
                  "Do not begin investor outreach until retention evidence is reviewed.",
              },
            },
            NOW
          );

        expect(
          blockers
        ).not.toContain(
          "risk_mitigation_missing"
        );
      }
    );

    test(
      "change financing path requires a named financing path",
      () => {
        const result =
          analyzeCapitalBlocker(
            {
              status: "draft",
              evidence: [],
              capitalBlocker: {
                category:
                  "payout_exposure_uncertainty",
                resolution:
                  "change_financing_path",
                rationale:
                  "The financing approach should change.",
              },
            },
            NOW
          );

        expect(
          result.blockers
        ).toContain(
          "capital_blocker_financing_path_required"
        );
      }
    );

    test(
      "critical risk cannot be accepted through CAPITAL-010",
      () => {
        const result =
          analyzeCapitalBlocker(
            {
              status: "draft",
              evidence: [
                currentEvidence(),
              ],
              risk: {
                severity: "critical",
                mitigation:
                  "Reduce exposure.",
                compensatingControl:
                  "Independent control review.",
                reviewTrigger:
                  "Any material change.",
                acceptedUntil:
                  new Date(
                    "2026-10-01T00:00:00.000Z"
                  ),
              },
              capitalBlocker: {
                category:
                  "legal_tax_compliance_audit_or_security",
                resolution:
                  "accept_risk_with_advisor_review",
                rationale:
                  "Risk proposed for advisor review.",
                advisorReviewEvidenceIndexes:
                  [0],
              },
            },
            NOW
          );

        expect(
          result.blockers
        ).toContain(
          "capital_blocker_critical_risk_cannot_be_accepted"
        );
      }
    );

    test(
      "advisor-reviewed risk requires controls, future expiry, and current advisor evidence",
      () => {
        const result =
          analyzeCapitalBlocker(
            {
              status: "draft",
              evidence: [],
              risk: {
                severity: "high",
              },
              capitalBlocker: {
                category:
                  "risky_partner_terms",
                resolution:
                  "accept_risk_with_advisor_review",
                rationale:
                  "Risk requires documented advisor review.",
              },
            },
            NOW
          );

        expect(
          result.blockers
        ).toEqual(
          expect.arrayContaining([
            "capital_blocker_risk_expiration_required",
            "capital_blocker_risk_controls_required",
            "capital_blocker_advisor_review_evidence_required",
          ])
        );
      }
    );

    test(
      "advisor-reviewed noncritical risk can become a candidate for independent review",
      () => {
        const result =
          analyzeCapitalBlocker(
            {
              status: "draft",
              evidence: [
                currentEvidence(),
              ],
              risk: {
                severity: "high",
                mitigation:
                  "Limit exposure and narrow the commitment.",
                compensatingControl:
                  "Advisor approval plus contract review.",
                reviewTrigger:
                  "Partner terms materially change.",
                acceptedUntil:
                  new Date(
                    "2026-10-10T00:00:00.000Z"
                  ),
              },
              capitalBlocker: {
                category:
                  "risky_partner_terms",
                resolution:
                  "accept_risk_with_advisor_review",
                rationale:
                  "A human advisor has reviewed the bounded risk.",
                advisorReviewEvidenceIndexes:
                  [0],
              },
            },
            NOW
          );

        expect(
          result.blockers
        ).toEqual([]);

        expect(
          result.state
        ).toBe(
          "candidate_for_independent_review"
        );

        expect(
          result.riskAcceptedBySoftware
        ).toBe(false);

        expect(
          result.outreachAuthorized
        ).toBe(false);

        expect(
          result.financingChangeAuthorized
        ).toBe(false);

        expect(
          result.moneyMovementAuthorized
        ).toBe(false);
      }
    );

    test(
      "invalid evidence indexes are rejected by the analyzer",
      () => {
        const result =
          analyzeCapitalBlocker(
            {
              status: "draft",
              evidence: [
                currentEvidence(),
              ],
              capitalBlocker: {
                category:
                  "stale_data_room_evidence",
                resolution:
                  "close_with_evidence",
                rationale:
                  "Attempted closure.",
                evidenceIndexes: [3],
              },
            },
            NOW
          );

        expect(
          result.blockers
        ).toContain(
          "capital_blocker_evidence_links_invalid"
        );
      }
    );

    test(
      "model prevents capital blocker data from leaking into another package",
      async () => {
        const row =
          new Record(
            baseModel({
              packageKey:
                "CAPITAL-009",

              capitalBlocker: {
                category:
                  "weak_revenue_quality",
                resolution:
                  "delay_outreach",
                rationale:
                  "Test isolation.",
                outreachConstraint:
                  "No outreach.",
              },
            })
          );

        await expect(
          row.validate()
        ).rejects.toMatchObject({
          errors: expect.objectContaining({
            capitalBlocker:
              expect.objectContaining({
                message:
                  "Capital blocker decisions belong to CAPITAL-010",
              }),
          }),
        });
      }
    );

    test(
      "model rejects duplicate CAPITAL-010 evidence indexes",
      async () => {
        const row =
          new Record(
            baseModel({
              evidence: [
                currentEvidence({
                  observedAt:
                    new Date(
                      Date.now() -
                        3600000
                    ),
                  expiresAt:
                    new Date(
                      Date.now() +
                        86400000
                    ),
                }),
              ],

              capitalBlocker: {
                category:
                  "disputed_gmv",
                resolution:
                  "close_with_evidence",
                rationale:
                  "Test duplicate links.",
                evidenceIndexes:
                  [0, 0],
              },
            })
          );

        await expect(
          row.validate()
        ).rejects.toMatchObject({
          errors: expect.objectContaining({
            "capitalBlocker.evidenceIndexes":
              expect.anything(),
          }),
        });
      }
    );

    test(
      "model rejects duplicate CAPITAL-009 economics risk references",
      async () => {
        const row =
          new Record(
            baseModel({
              capitalBlocker: {
                category:
                  "unclear_acquisition_efficiency",
                resolution:
                  "delay_outreach",
                rationale:
                  "Economics risk remains unresolved.",
                outreachConstraint:
                  "Delay capital outreach.",
                economicsRiskKeys: [
                  "cac_floor",
                  "cac_floor",
                ],
              },
            })
          );

        await expect(
          row.validate()
        ).rejects.toMatchObject({
          errors: expect.objectContaining({
            "capitalBlocker.economicsRiskKeys":
              expect.anything(),
          }),
        });
      }
    );

    test(
      "service requires a CAPITAL-009 dependency when economics risk keys are referenced",
      async () => {
        jest
          .spyOn(Finding, "find")
          .mockReturnValue({
            limit: () => ({
              lean:
                async () => [],
            }),
          });

        jest
          .spyOn(Record, "find")
          .mockResolvedValue([]);

        const future =
          new Date(
            NOW.getTime() +
              86400000
          );

        const blockers =
          await service.blockersFor({
            _id:
              new mongoose.Types.ObjectId(),

            packageKey:
              "CAPITAL-010",

            domain:
              "external_reporting",

            expiresAt:
              future,

            dueAt:
              future,

            evidence: [],

            responses: [],

            findingIds: [],

            dependencies: [],

            audience:
              "internal",

            owner: null,

            ownerAttestedBy:
              null,

            risk: {},

            capitalBlocker: {
              category:
                "unclear_acquisition_efficiency",

              resolution:
                "delay_outreach",

              rationale:
                "An economics trigger remains unresolved.",

              outreachConstraint:
                "Do not begin outreach.",

              economicsRiskKeys: [
                "cac_floor",
              ],
            },
          });

        expect(
          blockers
        ).toContain(
          "capital_blocker_economics_dependency_missing"
        );
      }
    );

    test(
      "service recognizes a risk key exposed by a linked CAPITAL-009 record",
      async () => {
        const dependencyId =
          new mongoose.Types.ObjectId();

        const economicsDependency = {
          _id: dependencyId,

          packageKey:
            "CAPITAL-009",

          status: "draft",

          domain:
            "external_reporting",

          expiresAt:
            new Date(
              NOW.getTime() +
                86400000
            ),

          dueAt:
            new Date(
              NOW.getTime() +
                86400000
            ),

          evidence: [],

          responses: [],

          findingIds: [],

          dependencies: [],

          audience: "internal",

          unitEconomics: {
            assumptions: [],
            milestones: [],
            allocationGates: [],

            riskTriggers: [
              {
                key:
                  "retention_floor",
                title:
                  "Retention floor",
                response:
                  "Human review required",
              },
            ],
          },
        };

        jest
          .spyOn(Finding, "find")
          .mockReturnValue({
            limit: () => ({
              lean:
                async () => [],
            }),
          });

        jest
          .spyOn(Record, "find")
          .mockResolvedValueOnce([
            economicsDependency,
          ])
          .mockResolvedValue([]);

        const future =
          new Date(
            NOW.getTime() +
              86400000
          );

        const blockers =
          await service.blockersFor({
            _id:
              new mongoose.Types.ObjectId(),

            packageKey:
              "CAPITAL-010",

            domain:
              "external_reporting",

            expiresAt:
              future,

            dueAt:
              future,

            evidence: [],

            responses: [],

            findingIds: [],

            dependencies: [
              dependencyId,
            ],

            audience:
              "internal",

            owner: null,

            ownerAttestedBy:
              null,

            risk: {},

            capitalBlocker: {
              category:
                "poor_retention",

              resolution:
                "delay_outreach",

              rationale:
                "Retention trigger requires further review.",

              outreachConstraint:
                "Delay outreach until reviewed.",

              economicsRiskKeys: [
                "retention_floor",
              ],
            },
          });

        expect(
          blockers
        ).not.toContain(
          "capital_blocker_economics_risk_not_found:retention_floor"
        );
      }
    );

    test(
      "service reports an unknown linked economics risk key",
      async () => {
        const dependencyId =
          new mongoose.Types.ObjectId();

        const economicsDependency = {
          _id: dependencyId,

          packageKey:
            "CAPITAL-009",

          status: "draft",

          domain:
            "external_reporting",

          expiresAt:
            new Date(
              NOW.getTime() +
                86400000
            ),

          dueAt:
            new Date(
              NOW.getTime() +
                86400000
            ),

          evidence: [],

          responses: [],

          findingIds: [],

          dependencies: [],

          audience: "internal",

          unitEconomics: {
            assumptions: [],
            milestones: [],
            allocationGates: [],

            riskTriggers: [
              {
                key:
                  "known_trigger",
                title:
                  "Known trigger",
                response:
                  "Human review required",
              },
            ],
          },
        };

        jest
          .spyOn(Finding, "find")
          .mockReturnValue({
            limit: () => ({
              lean:
                async () => [],
            }),
          });

        jest
          .spyOn(Record, "find")
          .mockResolvedValueOnce([
            economicsDependency,
          ])
          .mockResolvedValue([]);

        const future =
          new Date(
            NOW.getTime() +
              86400000
          );

        const blockers =
          await service.blockersFor({
            _id:
              new mongoose.Types.ObjectId(),

            packageKey:
              "CAPITAL-010",

            domain:
              "external_reporting",

            expiresAt:
              future,

            dueAt:
              future,

            evidence: [],

            responses: [],

            findingIds: [],

            dependencies: [
              dependencyId,
            ],

            audience:
              "internal",

            owner: null,

            ownerAttestedBy:
              null,

            risk: {},

            capitalBlocker: {
              category:
                "poor_retention",

              resolution:
                "delay_outreach",

              rationale:
                "Unknown economics risk reference test.",

              outreachConstraint:
                "Keep outreach on hold.",

              economicsRiskKeys: [
                "unknown_trigger",
              ],
            },
          });

        expect(
          blockers
        ).toContain(
          "capital_blocker_economics_risk_not_found:unknown_trigger"
        );
      }
    );

    test(
      "service publicly exposes the CAPITAL-010 analyzer for deterministic tests",
      () => {
        expect(
          typeof service
            .analyzeCapitalBlocker
        ).toBe("function");
      }
    );
  }
);