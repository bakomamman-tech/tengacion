const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const express = require("express");
const request = require("supertest");
const fs = require("fs");
const path = require("path");

jest.mock("../middleware/auth", () => (req, res, next) => {
  if (!req.headers["x-user"]) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.user = {
    id: req.headers["x-user"],
    role: req.headers["x-role"] || "user",
  };

  next();
});

const service = require("../services/externalReadinessService");
const Record = require("../models/ExternalReadinessRecord");
const Share = require("../models/ExternalReadinessShare");
const Finding = require("../models/AuditFinding");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");

const app = express();

app.use(express.json());
app.use(
  "/readiness",
  require("../routes/externalReadiness")
);

let mongod;
let owner;
let reviewer;
let recipient;

const future = (days = 7) =>
  new Date(
    Date.now() + days * 86400000
  );

const as = (
  user,
  role = "admin"
) => ({
  "x-user": String(user._id),
  "x-role": role,
});

const draft = (
  key = "CERTIFICATION-004",
  overrides = {}
) => ({
  packageKey: key,
  title: "Reviewed claim",
  owner: owner._id,
  domain: "external_reporting",
  scope: "Aggregate operational summary",
  dueAt: future(),
  expiresAt: future(10),
  audience: "partner",
  classification: "sanitized",
  publicSummary: "Scoped summary",
  exclusions:
    "No raw user, finance, security or AI memory data",
  withdrawalRule:
    "Withdraw when evidence changes",

  evidence: [
    {
      source:
        "restricted/internal-evidence",
      summary:
        "Private reviewer evidence",
      observedAt: new Date(),
      expiresAt: future(10),
      confidence: "current",
    },
  ],

  responses: service.catalog
    .find(
      (packageSpec) =>
        packageSpec.key === key
    )
    .requirements.flatMap(
      (requirement, index) =>
        requirement.endsWith(":")
          ? []
          : [
              {
                index,
                response:
                  "Verified against scoped source",
                evidenceIndexes: [0],
              },
            ]
    ),

  reason:
    "Create a scoped packet",

  ...overrides,
});

async function approved(
  key,
  overrides
) {
  let row =
    await service.saveDraft({
      body: draft(
        key,
        overrides
      ),
      actor: owner._id,
    });

  for (const action of [
    "attest",
    "submit",
    "approve",
  ]) {
    row =
      await service.transition({
        recordId: row._id,

        actor:
          action === "approve"
            ? reviewer._id
            : owner._id,

        body: {
          action,
          reason:
            "Evidence reviewed",
          notes:
            "Independent review completed",
          version: row.__v,
          outcome: "pass",
        },
      });
  }

  return row;
}

beforeAll(async () => {
  mongod =
    await MongoMemoryServer.create();

  await mongoose.connect(
    mongod.getUri()
  );
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();

  [
    owner,
    reviewer,
    recipient,
  ] = await User.create(
    [
      "owner",
      "reviewer",
      "recipient",
    ].map((name) => ({
      name,
      username:
        `readiness_${name}`,
      email:
        `${name}@readiness.test`,
      password:
        "Password123!",
      role:
        name === "recipient"
          ? "user"
          : "admin",
    }))
  );
});

afterAll(async () => {
  await mongoose.disconnect();

  if (mongod) {
    await mongod.stop();
  }
});

test(
  "all 48 contracts trace to checked-in roadmaps, with truthful empty readiness",
  async () => {
    expect(
      service.catalog
    ).toHaveLength(48);

    expect(
      new Set(
        service.catalog.map(
          (packageSpec) =>
            packageSpec.key
        )
      ).size
    ).toBe(48);

    for (
      const packageSpec of
      service.catalog
    ) {
      const source =
        fs
          .readFileSync(
            path.resolve(
              __dirname,
              "../..",
              packageSpec.source
            ),
            "utf8"
          )
          .toLowerCase();

      expect(
        source
      ).toContain(
        packageSpec.title.toLowerCase()
      );

      expect(
        packageSpec.requirements.length
      ).toBeGreaterThan(0);

      expect(
        packageSpec
          .acceptanceCriteria
          .length
      ).toBeGreaterThan(0);
    }

    const report =
      await service.report();

    expect(
      report.summary
    ).toMatchObject({
      packageCount: 48,
      records: 0,
      readyRecords: 0,
      observedReviews: 0,
      decision:
        "hold_for_evidence",
    });
  }
);

test(
  "inventory and mutations require authenticated administrators",
  async () => {
    await request(app)
      .get("/readiness")
      .expect(401);

    await request(app)
      .get("/readiness")
      .set(
        as(
          recipient,
          "user"
        )
      )
      .expect(403);

    await request(app)
      .post(
        "/readiness/records"
      )
      .set(
        as(
          recipient,
          "user"
        )
      )
      .send(draft())
      .expect(403);

    const response =
      await request(app)
        .post(
          "/readiness/records"
        )
        .set(as(owner))
        .send(draft())
        .expect(200);

    expect(
      response.headers[
        "cache-control"
      ]
    ).toBe("no-store");

    expect(
      response.body.status
    ).toBe("draft");

    expect(
      await AuditLog.countDocuments({
        action:
          "external_readiness.create",
      })
    ).toBe(1);
  }
);

test(
  "owner signoff, independent approval, version checks, and edit invalidation",
  async () => {
    let row =
      await service.saveDraft({
        body: draft(),
        actor: owner._id,
      });

    const move = (
      actor,
      action,
      version = row.__v
    ) =>
      service.transition({
        recordId: row._id,
        actor,

        body: {
          action,
          version,
          reason: "Review",
          notes: "Checked",
        },
      });

    await expect(
      move(
        owner._id,
        "submit"
      )
    ).rejects.toThrow(
      "owner_signoff_missing"
    );

    await expect(
      move(
        reviewer._id,
        "attest"
      )
    ).rejects.toThrow(
      "Only the owner"
    );

    row = await move(
      owner._id,
      "attest"
    );

    row = await move(
      owner._id,
      "submit"
    );

    await expect(
      move(
        owner._id,
        "approve"
      )
    ).rejects.toThrow(
      "independent"
    );

    await expect(
      move(
        reviewer._id,
        "approve",
        0
      )
    ).rejects.toMatchObject({
      status: 409,
    });

    row = await move(
      reviewer._id,
      "approve"
    );

    expect(
      row.status
    ).toBe("approved");

    row =
      await service.saveDraft({
        recordId: row._id,
        actor: owner._id,

        body: {
          version: row.__v,
          title: "Revised",
          reason: "Correction",
        },
      });

    expect(
      row.status
    ).toBe("draft");

    expect(
      row.reviewedBy
    ).toBeUndefined();

    expect(
      row.ownerAttestedAt
    ).toBeUndefined();
  }
);

test(
  "recipient projection excludes internal evidence; answers require independent review; revocation is immediate",
  async () => {
    const row =
      await approved();

    const share =
      await service.createShare({
        recordId: row._id,
        actor: reviewer._id,

        body: {
          recipient:
            recipient._id,
          version: row.__v,
          expiresAt: future(2),
          reason:
            "Requested diligence",
        },
      });

    await request(app)
      .get(
        `/readiness/shares/${share._id}`
      )
      .set(as(owner))
      .expect(404);

    const response =
      await request(app)
        .get(
          `/readiness/shares/${share._id}`
        )
        .set(
          as(
            recipient,
            "user"
          )
        )
        .expect(200);

    expect(
      JSON.stringify(
        response.body
      )
    ).not.toContain(
      "restricted/internal-evidence"
    );

    expect(
      response.body.packet.summary
    ).toBe(
      "Scoped summary"
    );

    let question =
      await service.askQuestion({
        shareId: share._id,
        actor:
          recipient._id,

        body: {
          question:
            "What is the scope?",
        },
      });

    question =
      await service.answerQuestion({
        questionId:
          question._id,
        actor: owner._id,

        body: {
          action: "draft",
          response:
            "Reviewed scope response",
          version:
            question.__v,
          reason: "Draft",
        },
      });

    const hidden =
      await request(app)
        .get(
          `/readiness/shares/${share._id}`
        )
        .set(
          as(
            recipient,
            "user"
          )
        )
        .expect(200);

    expect(
      hidden.body.questions[0]
        .response
    ).toBe("");

    await expect(
      service.answerQuestion({
        questionId:
          question._id,
        actor: owner._id,

        body: {
          action: "approve",
          version:
            question.__v,
          reason: "Review",
        },
      })
    ).rejects.toThrow(
      "independent"
    );

    await service.answerQuestion({
      questionId:
        question._id,
      actor: reviewer._id,

      body: {
        action: "approve",
        version:
          question.__v,
        reason: "Review",
      },
    });

    const visible =
      await request(app)
        .get(
          `/readiness/shares/${share._id}`
        )
        .set(
          as(
            recipient,
            "user"
          )
        )
        .expect(200);

    expect(
      visible.body.questions[0]
        .response
    ).toBe(
      "Reviewed scope response"
    );

    await service.revokeShare(
      share._id
    );

    await request(app)
      .get(
        `/readiness/shares/${share._id}`
      )
      .set(
        as(
          recipient,
          "user"
        )
      )
      .expect(410);
  }
);

test(
  "revision, expired access and stale evidence invalidate recipient access",
  async () => {
    const row =
      await approved();

    const share =
      await service.createShare({
        recordId: row._id,
        actor: reviewer._id,

        body: {
          recipient:
            recipient._id,
          version: row.__v,
          expiresAt: future(2),
          reason: "Review",
        },
      });

    await Share.updateOne(
      {
        _id: share._id,
      },
      {
        expiresAt:
          future(-1),
      }
    );

    await expect(
      service.readShare(
        share._id,
        recipient._id
      )
    ).rejects.toMatchObject({
      status: 410,
    });

    await Share.updateOne(
      {
        _id: share._id,
      },
      {
        expiresAt:
          future(2),
      }
    );

    await Record.updateOne(
      {
        _id: row._id,
      },
      {
        "evidence.0.expiresAt":
          future(-1),
      }
    );

    await expect(
      service.readShare(
        share._id,
        recipient._id
      )
    ).rejects.toMatchObject({
      status: 410,
    });

    await Record.updateOne(
      {
        _id: row._id,
      },
      {
        "evidence.0.expiresAt":
          future(10),
      }
    );

    await service.saveDraft({
      recordId: row._id,
      actor: owner._id,

      body: {
        version: row.__v,
        reason: "Correction",
        title: "Revised",
      },
    });

    await expect(
      service.readShare(
        share._id,
        recipient._id
      )
    ).rejects.toMatchObject({
      status: 410,
    });
  }
);

test(
  "retired evidence, invalid domains, unsupported authority fields and bad indexes fail closed",
  async () => {
    await expect(
      service.saveDraft({
        body: draft(
          undefined,
          {
            status:
              "approved",
          }
        ),
        actor: owner._id,
      })
    ).rejects.toThrow(
      "Unsupported fields"
    );

    await expect(
      service.saveDraft({
        body: draft(
          undefined,
          {
            domain:
              "fake_domain",
          }
        ),
        actor: owner._id,
      })
    ).rejects.toThrow();

    await expect(
      service.saveDraft({
        body: draft(
          undefined,
          {
            responses: [
              {
                index: 0,
                response:
                  "Fake",
                evidenceIndexes:
                  [99],
              },
            ],
          }
        ),
        actor: owner._id,
      })
    ).rejects.toThrow();

    const row = draft();

    row.evidence[0]
      .expiresAt =
      future(-1);

    expect(
      service.localBlockers(row)
    ).toContain(
      "evidence_not_current"
    );
  }
);

test(
  "unresolved high risk findings and failed retests cannot be approved",
  async () => {
    const findingId =
      new mongoose.Types.ObjectId();

    await Finding.collection.insertOne({
      _id: findingId,
      domainKey:
        "external_reporting",
      status: "retest",
      severity: "high",
      dueAt: future(),
      retestState: "failed",
    });

    let row =
      await service.saveDraft({
        body: draft(
          "AUDIT-012",
          {
            findingIds: [
              findingId,
            ],
          }
        ),
        actor: owner._id,
      });

    for (const action of [
      "attest",
      "submit",
    ]) {
      row =
        await service.transition({
          recordId: row._id,
          actor: owner._id,

          body: {
            action,
            version: row.__v,
            reason:
              "Prepare retest",
          },
        });
    }

    await expect(
      service.transition({
        recordId: row._id,
        actor: reviewer._id,

        body: {
          action: "approve",
          version: row.__v,
          reason: "Retested",
          notes:
            "Claimed pass",
          outcome: "pass",
        },
      })
    ).rejects.toThrow(
      "unresolved_audit_findings"
    );

    expect(
      await service.blockersFor(
        row
      )
    ).toContain(
      "retest_not_verified"
    );
  }
);

test(
  "missing and circular dependencies block readiness",
  async () => {
    const a =
      await approved();

    const b =
      await approved();

    await Record.updateOne(
      {
        _id: a._id,
      },
      {
        dependencies: [
          b._id,
        ],
      }
    );

    await Record.updateOne(
      {
        _id: b._id,
      },
      {
        dependencies: [
          a._id,
        ],
      }
    );

    expect(
      (
        await service.blockersFor(
          await Record.findById(
            a._id
          )
        )
      ).some((blocker) =>
        blocker.startsWith(
          "dependency_blocked"
        )
      )
    ).toBe(true);

    await Record.updateOne(
      {
        _id: a._id,
      },
      {
        dependencies: [
          new mongoose.Types.ObjectId(),
        ],
      }
    );

    expect(
      await service.blockersFor(
        await Record.findById(
          a._id
        )
      )
    ).toContain(
      "dependency_not_found"
    );
  }
);

test(
  "financial inputs preserve zero, avoid revenue double count and reject inconsistent periods",
  async () => {
    const inputs =
      service.FINANCIAL_KEYS.map(
        (key) => ({
          key,

          value:
            key ===
            "platform_revenue"
              ? 50
              : key ===
                  "cash_balance"
                ? 300
                : 10,

          confidence:
            "actual",

          source:
            "Finance close",

          period:
            "2026-09",
        })
      );

    const summary =
      service.financialSummary({
        inputs,
        currency: "NGN",
        scenario: "base",
      });

    expect(
      summary
    ).toMatchObject({
      monthlyCosts: 80,
      netMonthlyBurn: 30,
      runwayMonths: 10,
      complete: true,
      externallyApproved:
        false,
    });

    expect(
      service.financialSummary({
        inputs: [],
      }).runwayMonths
    ).toBeNull();

    inputs[0].period =
      "2026-08";

    expect(
      service.financialSummary({
        inputs,
      }).periodsConsistent
    ).toBe(false);

    inputs[0].value = -1;

    await expect(
      service.saveDraft({
        body: draft(
          "CAPITAL-003",
          {
            financial: {
              scenario:
                "base",
              currency: "NGN",
              inputs,
            },
          }
        ),
        actor: owner._id,
      })
    ).rejects.toThrow(
      "nonnegative"
    );
  }
);