const mongoose = require("mongoose");
const Record = require("../models/ExternalReadinessRecord");
const Share = require("../models/ExternalReadinessShare");
const Question = require("../models/ExternalReadinessQuestion");
const Finding = require("../models/AuditFinding");
const ControlTest = require("../models/AuditControlTest");
const User = require("../models/User");
const catalog = require("../config/externalReadinessCatalog");
const { analyzeUnitEconomics } = require("./unitEconomicsAnalysis");
const { analyzeCapitalBlocker } = require("./capitalBlockerAnalysis");
const { analyzeCapitalPath } = require("./capitalPathAnalysis");

const FINANCIAL_KEYS = [
  "gmv",
  "platform_revenue",
  "creator_earnings",
  "payout_exposure",
  "refunds",
  "disputes",
  "subscription_revenue",
  "partner_revenue",
  "payment_fees",
  "infrastructure_cost",
  "storage_media_cost",
  "support_cost",
  "moderation_cost",
  "akuso_model_cost",
  "vendor_cost",
  "hiring_cost",
  "cash_balance",
  "milestone_burn",
];

const COST_KEYS = [
  "payment_fees",
  "infrastructure_cost",
  "storage_media_cost",
  "support_cost",
  "moderation_cost",
  "akuso_model_cost",
  "vendor_cost",
  "hiring_cost",
];

const EDIT_FIELDS = [
  "title",
  "owner",
  "domain",
  "scope",
  "exclusions",
  "dueAt",
  "expiresAt",
  "cadence",
  "escalationOwner",
  "withdrawalRule",
  "publicSummary",
  "audience",
  "classification",
  "evidence",
  "responses",
  "dependencies",
  "findingIds",
  "relatedControlKeys",
  "decision",
  "alternatives",
  "reversalCondition",
  "risk",
  "appetite",
  "candidate",
  "financial",
  "allocation",
  "capitalBlocker",
  "capitalPathDecision",
  "unitEconomics",
];

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};

const id = (value) =>
  String(value?._id || value || "");

const validId = (value) => {
  if (!mongoose.isValidObjectId(value)) {
    fail("Invalid record identifier");
  }

  return value;
};

const requireText = (
  value,
  name,
  max = 1000
) => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max
  ) {
    fail(
      `${name} is required and must be at most ${max} characters`
    );
  }

  return value.trim();
};

const future = (value, name) => {
  const date = new Date(value);

  if (
    !Number.isFinite(date.getTime()) ||
    date <= new Date()
  ) {
    fail(`${name} must be in the future`);
  }

  return date;
};

const specFor = (row) =>
  catalog.find(
    (packageSpec) =>
      packageSpec.key === row.packageKey
  );

const plain = (row) =>
  row?.toObject
    ? row.toObject()
    : row;

const economicsOwnerIds = (row) => [
  ...new Set(
    [
      "assumptions",
      "milestones",
      "riskTriggers",
      "allocationGates",
    ]
      .flatMap((key) =>
        (row.unitEconomics?.[key] || [])
          .map((entry) => entry.owner)
          .filter(Boolean)
      )
      .map(id)
  ),
];

const pushHistory = (
  row,
  action,
  actor,
  reason
) => {
  row.history.push({
    action,
    actor,
    at: new Date(),
    reason,
  });

  row.lastChangedBy = actor;
};

const assertFields = (body, allowed) => {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    fail("Expected an object");
  }

  const extra = Object.keys(body).filter(
    (key) => !allowed.includes(key)
  );

  if (extra.length) {
    fail(
      `Unsupported fields: ${extra.join(", ")}`
    );
  }
};

function financialSummary(
  financial = {}
) {
  const inputs =
    financial.inputs || [];

  const values = Object.fromEntries(
    inputs.map((entry) => [
      entry.key,
      entry.value,
    ])
  );

  const missing =
    FINANCIAL_KEYS.filter(
      (key) =>
        !Object.hasOwn(values, key)
    );

  const complete =
    !missing.length;

  const costs =
    COST_KEYS.every((key) =>
      Object.hasOwn(values, key)
    )
      ? COST_KEYS.reduce(
          (total, key) =>
            total + values[key],
          0
        )
      : null;

  // Platform revenue includes subscriptions and
  // partner revenue; do not add them again.
  const netBurn =
    costs !== null &&
    Object.hasOwn(
      values,
      "platform_revenue"
    )
      ? costs -
        values.platform_revenue
      : null;

  const runway =
    netBurn > 0 &&
    Object.hasOwn(
      values,
      "cash_balance"
    )
      ? values.cash_balance /
        netBurn
      : null;

  return {
    scenario:
      financial.scenario || null,

    currency:
      financial.currency || null,

    missing,
    complete,

    monthlyCosts: costs,

    netMonthlyBurn: netBurn,

    runwayMonths: runway,

    runwayState:
      netBurn === null
        ? "incomplete"
        : netBurn <= 0
          ? "no_positive_burn"
          : runway === null
            ? "cash_needed"
            : "modeled",

    confidence:
      inputs.some(
        (entry) =>
          entry.confidence ===
          "disputed"
      )
        ? "disputed"
        : !complete
          ? "incomplete"
          : inputs.every(
                (entry) =>
                  entry.confidence ===
                  "actual"
              )
            ? "actual"
            : "estimated",

    periodsConsistent:
      new Set(
        inputs.map(
          (entry) => entry.period
        )
      ).size === 1,

    externallyApproved: false,
  };
}

function localBlockers(
  row,
  now = new Date()
) {
  const spec = specFor(row);
  const blockers = [];

  if (row.packageKey === "CAPITAL-011") {
    blockers.push(...analyzeCapitalPath(row, now).blockers);
  }

  if (!spec) {
    return ["unknown_package"];
  }

  if (
    spec.kind ===
    "unit_economics"
  ) {
    blockers.push(
      ...analyzeUnitEconomics(
        row,
        now
      ).blockers
    );
  }

  if (
    row.packageKey ===
    "CAPITAL-010"
  ) {
    blockers.push(
      ...analyzeCapitalBlocker(
        row,
        now
      ).blockers
    );
  }

  if (
    !row.expiresAt ||
    !Number.isFinite(
      new Date(
        row.expiresAt
      ).getTime()
    ) ||
    new Date(row.expiresAt) <= now
  ) {
    blockers.push(
      "record_expired"
    );
  }

  if (
    row.dueAt &&
    new Date(row.dueAt) <= now
  ) {
    blockers.push(
      "review_overdue"
    );
  }

  if (!row.evidence?.length) {
    blockers.push(
      "evidence_missing"
    );
  }

  if (
    row.evidence?.some(
      (entry) =>
        new Date(
          entry.expiresAt
        ) <= now ||
        new Date(
          entry.observedAt
        ) > now ||
        [
          "disputed",
          "incomplete",
        ].includes(
          entry.confidence
        )
    )
  ) {
    blockers.push(
      "evidence_not_current"
    );
  }

  const covered = new Set(
    (row.responses || [])
      .filter(
        (response) =>
          response.response?.trim() &&
          response
            .evidenceIndexes
            ?.length
      )
      .map(
        (response) =>
          response.index
      )
  );

  if (
    spec.requirements.some(
      (
        requirement,
        index
      ) =>
        !requirement.endsWith(
          ":"
        ) &&
        !covered.has(index)
    )
  ) {
    blockers.push(
      "requirements_incomplete"
    );
  }

  if (
    !row.ownerAttestedAt ||
    id(
      row.ownerAttestedBy
    ) !== id(row.owner)
  ) {
    blockers.push(
      "owner_signoff_missing"
    );
  }

  if (
    row.audience !== "internal" &&
    (
      row.classification !==
        "sanitized" ||
      !row.publicSummary?.trim() ||
      !row.withdrawalRule?.trim() ||
      !row.exclusions?.trim()
    )
  ) {
    blockers.push(
      "sharing_scope_incomplete"
    );
  }

  if (
    row.audience !== "internal" &&
    row.evidence?.some(
      (entry) =>
        entry.confidence !==
        "current"
    )
  ) {
    blockers.push(
      "external_evidence_not_current"
    );
  }

  if (
    [
      "decision",
      "allocation",
      "commitment",
    ].includes(spec.kind) &&
    (
      !row.decision?.trim() ||
      !row
        .reversalCondition
        ?.trim()
    )
  ) {
    blockers.push(
      "decision_and_reversal_required"
    );
  }

  if (
    spec.kind === "decision" &&
    !row.alternatives?.trim()
  ) {
    blockers.push(
      "alternatives_missing"
    );
  }

  if (
    [
      "calendar",
      "monitor",
    ].includes(spec.kind) &&
    !row
      .escalationOwner
      ?.trim()
  ) {
    blockers.push(
      "escalation_owner_missing"
    );
  }

  if (
    spec.kind === "retest" &&
    !row.findingIds?.length
  ) {
    blockers.push(
      "retest_findings_missing"
    );
  }

  if (
    spec.kind ===
      "attestation" &&
    !row
      .relatedControlKeys
      ?.length
  ) {
    blockers.push(
      "controls_missing"
    );
  }

  if (
    spec.kind === "financial"
  ) {
    const summary =
      financialSummary(
        row.financial
      );

    if (
      !summary.complete ||
      !summary.periodsConsistent ||
      !summary.currency ||
      !summary.scenario ||
      summary.confidence ===
        "disputed"
    ) {
      blockers.push(
        "financial_inputs_incomplete_or_disputed"
      );
    }

    if (
      row.audience !==
        "internal" &&
      row.financial?.inputs?.some(
        (entry) =>
          [
            "disputed",
            "not_approved_external",
          ].includes(
            entry.confidence
          )
      )
    ) {
      blockers.push(
        "financial_inputs_not_shareable"
      );
    }
  }

  if (
    spec.kind === "allocation" &&
    (
      !Number.isFinite(
        row.allocation?.minimum
      ) ||
      !Number.isFinite(
        row.allocation?.maximum
      ) ||
      !row.allocation
        .currency ||
      !row.allocation
        .milestone ||
      !row.allocation
        .successMetric ||
      !row.allocation
        .riskMetric ||
      !row.allocation
        .stopLoss
    )
  ) {
    blockers.push(
      "allocation_gates_missing"
    );
  }

  if (
    spec.kind === "candidate" &&
    (
      !row.candidate?.path ||
      ![
        row.candidate
          .businessValue,
        row.candidate.demand,
        row.candidate
          .evidenceReadiness,
        row.candidate.risk,
        row.candidate.cost,
      ].every(Number.isFinite) ||
      !row.candidate
        .timeline ||
      !row.candidate
        .renewalBurden ||
      !row.candidate
        .overclaimRisk
    )
  ) {
    blockers.push(
      "candidate_scoring_missing"
    );
  }

  if (
    spec.kind === "appetite"
  ) {
    if (
      ![
        row.appetite?.warning,
        row.appetite?.blocker,
        row.appetite?.current,
      ].every(Number.isFinite) ||
      !row.appetite?.unit ||
      !row.appetite
        ?.incidentTrigger
    ) {
      blockers.push(
        "risk_thresholds_missing"
      );
    } else if (
      row.appetite.current >=
      row.appetite.blocker
    ) {
      blockers.push(
        "risk_appetite_exceeded"
      );
    }
  }

  if (
    row.risk?.acceptedUntil
  ) {
    if (
      row.risk.severity ===
      "critical"
    ) {
      blockers.push(
        "critical_risk_cannot_be_accepted"
      );
    }

    if (
      new Date(
        row.risk.acceptedUntil
      ) <= now
    ) {
      blockers.push(
        "accepted_risk_expired"
      );
    }

    if (
      !row.risk.mitigation ||
      !row.risk
        .compensatingControl ||
      !row.risk.reviewTrigger
    ) {
      blockers.push(
        "risk_acceptance_incomplete"
      );
    }
  }

  /*
   * CAPITAL-010 has its own
   * decision-specific risk controls.
   * Do not force generic mitigation
   * onto close/narrow/delay/change-path
   * decisions.
   */
  if (
    [
      "risk",
      "commitment",
    ].includes(spec.kind) &&
    row.packageKey !==
      "CAPITAL-010" &&
    !row.risk?.mitigation
  ) {
    blockers.push(
      "risk_mitigation_missing"
    );
  }

  return [
    ...new Set(blockers),
  ];
}

function findingBlocks(
  finding,
  now = new Date()
) {
  if (
    finding.status === "closed"
  ) {
    return !(
      finding.retestState ===
        "passed" &&
      finding.retestedBy &&
      finding.retestAt &&
      new Date(
        finding.retestAt
      ) <= now &&
      finding
        .closureEvidenceRefs
        ?.length
    );
  }

  if (
    finding.severity ===
    "critical"
  ) {
    return true;
  }

  if (
    finding.status ===
    "risk_accepted"
  ) {
    return !(
      finding.acceptedRisk
        ?.accepted &&
      finding.acceptedRisk
        .approvedBy &&
      finding.acceptedRisk
        .expiresAt > now &&
      finding
        .compensatingControl &&
      finding.acceptedRisk
        .reviewTrigger
    );
  }

  return (
    [
      "high",
      "critical",
    ].includes(
      finding.severity
    ) ||
    new Date(finding.dueAt) <=
      now
  );
}

async function blockersFor(
  row,
  {
    visited = new Set(),
    depth = 0,
    retest = false,
    budget = {
      remaining: 200,
    },
  } = {}
) {
  const blockers =
    localBlockers(row);

  if (--budget.remaining < 0) {
    return [
      ...blockers,
      "dependency_scan_incomplete",
    ];
  }

  if (
    depth > 10 ||
    visited.has(id(row))
  ) {
    return [
      ...blockers,
      "dependency_cycle_or_depth_limit",
    ];
  }

  const seen =
    new Set(visited).add(
      id(row)
    );

  const findingQuery = {
    $or: [
      {
        _id: {
          $in:
            row.findingIds ||
            [],
        },
      },
      {
        domainKey: row.domain,
      },
    ],
  };

  const findings =
    await Finding.find(
      findingQuery
    )
      .limit(501)
      .lean();

  if (findings.length > 500) {
    blockers.push(
      "finding_scan_incomplete"
    );
  }

  if (
    (
      row.findingIds || []
    ).some(
      (referenceId) =>
        !findings.some(
          (finding) =>
            id(finding) ===
            id(referenceId)
        )
    )
  ) {
    blockers.push(
      "finding_not_found"
    );
  }

  if (
    !retest &&
    findings.some((finding) =>
      findingBlocks(finding)
    )
  ) {
    blockers.push(
      "unresolved_audit_findings"
    );
  }

  if (
    !retest &&
    specFor(row)?.kind ===
      "retest" &&
    findings
      .filter((finding) =>
        (
          row.findingIds || []
        ).some(
          (reference) =>
            id(reference) ===
            id(finding)
        )
      )
      .some(
        (finding) =>
          finding.retestState !==
            "passed" ||
          !finding.retestedBy ||
          !finding.retestAt ||
          new Date(
            finding.retestAt
          ) > new Date() ||
          !finding
            .closureEvidenceRefs
            ?.length
      )
  ) {
    blockers.push(
      "retest_not_verified"
    );
  }

  const dependencies =
    await Record.find({
      _id: {
        $in:
          row.dependencies || [],
      },
    });

  if (
    dependencies.length !==
    new Set(
      (
        row.dependencies || []
      ).map(id)
    ).size
  ) {
    blockers.push(
      "dependency_not_found"
    );
  }

  /*
   * CAPITAL-010 may explicitly
   * reference risk-trigger keys
   * produced by CAPITAL-009.
   *
   * These references must resolve
   * against a linked CAPITAL-009
   * dependency. This reuses the
   * canonical economics analyzer;
   * it does not duplicate economics
   * calculations.
   */
  if (
    row.packageKey ===
      "CAPITAL-010" &&
    row.capitalBlocker
      ?.economicsRiskKeys
      ?.length
  ) {
    const economicsDependencies =
      dependencies.filter(
        (dependency) =>
          dependency.packageKey ===
          "CAPITAL-009"
      );

    if (
      !economicsDependencies.length
    ) {
      blockers.push(
        "capital_blocker_economics_dependency_missing"
      );
    } else {
      const knownRiskKeys =
        new Set(
          economicsDependencies.flatMap(
            (dependency) =>
              analyzeUnitEconomics(
                dependency
              ).riskTriggers.map(
                (risk) =>
                  risk.key
              )
          )
        );

      for (
        const riskKey of
        row.capitalBlocker
          .economicsRiskKeys
      ) {
        if (
          !knownRiskKeys.has(
            riskKey
          )
        ) {
          blockers.push(
            `capital_blocker_economics_risk_not_found:${riskKey}`
          );
        }
      }
    }
  }

  for (
    const dependency of
    dependencies
  ) {
    if (
      dependency.status !==
        "approved" ||
      (
        await blockersFor(
          dependency,
          {
            visited: seen,
            depth:
              depth + 1,
            budget,
          }
        )
      ).length
    ) {
      blockers.push(
        `dependency_blocked:${id(
          dependency
        )}`
      );
    }
  }

  if (
    specFor(row)?.kind ===
    "attestation"
  ) {
    const tests =
      await ControlTest.find({
        controlKey: {
          $in:
            row.relatedControlKeys,
        },
        domainKey: row.domain,
      })
        .sort({
          testedAt: -1,
        })
        .limit(501)
        .lean();

    if (tests.length > 500) {
      blockers.push(
        "control_scan_incomplete"
      );
    }

    for (
      const key of
      row.relatedControlKeys
    ) {
      const test = tests.find(
        (entry) =>
          entry.controlKey === key
      );

      if (
        !test ||
        ![
          "pass",
          "pass_with_observation",
        ].includes(test.result) ||
        test.evidenceState !==
          "current" ||
        !test.testedAt ||
        new Date(
          test.testedAt
        ) > new Date() ||
        !test.reviewerId ||
        test.retestRequired ||
        new Date(
          test.testedAt
        ) <
          new Date(
            Date.now() -
              90 * 86400000
          ) ||
        !test
          .actualEvidenceRefs
          ?.length
      ) {
        blockers.push(
          `control_not_verified:${key}`
        );
      }
    }
  }

  return [
    ...new Set(blockers),
  ];
}

async function getRecord(
  recordId
) {
  const row =
    await Record.findById(
      validId(recordId)
    );

  if (!row) {
    fail(
      "Record not found",
      404
    );
  }

  return row;
}

async function saveDraft({
  recordId,
  body,
  actor,
}) {
  assertFields(body, [
    ...EDIT_FIELDS,
    "packageKey",
    "reason",
    "version",
  ]);

  const reason =
    requireText(
      body.reason,
      "Reason"
    );

  const row = recordId
    ? await getRecord(recordId)
    : new Record({
        packageKey:
          body.packageKey,
        createdBy: actor,
        lastChangedBy: actor,
      });

  if (
    recordId &&
    body.version !== row.__v
  ) {
    fail(
      "This record changed. Reload before editing.",
      409
    );
  }

  if (
    recordId &&
    body.packageKey &&
    body.packageKey !==
      row.packageKey
  ) {
    fail(
      "Package cannot be changed"
    );
  }

  for (
    const field of
    EDIT_FIELDS
  ) {
    if (
      Object.hasOwn(
        body,
        field
      )
    ) {
      row.set(
        field,
        body[field]
      );
    }
  }

  if (
    !await User.exists({
      _id: validId(row.owner),
      role: {
        $in: [
          "admin",
          "super_admin",
        ],
      },
    })
  ) {
    fail(
      "Owner must be an existing administrator"
    );
  }

  if (row.unitEconomics) {
    const owners =
      economicsOwnerIds(row);

    if (
      owners.length &&
      await User.countDocuments({
        _id: {
          $in: owners,
        },
        role: {
          $in: [
            "admin",
            "super_admin",
          ],
        },
      }) !== owners.length
    ) {
      fail(
        "Every economics owner must be an existing administrator"
      );
    }
  }

  future(
    row.expiresAt,
    "Expiration"
  );

  row.status = "draft";

  row.reviewedAt =
    undefined;

  row.reviewedBy =
    undefined;

  row.ownerAttestedAt =
    undefined;

  row.ownerAttestedBy =
    undefined;

  row.reviewerNotes = "";
  row.outcome =
    "not_observed";

  pushHistory(
    row,
    recordId
      ? "revise"
      : "create",
    actor,
    reason
  );

  await row.save();

  return plain(row);
}

async function transition({
  recordId,
  body,
  actor,
}) {
  assertFields(body, [
    "action",
    "reason",
    "version",
    "notes",
    "outcome",
  ]);

  const reason =
    requireText(
      body.reason,
      "Reason"
    );

  const row =
    await getRecord(
      recordId
    );

  if (
    body.version !== row.__v
  ) {
    fail(
      "This record changed. Reload before acting.",
      409
    );
  }

  const action =
    body.action;

  if (
    action === "attest"
  ) {
    if (
      id(row.owner) !==
        id(actor) ||
      ![
        "draft",
        "needs_changes",
      ].includes(row.status)
    ) {
      fail(
        "Only the owner may attest a draft",
        403
      );
    }

    row.ownerAttestedAt =
      new Date();

    row.ownerAttestedBy =
      actor;
  } else if (
    action === "submit"
  ) {
    if (
      ![
        "draft",
        "needs_changes",
      ].includes(row.status)
    ) {
      fail(
        "Only drafts may enter review",
        409
      );
    }

    const blockers =
      await blockersFor(
        row,
        {
          retest:
            specFor(row).kind ===
            "retest",
        }
      );

    if (blockers.length) {
      fail(
        `Cannot submit: ${blockers.join(
          ", "
        )}`
      );
    }

    row.status =
      "in_review";
  } else if (
    [
      "approve",
      "request_changes",
    ].includes(action)
  ) {
    if (
      row.status !==
      "in_review"
    ) {
      fail(
        "Record is not awaiting review",
        409
      );
    }

    const forbiddenReviewers = [
      id(row.owner),
      id(row.createdBy),
      ...economicsOwnerIds(
        row
      ),
      ...(row.history || [])
        .filter((entry) =>
          [
            "create",
            "revise",
          ].includes(
            entry.action
          )
        )
        .map((entry) =>
          id(entry.actor)
        ),
    ];

    if (
      forbiddenReviewers.includes(
        id(actor)
      )
    ) {
      fail(
        "An independent administrator must review this record",
        403
      );
    }

    row.reviewerNotes =
      requireText(
        body.notes,
        "Reviewer notes",
        4000
      );

    if (
      action === "approve"
    ) {
      const blockers =
        await blockersFor(row);

      if (
        blockers.length
      ) {
        fail(
          `Approval blocked: ${blockers.join(
            ", "
          )}`
        );
      }

      if (
        [
          "review",
          "retest",
        ].includes(
          specFor(row).kind
        ) &&
        body.outcome !==
          "pass"
      ) {
        fail(
          "Approval requires an observed passing review"
        );
      }

      row.outcome =
        [
          "review",
          "retest",
        ].includes(
          specFor(row).kind
        )
          ? "pass"
          : "not_observed";

      row.status =
        "approved";
    } else {
      row.status =
        "needs_changes";

      row.outcome =
        [
          "fail",
          "not_testable",
        ].includes(
          body.outcome
        )
          ? body.outcome
          : "not_observed";
    }

    row.reviewedAt =
      new Date();

    row.reviewedBy =
      actor;
  } else if (
    action === "withdraw"
  ) {
    row.status =
      "withdrawn";
  } else {
    fail(
      "Unsupported transition"
    );
  }

  pushHistory(
    row,
    action,
    actor,
    reason
  );

  await row.save();

  return plain(row);
}

async function report() {
  const [
    rows,
    count,
    questions,
    shares,
    findings,
    findingsCount,
    questionsCount,
    sharesCount,
  ] = await Promise.all([
    Record.find()
      .sort({
        updatedAt: -1,
      })
      .limit(250)
      .lean(),

    Record.countDocuments(),

    Question.find()
      .sort({
        dueAt: 1,
      })
      .limit(250)
      .lean(),

    Share.find()
      .sort({
        createdAt: -1,
      })
      .limit(250)
      .lean(),

    Finding.find()
      .sort({
        dueAt: 1,
      })
      .limit(500)
      .lean(),

    Finding.countDocuments(),

    Question.countDocuments(),

    Share.countDocuments(),
  ]);

  const records = [];

  for (
    const row of rows
  ) {
    const blockers =
      await blockersFor(row);

    const candidate =
      row.candidate || {};

    records.push({
      ...row,

      id: id(row),

      kind:
        specFor(row).kind,

      blockers,

      readiness:
        row.status ===
          "approved" &&
        !blockers.length
          ? "ready"
          : row.status ===
              "withdrawn"
            ? "withdrawn"
            : "evidence_needed",

      unitEconomicsAnalysis:
        row.packageKey ===
        "CAPITAL-009"
          ? analyzeUnitEconomics(
              row
            )
          : undefined,

      capitalPathAnalysis:
        row.packageKey === "CAPITAL-011" ? analyzeCapitalPath(row) : undefined,

      capitalBlockerAnalysis:
        row.packageKey ===
        "CAPITAL-010"
          ? analyzeCapitalBlocker(
              row
            )
          : undefined,

      financialSummary:
        specFor(row).kind ===
        "financial"
          ? financialSummary(
              row.financial
            )
          : undefined,

      candidateScore:
        [
          candidate.businessValue,
          candidate.demand,
          candidate.evidenceReadiness,
          candidate.risk,
        ].every(
          Number.isFinite
        )
          ? candidate.businessValue +
            candidate.demand +
            candidate.evidenceReadiness -
            candidate.risk
          : null,
    });
  }

  const packages =
    catalog.map(
      (spec) => ({
        ...spec,

        implementationStatus:
          "implemented",

        operationalStatus:
          records.some(
            (row) =>
              row.packageKey ===
                spec.key &&
              row.readiness ===
                "ready"
          )
            ? "reviewed_records_available"
            : "evidence_needed",

        recordCount:
          records.filter(
            (row) =>
              row.packageKey ===
              spec.key
          ).length,
      })
    );

  const now =
    new Date();

  const alerts =
    records.flatMap(
      (row) => [
        ...(row.dueAt < now
          ? [
              {
                recordId:
                  row.id,
                type:
                  "review_overdue",
                owner:
                  row.owner,
                escalationOwner:
                  row.escalationOwner,
              },
            ]
          : []),

        ...row.blockers
          .filter((blocker) =>
            /expired|not_current|exceeded/.test(
              blocker
            )
          )
          .map((type) => ({
            recordId:
              row.id,
            type,
            owner: row.owner,
            escalationOwner:
              row.escalationOwner,
          })),
      ]
    );

  return {
    generatedAt: now,

    domains:
      require(
        "../models/AuditDomain"
      ).AUDIT_DOMAINS,

    financialKeys:
      FINANCIAL_KEYS,

    unitEconomicsConfig:
      require(
        "../config/unitEconomics"
      ),

    capitalPathConfig: require("../config/capitalPaths"),

    capitalBlockerConfig:
      require(
        "../config/capitalBlockers"
      ),

    packages,
    records,
    questions,
    shares,
    alerts,

    calendar:
      records
        .filter((row) =>
          [
            "calendar",
            "monitor",
            "attestation",
          ].includes(
            row.kind
          )
        )
        .map((row) => ({
          id: row.id,
          title: row.title,
          dueAt: row.dueAt,
          cadence:
            row.cadence,
          owner: row.owner,
          escalationOwner:
            row.escalationOwner,
        })),

    audit: {
      findings:
        findings.map(
          (finding) => ({
            id: id(finding),

            domain:
              finding.domainKey,

            severity:
              finding.severity,

            status:
              finding.status,

            dueAt:
              finding.dueAt,

            retestState:
              finding.retestState,

            blocksReadiness:
              findingBlocks(
                finding
              ),
          })
        ),

      count:
        findingsCount,
    },

    summary: {
      packageCount:
        catalog.length,

      records: count,

      readyRecords:
        records.filter(
          (row) =>
            row.readiness ===
            "ready"
        ).length,

      observedReviews:
        records.filter(
          (row) =>
            [
              "pass",
              "fail",
              "not_testable",
            ].includes(
              row.outcome
            )
        ).length,

      alerts:
        alerts.length,

      decision:
        count > 250 ||
        findingsCount > 500 ||
        questionsCount > 250 ||
        sharesCount > 250 ||
        records.some(
          (row) =>
            row.readiness !==
            "ready"
        ) ||
        packages.some(
          (packageSpec) =>
            packageSpec
              .operationalStatus ===
            "evidence_needed"
        )
          ? "hold_for_evidence"
          : "human_strategy_review_required",
    },

    limits: {
      records: 250,
      findings: 500,
      questions: 250,
      shares: 250,

      truncated:
        count > 250 ||
        findingsCount > 500 ||
        questionsCount > 250 ||
        sharesCount > 250,

      scope:
        "All-time readiness inventory; analytics date filters do not apply",

      certificationAwarded:
        false,

      outreachSent: false,

      moneyMovementAuthorized:
        false,
    },

    akuso: {
      may: [
        "draft scoped summaries",
        "explain evidence gaps",
        "draft diligence questions",
      ],

      prohibited: [
        "approve claims",
        "accept risk",
        "close findings",
        "grant access",
        "publish packets",
        "make financial or legal decisions",
        "claim certification",
      ],
    },
  };
}

async function createShare({
  recordId,
  body,
  actor,
}) {
  assertFields(body, [
    "recipient",
    "expiresAt",
    "reason",
    "version",
  ]);

  const row =
    await getRecord(
      recordId
    );

  if (
    body.version !== row.__v
  ) {
    fail(
      "This record changed. Reload before sharing.",
      409
    );
  }

  if (
    row.status !==
      "approved" ||
    row.audience ===
      "internal" ||
    row.classification !==
      "sanitized" ||
    (
      await blockersFor(row)
    ).length
  ) {
    fail(
      "Only current approved sanitized packets can be shared",
      409
    );
  }

  const expiresAt =
    future(
      body.expiresAt,
      "Share expiration"
    );

  if (
    expiresAt >
      row.expiresAt ||
    row.evidence.some(
      (entry) =>
        expiresAt >
        entry.expiresAt
    )
  ) {
    fail(
      "Share cannot outlive its evidence or packet"
    );
  }

  if (
    !await User.exists({
      _id: validId(
        body.recipient
      ),
    })
  ) {
    fail(
      "Recipient not found",
      404
    );
  }

  return Share.create({
    record: row._id,

    recordVersion:
      row.__v,

    recipient:
      body.recipient,

    audience:
      row.audience,

    approvedBy:
      actor,

    approvedAt:
      new Date(),

    expiresAt,

    reason:
      requireText(
        body.reason,
        "Reason"
      ),
  });
}

async function revokeShare(
  shareId
) {
  const share =
    await Share.findById(
      validId(shareId)
    );

  if (!share) {
    fail(
      "Share not found",
      404
    );
  }

  share.revokedAt =
    new Date();

  await share.save();

  return plain(share);
}

async function readShare(
  shareId,
  actor
) {
  const share =
    await Share.findOne({
      _id: validId(shareId),
      recipient: actor,
    });

  if (!share) {
    fail(
      "Share not found",
      404
    );
  }

  if (
    share.revokedAt ||
    share.expiresAt <=
      new Date()
  ) {
    fail(
      "This share has expired or been withdrawn",
      410
    );
  }

  const row =
    await getRecord(
      share.record
    );

  if (
    row.__v !==
      share.recordVersion ||
    row.status !==
      "approved" ||
    row.classification !==
      "sanitized" ||
    (
      await blockersFor(row)
    ).length
  ) {
    fail(
      "This packet changed or no longer has current approval",
      410
    );
  }

  return {
    share,
    row,

    packet: {
      id: id(share),

      title:
        row.title,

      summary:
        row.publicSummary,

      scope:
        row.scope,

      exclusions:
        row.exclusions,

      audience:
        share.audience,

      version:
        share.recordVersion,

      watermark:
        `Tengacion | ${id(
          share
        )} | v${
          share.recordVersion
        } | ${id(actor)}`,

      expiresAt:
        share.expiresAt,

      withdrawalRule:
        row.withdrawalRule,
    },
  };
}

async function askQuestion({
  shareId,
  actor,
  body,
}) {
  assertFields(body, [
    "question",
  ]);

  const {
    share,
    row,
  } = await readShare(
    shareId,
    actor
  );

  return Question.create({
    share: share._id,

    askedBy: actor,

    question:
      requireText(
        body.question,
        "Question",
        4000
      ),

    owner: row.owner,

    dueAt:
      new Date(
        Date.now() +
          7 * 86400000
      ),
  });
}

async function answerQuestion({
  questionId,
  actor,
  body,
}) {
  assertFields(body, [
    "action",
    "response",
    "owner",
    "dueAt",
    "version",
    "reason",
  ]);

  requireText(
    body.reason,
    "Reason"
  );

  const row =
    await Question.findById(
      validId(questionId)
    );

  if (!row) {
    fail(
      "Question not found",
      404
    );
  }

  if (
    body.version !== row.__v
  ) {
    fail(
      "Question changed. Reload before acting.",
      409
    );
  }

  if (
    body.action === "draft"
  ) {
    row.response =
      requireText(
        body.response,
        "Response",
        6000
      );

    row.draftedBy =
      actor;

    row.status = "draft";

    row.reviewedBy =
      undefined;

    row.reviewedAt =
      undefined;

    if (body.owner) {
      if (
        !await User.exists({
          _id: validId(
            body.owner
          ),
          role: {
            $in: [
              "admin",
              "super_admin",
            ],
          },
        })
      ) {
        fail(
          "Owner must be an administrator"
        );
      }

      row.owner =
        body.owner;
    }

    if (body.dueAt) {
      row.dueAt =
        future(
          body.dueAt,
          "Due date"
        );
    }
  } else if (
    body.action ===
    "approve"
  ) {
    if (
      row.status !==
        "draft" ||
      [
        id(row.draftedBy),
        id(row.owner),
      ].includes(id(actor))
    ) {
      fail(
        "An independent administrator must approve a draft response",
        403
      );
    }

    await readShare(
      row.share,
      row.askedBy
    );

    row.status =
      "approved";

    row.reviewedBy =
      actor;

    row.reviewedAt =
      new Date();
  } else if (
    body.action === "close" &&
    row.status ===
      "approved"
  ) {
    row.status = "closed";
  } else {
    fail(
      "Invalid question transition"
    );
  }

  await row.save();

  return plain(row);
}

module.exports = {
  analyzeCapitalPath,
  analyzeUnitEconomics,
  analyzeCapitalBlocker,
  FINANCIAL_KEYS,
  catalog,
  financialSummary,
  localBlockers,
  findingBlocks,
  blockersFor,
  getRecord,
  saveDraft,
  transition,
  report,
  createShare,
  revokeShare,
  readShare,
  askQuestion,
  answerQuestion,
  requireText,
};