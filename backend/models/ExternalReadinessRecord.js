const mongoose = require("mongoose");
const catalog = require("../config/externalReadinessCatalog");

const text = (max = 2000) => ({
  type: String,
  trim: true,
  maxlength: max,
  default: "",
});

const ref = (model, required = false) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: model,
  required,
});

const evidence = new mongoose.Schema(
  {
    source: { ...text(1000), required: true },
    summary: { ...text(), required: true },
    observedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    confidence: {
      type: String,
      enum: ["current", "estimated", "disputed", "incomplete"],
      required: true,
    },
  },
  { _id: false }
);

const requirement = new mongoose.Schema(
  {
    index: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    response: { ...text(4000), required: true },
    evidenceIndexes: [
      {
        type: Number,
        min: 0,
        validate: Number.isInteger,
      },
    ],
  },
  { _id: false }
);

const input = new mongoose.Schema(
  {
    key: { ...text(120), required: true },
    value: {
      type: Number,
      required: true,
      validate: Number.isFinite,
    },
    confidence: {
      type: String,
      enum: [
        "actual",
        "estimated",
        "assumption",
        "disputed",
        "not_approved_external",
      ],
      required: true,
    },
    source: { ...text(1000), required: true },
    period: { ...text(120), required: true },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    packageKey: {
      type: String,
      enum: catalog.map((p) => p.key),
      required: true,
      immutable: true,
      index: true,
    },

    title: {
      ...text(200),
      required: true,
    },

    owner: ref("User", true),

    domain: {
      ...text(120),
      enum: require("./AuditDomain").AUDIT_DOMAINS,
      required: true,
    },

    scope: {
      ...text(4000),
      required: true,
    },

    exclusions: text(4000),

    dueAt: {
      type: Date,
      required: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    cadence: {
      type: String,
      enum: [
        "once",
        "monthly",
        "quarterly",
        "semiannual",
        "annual",
        "post_incident",
      ],
      default: "once",
    },

    escalationOwner: text(200),
    withdrawalRule: text(),
    publicSummary: text(6000),

    audience: {
      type: String,
      enum: [
        "internal",
        "partner",
        "investor",
        "assessor",
        "advisor",
        "public",
      ],
      default: "internal",
    },

    classification: {
      type: String,
      enum: [
        "restricted",
        "legal_security",
        "sanitized",
      ],
      default: "restricted",
    },

    evidence: {
      type: [evidence],
      validate: (v) => v.length <= 100,
    },

    responses: {
      type: [requirement],
      validate: (v) => v.length <= 150,
    },

    dependencies: {
      type: [ref("ExternalReadinessRecord")],
      validate: (v) => v.length <= 50,
    },

    findingIds: {
      type: [ref("AuditFinding")],
      validate: (v) => v.length <= 50,
    },

    relatedControlKeys: {
      type: [
        {
          ...text(160),
          required: true,
        },
      ],
      validate: (v) => v.length <= 100,
    },

    decision: text(2000),
    alternatives: text(4000),
    reversalCondition: text(),
    reviewerNotes: text(4000),

    outcome: {
      type: String,
      enum: [
        "not_observed",
        "pass",
        "fail",
        "not_testable",
      ],
      default: "not_observed",
    },

    ownerAttestedAt: Date,
    ownerAttestedBy: ref("User"),
    reviewedAt: Date,
    reviewedBy: ref("User"),

    risk: {
      severity: {
        type: String,
        enum: ["low", "medium", "high", "critical"],
        default: "medium",
      },
      likelihood: {
        type: Number,
        min: 1,
        max: 5,
      },
      impact: {
        type: Number,
        min: 1,
        max: 5,
      },
      mitigation: text(),
      compensatingControl: text(),
      reviewTrigger: text(),
      acceptedUntil: Date,
    },

    appetite: {
      unit: text(100),

      warning: {
        type: Number,
        validate: Number.isFinite,
      },

      blocker: {
        type: Number,
        validate: Number.isFinite,
      },

      current: {
        type: Number,
        validate: Number.isFinite,
      },

      incidentTrigger: text(),
    },

    candidate: {
      path: text(200),

      businessValue: {
        type: Number,
        min: 0,
        max: 5,
      },

      demand: {
        type: Number,
        min: 0,
        max: 5,
      },

      evidenceReadiness: {
        type: Number,
        min: 0,
        max: 5,
      },

      risk: {
        type: Number,
        min: 0,
        max: 5,
      },

      cost: {
        type: Number,
        min: 0,
      },

      timeline: text(200),
      renewalBurden: text(),
      overclaimRisk: text(),
    },

    capitalBlocker: {
      type: require("./capitalBlockerSchema"),
      default: undefined,
    },

    capitalPathDecision: {
      type: require("./capitalPathDecisionSchema"),
      default: undefined,
    },

    unitEconomics: {
      type: require("./unitEconomicsSchema"),
      default: undefined,
    },

    financial: {
      scenario: {
        type: String,
        enum: [
          "conservative",
          "base",
          "upside",
          "downside",
        ],
      },

      currency: {
        type: String,
        match: /^[A-Z]{3}$/,
      },

      inputs: {
        type: [input],
        validate: (v) => v.length <= 40,
      },
    },

    allocation: {
      minimum: {
        type: Number,
        min: 0,
      },

      maximum: {
        type: Number,
        min: 0,
      },

      currency: {
        type: String,
        match: /^[A-Z]{3}$/,
      },

      milestone: text(),
      successMetric: text(),
      riskMetric: text(),
      stopLoss: text(),
    },

    status: {
      type: String,
      enum: [
        "draft",
        "in_review",
        "approved",
        "needs_changes",
        "withdrawn",
      ],
      default: "draft",
      index: true,
    },

    createdBy: ref("User", true),
    lastChangedBy: ref("User", true),

    history: [
      {
        action: {
          type: String,
          required: true,
        },

        actor: ref("User", true),

        at: {
          type: Date,
          required: true,
        },

        reason: {
          ...text(1000),
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    strict: "throw",
  }
);

schema.pre("validate", function () {
  const now = Date.now();
  const spec = catalog.find(
    (p) => p.key === this.packageKey
  );

  /*
   * CAPITAL-010
   *
   * CAPITAL blocker structure is allowed only on CAPITAL-010.
   * Drafts may remain incomplete while being prepared.
   * Approval requires the deterministic blocker analysis to pass.
   */
  if (this.capitalBlocker) {
    if (this.packageKey !== "CAPITAL-010") {
      this.invalidate(
        "capitalBlocker",
        "Capital blocker decisions belong to CAPITAL-010"
      );
    }

    const evidenceIndexes =
      this.capitalBlocker.evidenceIndexes || [];

    const advisorIndexes =
      this.capitalBlocker
        .advisorReviewEvidenceIndexes || [];

    if (
      new Set(evidenceIndexes).size !==
        evidenceIndexes.length ||
      evidenceIndexes.some(
        (index) => index >= this.evidence.length
      )
    ) {
      this.invalidate(
        "capitalBlocker.evidenceIndexes",
        "Capital blocker evidence indexes must be unique and in range"
      );
    }

    if (
      new Set(advisorIndexes).size !==
        advisorIndexes.length ||
      advisorIndexes.some(
        (index) => index >= this.evidence.length
      )
    ) {
      this.invalidate(
        "capitalBlocker.advisorReviewEvidenceIndexes",
        "Advisor review evidence indexes must be unique and in range"
      );
    }

    const economicsRiskKeys =
      this.capitalBlocker.economicsRiskKeys || [];

    if (
      new Set(economicsRiskKeys).size !==
      economicsRiskKeys.length
    ) {
      this.invalidate(
        "capitalBlocker.economicsRiskKeys",
        "Economics risk keys must be unique"
      );
    }
  }

  if (
    this.packageKey === "CAPITAL-010" &&
    this.status === "approved"
  ) {
    const {
      analyzeCapitalBlocker,
    } = require("../services/capitalBlockerAnalysis");

    if (
      analyzeCapitalBlocker(this).blockers.length
    ) {
      this.invalidate(
        "capitalBlocker",
        "Incomplete capital blocker decision cannot be approved"
      );
    }

    if (
      !this.isNew &&
      [
        "capitalBlocker",
        "evidence",
        "risk",
        "decision",
        "alternatives",
        "reversalCondition",
        "dependencies",
        "findingIds",
      ].some((field) => this.isModified(field))
    ) {
      this.invalidate(
        "status",
        "Revise changed blocker evidence or decision as a draft before approval"
      );
    }
  }
  /*
   * CAPITAL-011
   *
   * Capital path decisions are permitted only on CAPITAL-011.
   * Drafts may remain incomplete while being prepared.
   * Approval requires the deterministic CAPITAL-011 analyzer
   * to pass.
   */
  if (this.capitalPathDecision) {
    if (this.packageKey !== "CAPITAL-011") {
      this.invalidate(
        "capitalPathDecision",
        "Capital path decisions belong to CAPITAL-011"
      );
    }

    const sections =
      this.capitalPathDecision.packetSections || [];

    const sectionKeys =
      sections
        .map((section) => section?.key)
        .filter(Boolean);

    if (
      new Set(sectionKeys).size !==
      sectionKeys.length
    ) {
      this.invalidate(
        "capitalPathDecision.packetSections",
        "Capital path packet section keys must be unique"
      );
    }

    for (const section of sections) {
      const indexes =
        section.evidenceIndexes || [];

      if (
        new Set(indexes).size !==
          indexes.length ||
        indexes.some(
          (index) =>
            !Number.isInteger(index) ||
            index < 0 ||
            index >= this.evidence.length
        )
      ) {
        this.invalidate(
          "capitalPathDecision.packetSections",
          "Capital path packet evidence indexes must be unique and in range"
        );

        break;
      }
    }

    const requirements =
      this.capitalPathDecision
        .evidenceRequirements || [];

    const normalizedRequirements =
      requirements
        .map((entry) =>
          typeof entry === "string"
            ? entry.trim()
            : ""
        )
        .filter(Boolean);

    if (
      new Set(
        normalizedRequirements
      ).size !==
      normalizedRequirements.length
    ) {
      this.invalidate(
        "capitalPathDecision.evidenceRequirements",
        "Capital path evidence requirements must be unique"
      );
    }
  }

  if (
    this.packageKey === "CAPITAL-011" &&
    this.status === "approved"
  ) {
    const {
      analyzeCapitalPath,
    } = require("../services/capitalPathAnalysis");

    if (
      analyzeCapitalPath(this).blockers.length
    ) {
      this.invalidate(
        "capitalPathDecision",
        "Incomplete capital path decision cannot be approved"
      );
    }

    if (
      !this.isNew &&
      [
        "capitalPathDecision",
        "evidence",
        "decision",
        "alternatives",
        "reversalCondition",
        "dependencies",
        "findingIds",
        "relatedControlKeys",
        "owner",
        "dueAt",
        "expiresAt",
      ].some((field) =>
        this.isModified(field)
      )
    ) {
      this.invalidate(
        "status",
        "Revise changed capital path decision or evidence as a draft before approval"
      );
    }
  }
  /*
   * CAPITAL-009
   */
  if (this.unitEconomics) {
    const economics = this.unitEconomics;
    const config = require("../config/unitEconomics");

    if (
      this.status === "approved" &&
      [
        "assumptions",
        "milestones",
        "riskTriggers",
        "allocationGates",
      ].some((key) =>
        economics[key].some(
          (entry) =>
            entry.owner &&
            String(entry.owner) ===
              String(this.reviewedBy)
        )
      )
    ) {
      this.invalidate(
        "reviewedBy",
        "Economics owners cannot independently review their own inputs or gates"
      );
    }

    if (this.packageKey !== "CAPITAL-009") {
      this.invalidate(
        "unitEconomics",
        "Unit economics belongs to CAPITAL-009"
      );
    }

    for (const field of [
      "assumptions",
      "milestones",
      "riskTriggers",
      "allocationGates",
    ]) {
      const keys = economics[field].map(
        (row) => row.key
      );

      if (new Set(keys).size !== keys.length) {
        this.invalidate(
          `unitEconomics.${field}`,
          "Keys must be unique"
        );
      }
    }

    for (const assumption of economics.assumptions) {
      const definition = config.inputs.find(
        (inputDefinition) =>
          inputDefinition.key === assumption.key
      );

      if (
        definition &&
        [
          assumption.low,
          assumption.base,
          assumption.high,
        ].some(
          (value) =>
            value != null &&
            (
              !Number.isFinite(value) ||
              value < definition.min ||
              value > definition.max
            )
        )
      ) {
        this.invalidate(
          "unitEconomics.assumptions",
          "Assumption value outside its declared unit range"
        );
      }

      if (
        (
          assumption.low != null &&
          assumption.base != null &&
          assumption.low > assumption.base
        ) ||
        (
          assumption.base != null &&
          assumption.high != null &&
          assumption.base > assumption.high
        ) ||
        (
          assumption.low != null &&
          assumption.high != null &&
          assumption.low > assumption.high
        )
      ) {
        this.invalidate(
          "unitEconomics.assumptions",
          "Assumption bounds must satisfy low <= base <= high"
        );
      }

      if (
        assumption.evidenceIndexes.some(
          (index) =>
            index >= this.evidence.length
        ) ||
        new Set(
          assumption.evidenceIndexes
        ).size !==
          assumption.evidenceIndexes.length
      ) {
        this.invalidate(
          "unitEconomics.assumptions",
          "Evidence indexes must be unique and in range"
        );
      }
    }

    if (
      (
        this.financial?.currency &&
        this.financial.currency !==
          economics.currency
      ) ||
      this.financial?.inputs?.some(
        (financialInput) =>
          financialInput.period !== economics.period
      ) ||
      (
        this.allocation?.currency &&
        this.allocation.currency !==
          economics.currency
      )
    ) {
      this.invalidate(
        "unitEconomics",
        "One financial period and currency is required"
      );
    }
  }

  if (
    this.packageKey === "CAPITAL-009" &&
    this.status === "approved"
  ) {
    if (
      require("../services/unitEconomicsAnalysis")
        .analyzeUnitEconomics(this)
        .blockers.length
    ) {
      this.invalidate(
        "unitEconomics",
        "Incomplete economics cannot be approved"
      );
    }

    if (
      !this.isNew &&
      [
        "unitEconomics",
        "evidence",
        "financial",
        "allocation",
      ].some((field) => this.isModified(field))
    ) {
      this.invalidate(
        "status",
        "Revise changed economics or evidence as a draft before approval"
      );
    }
  }

  /*
   * Shared readiness validation
   */
  if (
    this.evidence.some(
      (entry) =>
        entry.observedAt > now ||
        entry.expiresAt <= entry.observedAt
    )
  ) {
    this.invalidate(
      "evidence",
      "Evidence needs an observed time in the past and a later expiry"
    );
  }

  if (
    new Set(
      this.responses.map((row) => row.index)
    ).size !== this.responses.length ||
    this.responses.some(
      (row) =>
        row.index >=
          (spec?.requirements.length || 0) ||
        row.evidenceIndexes.some(
          (index) =>
            index >= this.evidence.length
        )
    )
  ) {
    this.invalidate(
      "responses",
      "Requirement and evidence indexes must be unique and in range"
    );
  }

  if (
    this.dependencies.some(
      (dependencyId) =>
        String(dependencyId) === String(this._id)
    )
  ) {
    this.invalidate(
      "dependencies",
      "A record cannot depend on itself"
    );
  }

  if (
    this.status === "approved" &&
    (
      !this.reviewedAt ||
      !this.reviewedBy ||
      String(this.reviewedBy) ===
        String(this.owner) ||
      String(this.reviewedBy) ===
        String(this.createdBy)
    )
  ) {
    this.invalidate(
      "reviewedBy",
      "Approval requires an independent reviewer"
    );
  }

  if (
    this.status === "approved" &&
    (
      !this.ownerAttestedAt ||
      String(this.ownerAttestedBy) !==
        String(this.owner) ||
      !this.evidence.length ||
      !this.reviewerNotes ||
      !this.reviewedAt ||
      this.reviewedAt > now ||
      this.expiresAt <= now
    )
  ) {
    this.invalidate(
      "status",
      "Approval requires owner signoff, evidence, current expiry and observed review notes"
    );
  }

  if (
    this.financial?.inputs?.some(
      (financialInput) =>
        financialInput.value < 0 ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(
          financialInput.period
        )
    )
  ) {
    this.invalidate(
      "financial.inputs",
      "Financial inputs must be nonnegative and use a monthly YYYY-MM period"
    );
  }

  if (
    this.financial?.inputs?.length &&
    new Set(
      this.financial.inputs.map(
        (financialInput) =>
          financialInput.key
      )
    ).size !== this.financial.inputs.length
  ) {
    this.invalidate(
      "financial.inputs",
      "Financial input keys must be unique"
    );
  }

  if (
    this.allocation?.maximum <
    this.allocation?.minimum
  ) {
    this.invalidate(
      "allocation",
      "Maximum budget must not be below minimum"
    );
  }

  if (
    this.appetite?.blocker <
    this.appetite?.warning
  ) {
    this.invalidate(
      "appetite",
      "Blocker threshold must be at least the warning threshold"
    );
  }
});

module.exports = mongoose.model(
  "ExternalReadinessRecord",
  schema
);