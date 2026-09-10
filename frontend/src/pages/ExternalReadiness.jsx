import {
  useCallback,
  useEffect,
  useState,
} from "react";

import CapitalPathDecisionWorkspace from "../components/admin/CapitalPathDecisionWorkspace";
import UnitEconomicsWorkspace from "../components/admin/UnitEconomicsWorkspace";
import AdminShell from "../components/AdminShell";
import {
  apiRequest,
  API_BASE,
} from "../api";

import "./external-readiness.css";

const base =
  `${API_BASE}/external-readiness`;

const dateInput = (value) =>
  value
    ? new Date(value)
        .toISOString()
        .slice(0, 16)
    : "";

const fresh = (user) => ({
  title: "",
  owner:
    user?._id ||
    user?.id ||
    "",
  domain: "external_reporting",
  scope: "",
  dueAt: "",
  expiresAt: "",
  evidence: [],
  responses: [],
  audience: "internal",
  classification: "restricted",
  dependencies: [],
  findingIds: [],
  relatedControlKeys: [],
});

const send = (
  path,
  body,
  method = "POST"
) =>
  apiRequest(
    `${base}${path}`,
    {
      method,
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(body),
    }
  );

const label = (key = "") =>
  key
    .replace(
      /([A-Z])/g,
      " $1"
    )
    .replace(/_/g, " ")
    .replace(
      /^./,
      (character) =>
        character.toUpperCase()
    );

const fieldsByKind = {
  decision: [
    "decision",
    "alternatives",
    "reversalCondition",
  ],
  allocation: [
    "decision",
    "reversalCondition",
  ],
  commitment: [
    "decision",
    "reversalCondition",
  ],
  calendar: [
    "escalationOwner",
  ],
  monitor: [
    "escalationOwner",
  ],
};

const groupsByKind = {
  appetite: {
    appetite: [
      "unit",
      "warning",
      "blocker",
      "current",
      "incidentTrigger",
    ],
  },

  candidate: {
    candidate: [
      "path",
      "businessValue",
      "demand",
      "evidenceReadiness",
      "risk",
      "cost",
      "timeline",
      "renewalBurden",
      "overclaimRisk",
    ],
  },

  allocation: {
    allocation: [
      "minimum",
      "maximum",
      "currency",
      "milestone",
      "successMetric",
      "riskMetric",
      "stopLoss",
    ],
  },

  risk: {
    risk: [
      "mitigation",
      "compensatingControl",
      "reviewTrigger",
      "acceptedUntil",
    ],
  },

  commitment: {
    risk: [
      "mitigation",
      "compensatingControl",
      "reviewTrigger",
      "acceptedUntil",
    ],
  },
};

const numeric = new Set([
  "warning",
  "blocker",
  "current",
  "businessValue",
  "demand",
  "evidenceReadiness",
  "risk",
  "cost",
  "minimum",
  "maximum",
]);

const sameValue = (
  first,
  second
) =>
  JSON.stringify(
    first ?? null
  ) ===
  JSON.stringify(
    second ?? null
  );

const cleanLines = (values) => [
  ...new Set(
    (values || [])
      .map((value) =>
        String(value).trim()
      )
      .filter(Boolean)
  ),
];

function CapitalBlockerWorkspace({
  value,
  onChange,
  config,
  evidence = [],
  risk = {},
  onRiskChange,
  records = [],
  analysis,
  dirty,
}) {
  if (!config) {
    return (
      <section
        aria-label="CAPITAL-010 Capital Blocker workspace"
      >
        <h2>
          CAPITAL-010 Capital
          Blockers
        </h2>

        <p>
          Capital blocker
          configuration is
          unavailable. Refresh the
          readiness inventory.
        </p>
      </section>
    );
  }

  const blocker =
    value || {};

  const setBlocker = (
    field,
    next
  ) => {
    onChange({
      ...blocker,
      [field]: next,
    });
  };

  const setRisk = (
    field,
    next
  ) => {
    onRiskChange({
      ...risk,
      [field]: next,
    });
  };

  const toggleEvidence = (
    field,
    index,
    checked
  ) => {
    const current =
      blocker[field] || [];

    setBlocker(
      field,
      checked
        ? [
            ...new Set([
              ...current,
              index,
            ]),
          ]
        : current.filter(
            (entry) =>
              entry !== index
          )
    );
  };

  const capital009Records =
    records.filter(
      (record) =>
        record.packageKey ===
        "CAPITAL-009"
    );

  const knownRiskKeys = [
    ...new Set(
      capital009Records.flatMap(
        (record) => {
          const triggers =
            record
              .unitEconomicsAnalysis
              ?.riskTriggers ||
            record.unitEconomics
              ?.riskTriggers ||
            [];

          return triggers
            .map(
              (trigger) =>
                trigger.key
            )
            .filter(Boolean);
        }
      )
    ),
  ];

  const toggleRiskKey = (
    riskKey,
    checked
  ) => {
    const current =
      blocker.economicsRiskKeys ||
      [];

    setBlocker(
      "economicsRiskKeys",
      checked
        ? [
            ...new Set([
              ...current,
              riskKey,
            ]),
          ]
        : current.filter(
            (entry) =>
              entry !== riskKey
          )
    );
  };

  const resolution =
    blocker.resolution || "";

  return (
    <section
      aria-label="CAPITAL-010 Capital Blocker workspace"
      className="readiness-special-workspace"
    >
      <h2>
        CAPITAL-010 Capital
        Blockers
      </h2>

      <p>
        Use this workspace to
        record how a capital
        readiness blocker is
        closed, narrowed, delayed,
        redirected, or escalated
        for advisor review.
      </p>

      <p>
        <strong>
          Human review only.
        </strong>{" "}
        Recording a decision here
        does not establish
        real-world closure,
        authorize investor or
        partner outreach, change a
        financing path, accept
        legal, tax, compliance,
        audit, security or
        financial risk, approve
        spending, or move money.
      </p>

      <p>
        Capital conversations must
        remain bounded by current
        operating evidence and
        independent human review.
      </p>

      {dirty && (
        <p role="status">
          CAPITAL-010 has unsaved
          governance changes. Save
          the draft before using
          review transitions.
        </p>
      )}

      <div className="readiness-grid">
        <label>
          Blocker category
          <select
            required
            value={
              blocker.category ||
              ""
            }
            onChange={(event) =>
              setBlocker(
                "category",
                event.target.value
              )
            }
          >
            <option value="">
              Select blocker
              category
            </option>

            {config.categories.map(
              (category) => (
                <option
                  key={
                    category.key
                  }
                  value={
                    category.key
                  }
                >
                  {
                    category.label
                  }
                </option>
              )
            )}
          </select>
        </label>

        <label>
          Resolution decision
          <select
            required
            value={resolution}
            onChange={(event) =>
              setBlocker(
                "resolution",
                event.target.value
              )
            }
          >
            <option value="">
              Select decision
            </option>

            {config.decisions.map(
              (decision) => (
                <option
                  key={decision}
                  value={decision}
                >
                  {label(
                    decision
                  )}
                </option>
              )
            )}
          </select>
        </label>
      </div>

      <label>
        Decision rationale
        <textarea
          required
          maxLength={4000}
          value={
            blocker.rationale ||
            ""
          }
          onChange={(event) =>
            setBlocker(
              "rationale",
              event.target.value
            )
          }
        />
      </label>

      {resolution ===
        "narrow_claim" && (
        <fieldset>
          <legend>
            Claim narrowing
          </legend>

          <p>
            Preserve the original
            claim and replace it
            with a materially
            narrower statement
            supported by current
            evidence.
          </p>

          <label>
            Original claim
            <textarea
              required
              maxLength={4000}
              value={
                blocker.originalClaim ||
                ""
              }
              onChange={(
                event
              ) =>
                setBlocker(
                  "originalClaim",
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Revised narrower claim
            <textarea
              required
              maxLength={4000}
              value={
                blocker.revisedClaim ||
                ""
              }
              onChange={(
                event
              ) =>
                setBlocker(
                  "revisedClaim",
                  event.target.value
                )
              }
            />
          </label>
        </fieldset>
      )}

      {resolution ===
        "delay_outreach" && (
        <fieldset>
          <legend>
            Outreach hold
          </legend>

          <p>
            State exactly what
            outreach remains on
            hold and what operating
            gap must be reviewed
            before the hold can be
            reconsidered.
          </p>

          <label>
            Outreach constraint
            <textarea
              required
              maxLength={4000}
              value={
                blocker.outreachConstraint ||
                ""
              }
              onChange={(
                event
              ) =>
                setBlocker(
                  "outreachConstraint",
                  event.target.value
                )
              }
            />
          </label>
        </fieldset>
      )}

      {resolution ===
        "change_financing_path" && (
        <fieldset>
          <legend>
            Financing path
          </legend>

          <p>
            This records a proposed
            human-reviewed
            financing direction
            only. It does not
            execute or authorize
            financing.
          </p>

          <label>
            Proposed financing
            path
            <textarea
              required
              maxLength={2000}
              value={
                blocker.financingPath ||
                ""
              }
              onChange={(
                event
              ) =>
                setBlocker(
                  "financingPath",
                  event.target.value
                )
              }
            />
          </label>
        </fieldset>
      )}

      {[
        "close_with_evidence",
        "narrow_claim",
      ].includes(
        resolution
      ) && (
        <fieldset>
          <legend>
            Blocker evidence
          </legend>

          <p>
            Closure and claim
            narrowing require
            linked evidence whose
            confidence is current
            and whose observation
            and expiry dates remain
            valid.
          </p>

          {!evidence.length && (
            <p>
              Add current evidence
              below before this
              resolution can become
              reviewable.
            </p>
          )}

          {evidence.map(
            (entry, index) => (
              <label
                key={index}
              >
                <input
                  type="checkbox"
                  checked={(
                    blocker.evidenceIndexes ||
                    []
                  ).includes(
                    index
                  )}
                  onChange={(
                    event
                  ) =>
                    toggleEvidence(
                      "evidenceIndexes",
                      index,
                      event.target
                        .checked
                    )
                  }
                />

                Evidence{" "}
                {index + 1}
                {" — "}
                {entry.summary ||
                  entry.source ||
                  "Untitled evidence"}
                {" — "}
                {label(
                  entry.confidence ||
                    "incomplete"
                )}
              </label>
            )
          )}
        </fieldset>
      )}

      <fieldset>
        <legend>
          CAPITAL-009 economics
          risk links
        </legend>

        <p>
          Link this blocker to
          existing CAPITAL-009 risk
          trigger keys when the
          blocker comes from unit
          economics. A referenced
          risk key also requires
          the corresponding
          CAPITAL-009 record in the
          Dependencies field.
        </p>

        {knownRiskKeys.length ? (
          knownRiskKeys.map(
            (riskKey) => (
              <label key={riskKey}>
                <input
                  type="checkbox"
                  checked={(
                    blocker.economicsRiskKeys ||
                    []
                  ).includes(
                    riskKey
                  )}
                  onChange={(
                    event
                  ) =>
                    toggleRiskKey(
                      riskKey,
                      event.target
                        .checked
                    )
                  }
                />

                {riskKey}
              </label>
            )
          )
        ) : (
          <p>
            No CAPITAL-009 risk
            trigger keys are
            currently available in
            the loaded report.
          </p>
        )}

        <label>
          Economics risk keys
          (one per line)
          <textarea
            value={(
              blocker.economicsRiskKeys ||
              []
            ).join("\n")}
            onChange={(event) =>
              setBlocker(
                "economicsRiskKeys",
                event.target.value.split(
                  "\n"
                )
              )
            }
            onBlur={() =>
              setBlocker(
                "economicsRiskKeys",
                cleanLines(
                  blocker.economicsRiskKeys
                )
              )
            }
          />
        </label>

        {!!capital009Records.length && (
          <details>
            <summary>
              CAPITAL-009 source
              records
            </summary>

            {capital009Records.map(
              (record) => (
                <p
                  key={
                    record.id ||
                    record._id
                  }
                >
                  Record{" "}
                  {record.id ||
                    record._id}
                  :{" "}
                  {(
                    record
                      .unitEconomicsAnalysis
                      ?.riskTriggers ||
                    record
                      .unitEconomics
                      ?.riskTriggers ||
                    []
                  )
                    .map(
                      (trigger) =>
                        `${trigger.key} (${label(
                          trigger.state ||
                            "recorded"
                        )})`
                    )
                    .join(", ") ||
                    "No risk triggers"}
                </p>
              )
            )}
          </details>
        )}
      </fieldset>

      {resolution ===
        "accept_risk_with_advisor_review" && (
        <fieldset>
          <legend>
            Advisor-reviewed risk
          </legend>

          <p>
            Critical risk cannot be
            accepted through this
            record. Noncritical
            risk requires a future
            review expiry,
            mitigation,
            compensating control,
            review trigger and
            current advisor-review
            evidence.
          </p>

          <label>
            Severity
            <select
              value={
                risk.severity ||
                "medium"
              }
              onChange={(event) =>
                setRisk(
                  "severity",
                  event.target.value
                )
              }
            >
              {[
                "low",
                "medium",
                "high",
                "critical",
              ].map((severity) => (
                <option
                  key={severity}
                  value={severity}
                >
                  {label(
                    severity
                  )}
                </option>
              ))}
            </select>
          </label>

          <label>
            Mitigation
            <textarea
              required
              value={
                risk.mitigation ||
                ""
              }
              onChange={(event) =>
                setRisk(
                  "mitigation",
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Compensating control
            <textarea
              required
              value={
                risk.compensatingControl ||
                ""
              }
              onChange={(event) =>
                setRisk(
                  "compensatingControl",
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Review trigger
            <textarea
              required
              value={
                risk.reviewTrigger ||
                ""
              }
              onChange={(event) =>
                setRisk(
                  "reviewTrigger",
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Accepted until (UTC)
            <input
              required
              type="datetime-local"
              value={dateInput(
                risk.acceptedUntil
              )}
              onChange={(event) =>
                setRisk(
                  "acceptedUntil",
                  event.target.value
                    ? `${event.target.value}:00.000Z`
                    : ""
                )
              }
            />
          </label>

          <h3>
            Advisor review evidence
          </h3>

          {!evidence.length && (
            <p>
              Add current advisor
              review evidence below
              before this resolution
              can be reviewed.
            </p>
          )}

          {evidence.map(
            (entry, index) => (
              <label
                key={index}
              >
                <input
                  type="checkbox"
                  checked={(
                    blocker.advisorReviewEvidenceIndexes ||
                    []
                  ).includes(
                    index
                  )}
                  onChange={(
                    event
                  ) =>
                    toggleEvidence(
                      "advisorReviewEvidenceIndexes",
                      index,
                      event.target
                        .checked
                    )
                  }
                />

                Evidence{" "}
                {index + 1}
                {" — "}
                {entry.summary ||
                  entry.source ||
                  "Untitled evidence"}
                {" — "}
                {label(
                  entry.confidence ||
                    "incomplete"
                )}
              </label>
            )
          )}
        </fieldset>
      )}

      {analysis && (
        <fieldset>
          <legend>
            Saved CAPITAL-010
            analysis
          </legend>

          {dirty && (
            <p>
              This analysis belongs
              to the saved version
              and does not yet
              include your unsaved
              edits.
            </p>
          )}

          <p>
            State:{" "}
            <strong>
              {label(
                analysis.state ||
                  "unknown"
              )}
            </strong>
          </p>

          <p>
            Category:{" "}
            {label(
              analysis.category ||
                "unassigned"
            )}
          </p>

          <p>
            Resolution:{" "}
            {label(
              analysis.resolution ||
                "unassigned"
            )}
          </p>

          {analysis.blockers
            ?.length ? (
            <>
              <h3>
                Current blockers
              </h3>

              <ul>
                {analysis.blockers.map(
                  (blockerCode) => (
                    <li
                      key={
                        blockerCode
                      }
                    >
                      {label(
                        blockerCode
                      )}
                    </li>
                  )
                )}
              </ul>
            </>
          ) : (
            <p>
              No CAPITAL-010
              analyzer blockers are
              recorded for the
              saved version.
            </p>
          )}

          <p>
            Human decision
            recorded:{" "}
            {analysis.humanDecisionRecorded
              ? "Yes"
              : "No"}
          </p>

          <p>
            Real-world closure
            established by
            software: No
          </p>

          <p>
            Outreach authorized by
            software: No
          </p>

          <p>
            Financing change
            authorized by software:
            No
          </p>

          <p>
            Risk accepted by
            software: No
          </p>

          <p>
            Money movement
            authorized by software:
            No
          </p>
        </fieldset>
      )}
    </section>
  );
}

export default function ExternalReadiness({
  user,
}) {
  const [
    data,
    setData,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    key,
    setKey,
  ] = useState("AUDIT-012");

  const [
    draft,
    setDraft,
  ] = useState(() =>
    fresh(user)
  );

  const [
    selected,
    setSelected,
  ] = useState(null);

  const [
    reason,
    setReason,
  ] = useState("");

  const [
    notes,
    setNotes,
  ] = useState("");

  const [
    recipient,
    setRecipient,
  ] = useState("");

  const [
    shareExpiry,
    setShareExpiry,
  ] = useState("");

  const [
    answers,
    setAnswers,
  ] = useState({});

  const load =
    useCallback(async () => {
      const result =
        await apiRequest(base);

      setData(result);

      return result;
    }, []);

  useEffect(() => {
    load().catch((loadError) =>
      setError(
        loadError.message
      )
    );
  }, [load]);

  const spec =
    data?.packages.find(
      (packageSpec) =>
        packageSpec.key === key
    );

  const set = (
    field,
    value
  ) =>
    setDraft(
      (current) => ({
        ...current,
        [field]: value,
      })
    );

  const edit = (row) => {
    setKey(row.packageKey);
    setSelected(row);
    setReason("");
    setNotes("");

    const allowed = [
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
      "capitalPathDecision",
      "capitalBlocker",
      "unitEconomics",
    ];

    const editable =
      Object.fromEntries(
        allowed
          .filter(
            (field) =>
              row[field] !==
              undefined
          )
          .map((field) => [
            field,
            row[field],
          ])
      );

    setDraft({
      ...fresh(user),
      ...editable,
    });
  };

  const act = async (
    operation,
    message
  ) => {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result =
        await operation();

      const updated =
        await load();

      if (
        result?.packageKey
      ) {
        edit(
          updated.records.find(
            (record) =>
              record.id ===
              String(
                result._id
              )
          ) || result
        );
      }

      setNotice(message);
    } catch (
      operationError
    ) {
      setError(
        operationError.message
      );
    } finally {
      setBusy(false);
    }
  };

  const economicsDirty =
    key === "CAPITAL-009" &&
    (
      !selected ||
      !sameValue(
        draft.unitEconomics,
        selected.unitEconomics
      ) ||
      !sameValue(
        draft.evidence,
        selected.evidence
      )
    );

  const capitalBlockerDirty =
    key === "CAPITAL-010" &&
    (
      !selected ||
      [
        "capitalBlocker",
        "evidence",
        "risk",
        "decision",
        "alternatives",
        "reversalCondition",
        "dependencies",
        "findingIds",
      ].some(
        (field) =>
          !sameValue(
            draft[field],
            selected[field]
          )
      )
    );

  const capitalPathDirty = key === "CAPITAL-011" && (
    !selected || [
      "capitalPathDecision", "evidence", "decision", "alternatives",
      "reversalCondition", "dependencies", "findingIds", "relatedControlKeys",
      "owner", "dueAt", "expiresAt",
    ].some((field) => !sameValue(draft[field], selected[field]))
  );

  const governanceDirty =
    economicsDirty ||
    capitalBlockerDirty || capitalPathDirty;

  const textField = (
    field,
    source = draft,
    update = set,
    type = "text"
  ) => (
    <label key={field}>
      {label(field)}

      <input
        type={type}
        value={
          source?.[field] ??
          ""
        }
        onChange={(event) =>
          update(
            field,
            type ===
              "number"
              ? event.target
                  .value === ""
                ? undefined
                : Number(
                    event.target
                      .value
                  )
              : event.target
                  .value
          )
        }
      />
    </label>
  );

  const exportReport = () => {
    const url =
      URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              data,
              null,
              2
            ),
          ],
          {
            type:
              "application/json",
          }
        )
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href = url;

    anchor.download =
      "tengacion-external-readiness.json";

    anchor.click();

    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell
      user={user}
      title="External readiness"
      subtitle="Audit follow-through, certification, institutional governance and capital preparation"
    >
      <div className="readiness-workspace">
        {error && (
          <p role="alert">
            {error}
          </p>
        )}

        {notice && (
          <p role="status">
            {notice}
          </p>
        )}

        {!data ? (
          <p>
            Loading readiness
            inventory...
          </p>
        ) : (
          <>
            <section>
              <h2>
                Operating report
              </h2>

              <p>
                {
                  data.summary
                    .packageCount
                }{" "}
                packages ·{" "}
                {
                  data.summary
                    .records
                }{" "}
                records ·{" "}
                {
                  data.summary
                    .readyRecords
                }{" "}
                ready ·{" "}
                {
                  data.summary
                    .alerts
                }{" "}
                alerts
              </p>

              <p>
                {label(
                  data.summary
                    .decision
                )}
                . Readiness
                requires current
                evidence and
                independent
                review.
              </p>

              <p>
                {
                  data.limits
                    .scope
                }

                {data.limits
                  .truncated
                  ? ". This report is incomplete because the inventory exceeds its display limits."
                  : ""}
              </p>

              <button
                type="button"
                onClick={
                  exportReport
                }
              >
                Download internal
                report
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  act(
                    load,
                    "Inventory refreshed"
                  )
                }
              >
                Refresh
              </button>

              <details>
                <summary>
                  Review calendar
                  and alerts
                </summary>

                {data.calendar.map(
                  (record) => (
                    <p
                      key={
                        record.id
                      }
                    >
                      {
                        record.title
                      }
                      :{" "}
                      {new Date(
                        record.dueAt
                      ).toLocaleString()}
                      {" ("}
                      {
                        record.cadence
                      }
                      {")"}
                    </p>
                  )
                )}

                {data.alerts.map(
                  (
                    alert,
                    index
                  ) => (
                    <p
                      key={index}
                    >
                      {label(
                        alert.type
                      )}{" "}
                      ·{" "}
                      {
                        alert.recordId
                      }
                    </p>
                  )
                )}

                {!data.calendar
                  .length && (
                  <p>
                    No reviews
                    scheduled.
                  </p>
                )}
              </details>
            </section>

            <section>
              <h2>
                Package workspace
              </h2>

              <label>
                Roadmap package

                <select
                  value={key}
                  onChange={(
                    event
                  ) => {
                    setKey(
                      event.target
                        .value
                    );

                    setSelected(
                      null
                    );

                    setDraft(
                      fresh(user)
                    );

                    setReason("");
                    setNotes("");
                  }}
                >
                  {data.packages.map(
                    (
                      packageSpec
                    ) => (
                      <option
                        key={
                          packageSpec.key
                        }
                        value={
                          packageSpec.key
                        }
                      >
                        {
                          packageSpec.key
                        }
                        :{" "}
                        {
                          packageSpec.title
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <p>
                {spec?.operationalStatus ===
                "reviewed_records_available"
                  ? "Reviewed records available"
                  : "Evidence needed"}
              </p>

              <details>
                <summary>
                  Acceptance
                  criteria
                </summary>

                <ul>
                  {spec?.acceptanceCriteria.map(
                    (
                      criterion
                    ) => (
                      <li
                        key={
                          criterion
                        }
                      >
                        {
                          criterion
                        }
                      </li>
                    )
                  )}
                </ul>
              </details>

              {data.records
                .filter(
                  (record) =>
                    record.packageKey ===
                    key
                )
                .map(
                  (record) => (
                    <article
                      key={
                        record.id
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          edit(record)
                        }
                      >
                        {
                          record.title
                        }
                      </button>

                      <p>
                        {label(
                          record.status
                        )}{" "}
                        ·{" "}
                        {label(
                          record.readiness
                        )}
                      </p>

                      <p>
                        {record.blockers
                          .map(label)
                          .join(
                            "; "
                          )}
                      </p>

                      {record.financialSummary && (
                        <p>
                          Runway:{" "}
                          {record
                            .financialSummary
                            .runwayMonths ??
                            "unavailable"}{" "}
                          months ·{" "}
                          {label(
                            record
                              .financialSummary
                              .confidence
                          )}
                        </p>
                      )}

                      {record.capitalBlockerAnalysis && (
                        <p>
                          CAPITAL-010:{" "}
                          {label(
                            record
                              .capitalBlockerAnalysis
                              .category ||
                              "unassigned"
                          )}{" "}
                          ·{" "}
                          {label(
                            record
                              .capitalBlockerAnalysis
                              .resolution ||
                              "unassigned"
                          )}{" "}
                          ·{" "}
                          {label(
                            record
                              .capitalBlockerAnalysis
                              .state
                          )}
                        </p>
                      )}
                    </article>
                  )
                )}

              <button
                type="button"
                onClick={() => {
                  setSelected(
                    null
                  );

                  setDraft(
                    fresh(user)
                  );

                  setReason("");
                  setNotes("");
                }}
              >
                New record
              </button>

              <form
                onSubmit={(
                  event
                ) => {
                  event.preventDefault();

                  act(
                    () =>
                      send(
                        selected
                          ? `/records/${
                              selected.id ||
                              selected._id
                            }`
                          : "/records",

                        {
                          ...draft,
                          packageKey:
                            key,
                          reason,

                          ...(selected
                            ? {
                                version:
                                  selected.__v,
                              }
                            : {}),
                        },

                        selected
                          ? "PATCH"
                          : "POST"
                      ),

                    "Draft saved; evidence must be attested and reviewed."
                  );
                }}
              >
                <fieldset
                  disabled={busy}
                >
                  <legend>
                    {selected
                      ? "Revise record"
                      : "Create record"}
                  </legend>

                  <div className="readiness-grid">
                    {textField(
                      "title"
                    )}

                    {textField(
                      "owner"
                    )}

                    <label>
                      Audit domain

                      <select
                        value={
                          draft.domain
                        }
                        onChange={(
                          event
                        ) =>
                          set(
                            "domain",
                            event
                              .target
                              .value
                          )
                        }
                      >
                        {data.domains.map(
                          (
                            domain
                          ) => (
                            <option
                              key={
                                domain
                              }
                            >
                              {
                                domain
                              }
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    {[
                      "dueAt",
                      "expiresAt",
                    ].map(
                      (field) => (
                        <label
                          key={
                            field
                          }
                        >
                          {label(
                            field
                          )}{" "}
                          (UTC)

                          <input
                            required
                            type="datetime-local"
                            value={dateInput(
                              draft[
                                field
                              ]
                            )}
                            onChange={(
                              event
                            ) =>
                              set(
                                field,
                                event
                                  .target
                                  .value
                                  ? `${event.target.value}:00.000Z`
                                  : ""
                              )
                            }
                          />
                        </label>
                      )
                    )}

                    <label>
                      Cadence

                      <select
                        value={
                          draft.cadence ||
                          "once"
                        }
                        onChange={(
                          event
                        ) =>
                          set(
                            "cadence",
                            event
                              .target
                              .value
                          )
                        }
                      >
                        {[
                          "once",
                          "monthly",
                          "quarterly",
                          "semiannual",
                          "annual",
                          "post_incident",
                        ].map(
                          (
                            cadence
                          ) => (
                            <option
                              key={
                                cadence
                              }
                            >
                              {
                                cadence
                              }
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      Audience

                      <select
                        value={
                          draft.audience
                        }
                        onChange={(
                          event
                        ) =>
                          set(
                            "audience",
                            event
                              .target
                              .value
                          )
                        }
                      >
                        {[
                          "internal",
                          "partner",
                          "investor",
                          "assessor",
                          "advisor",
                          "public",
                        ].map(
                          (
                            audience
                          ) => (
                            <option
                              key={
                                audience
                              }
                            >
                              {
                                audience
                              }
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      Classification

                      <select
                        value={
                          draft.classification
                        }
                        onChange={(
                          event
                        ) =>
                          set(
                            "classification",
                            event
                              .target
                              .value
                          )
                        }
                      >
                        {[
                          "restricted",
                          "legal_security",
                          "sanitized",
                        ].map(
                          (
                            classification
                          ) => (
                            <option
                              key={
                                classification
                              }
                            >
                              {
                                classification
                              }
                            </option>
                          )
                        )}
                      </select>
                    </label>
                  </div>

                  {[
                    "scope",
                    "exclusions",
                    "publicSummary",
                    "withdrawalRule",
                    ...(
                      fieldsByKind[
                        spec?.kind
                      ] || []
                    ),
                  ].map(
                    (field) => (
                      <label
                        key={field}
                      >
                        {label(
                          field
                        )}

                        <textarea
                          value={
                            draft[
                              field
                            ] || ""
                          }
                          onChange={(
                            event
                          ) =>
                            set(
                              field,
                              event
                                .target
                                .value
                            )
                          }
                        />
                      </label>
                    )
                  )}

                  {[
                    "dependencies",
                    "findingIds",
                    "relatedControlKeys",
                  ].map(
                    (field) => (
                      <label
                        key={field}
                      >
                        {label(
                          field
                        )}{" "}
                        (one per
                        line)

                        <textarea
                          value={(
                            draft[
                              field
                            ] || []
                          ).join(
                            "\n"
                          )}
                          onChange={(
                            event
                          ) =>
                            set(
                              field,
                              event
                                .target
                                .value
                                .split(
                                  "\n"
                                )
                            )
                          }
                          onBlur={() =>
                            set(
                              field,
                              cleanLines(
                                draft[
                                  field
                                ]
                              )
                            )
                          }
                        />
                      </label>
                    )
                  )}

                  {key !==
                    "CAPITAL-010" &&
                    Object.entries(
                      groupsByKind[
                        spec?.kind
                      ] || {}
                    ).map(
                      ([
                        group,
                        fields,
                      ]) => (
                        <fieldset
                          key={
                            group
                          }
                        >
                          <legend>
                            {label(
                              group
                            )}
                          </legend>

                          {group ===
                            "risk" && (
                            <label>
                              Severity

                              <select
                                value={
                                  draft
                                    .risk
                                    ?.severity ||
                                  "medium"
                                }
                                onChange={(
                                  event
                                ) =>
                                  set(
                                    "risk",
                                    {
                                      ...draft.risk,
                                      severity:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                              >
                                {[
                                  "low",
                                  "medium",
                                  "high",
                                  "critical",
                                ].map(
                                  (
                                    severity
                                  ) => (
                                    <option
                                      key={
                                        severity
                                      }
                                    >
                                      {
                                        severity
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            </label>
                          )}

                          {fields.map(
                            (
                              field
                            ) =>
                              textField(
                                field,
                                draft[
                                  group
                                ],
                                (
                                  changedField,
                                  value
                                ) =>
                                  set(
                                    group,
                                    {
                                      ...draft[
                                        group
                                      ],
                                      [changedField]:
                                        value,
                                    }
                                  ),
                                numeric.has(
                                  field
                                )
                                  ? "number"
                                  : "text"
                              )
                          )}
                        </fieldset>
                      )
                    )}

                  {spec?.kind ===
                    "financial" && (
                    <fieldset>
                      <legend>
                        Financial
                        scenario
                      </legend>

                      <p>
                        Use monthly
                        amounts in
                        one currency
                        and a
                        YYYY-MM
                        period.
                        Platform
                        revenue
                        already
                        includes
                        subscription
                        and partner
                        revenue.
                      </p>

                      <label>
                        Scenario

                        <select
                          value={
                            draft
                              .financial
                              ?.scenario ||
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            set(
                              "financial",
                              {
                                ...draft.financial,
                                scenario:
                                  event
                                    .target
                                    .value,
                              }
                            )
                          }
                        >
                          <option value="">
                            Select
                          </option>

                          {[
                            "conservative",
                            "base",
                            "upside",
                            "downside",
                          ].map(
                            (
                              scenario
                            ) => (
                              <option
                                key={
                                  scenario
                                }
                              >
                                {
                                  scenario
                                }
                              </option>
                            )
                          )}
                        </select>
                      </label>

                      {textField(
                        "currency",
                        draft.financial,
                        (
                          field,
                          value
                        ) =>
                          set(
                            "financial",
                            {
                              ...draft.financial,
                              [field]:
                                value,
                            }
                          )
                      )}

                      {data.financialKeys.map(
                        (
                          financialKey
                        ) => {
                          const input =
                            draft.financial
                              ?.inputs
                              ?.find(
                                (
                                  entry
                                ) =>
                                  entry.key ===
                                  financialKey
                              ) || {
                              key:
                                financialKey,
                            };

                          const change = (
                            field,
                            value
                          ) =>
                            set(
                              "financial",
                              {
                                ...draft.financial,

                                inputs: [
                                  ...(
                                    draft
                                      .financial
                                      ?.inputs ||
                                    []
                                  ).filter(
                                    (
                                      entry
                                    ) =>
                                      entry.key !==
                                      financialKey
                                  ),

                                  {
                                    ...input,
                                    [field]:
                                      value,
                                  },
                                ],
                              }
                            );

                          return (
                            <fieldset
                              key={
                                financialKey
                              }
                            >
                              <legend>
                                {label(
                                  financialKey
                                )}
                              </legend>

                              {[
                                "value",
                                "source",
                                "period",
                              ].map(
                                (
                                  field
                                ) =>
                                  textField(
                                    field,
                                    input,
                                    change,
                                    field ===
                                      "value"
                                      ? "number"
                                      : "text"
                                  )
                              )}

                              <label>
                                Confidence

                                <select
                                  value={
                                    input.confidence ||
                                    ""
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    change(
                                      "confidence",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                >
                                  <option value="">
                                    Select
                                  </option>

                                  {[
                                    "actual",
                                    "estimated",
                                    "assumption",
                                    "disputed",
                                    "not_approved_external",
                                  ].map(
                                    (
                                      confidence
                                    ) => (
                                      <option
                                        key={
                                          confidence
                                        }
                                      >
                                        {
                                          confidence
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              </label>
                            </fieldset>
                          );
                        }
                      )}
                    </fieldset>
                  )}

                  {key ===
                    "CAPITAL-009" && (
                    <UnitEconomicsWorkspace
                      value={
                        draft.unitEconomics
                      }
                      onChange={(
                        value
                      ) =>
                        set(
                          "unitEconomics",
                          value
                        )
                      }
                      config={
                        data.unitEconomicsConfig
                      }
                      evidence={
                        draft.evidence
                      }
                      defaultOwner={
                        draft.owner
                      }
                      analysis={
                        selected?.unitEconomicsAnalysis
                      }
                      dirty={
                        economicsDirty
                      }
                    />
                  )}

                  {key ===
                    "CAPITAL-010" && (
                    <CapitalBlockerWorkspace
                      value={
                        draft.capitalBlocker
                      }
                      onChange={(
                        value
                      ) =>
                        set(
                          "capitalBlocker",
                          value
                        )
                      }
                      config={
                        data.capitalBlockerConfig
                      }
                      evidence={
                        draft.evidence ||
                        []
                      }
                      risk={
                        draft.risk ||
                        {}
                      }
                      onRiskChange={(
                        value
                      ) =>
                        set(
                          "risk",
                          value
                        )
                      }
                      records={
                        data.records
                      }
                      analysis={
                        selected?.capitalBlockerAnalysis
                      }
                      dirty={
                        capitalBlockerDirty
                      }
                    />
                  )}

                  {key === "CAPITAL-011" && (
                    <CapitalPathDecisionWorkspace
                      value={draft.capitalPathDecision}
                      onChange={(value) => set("capitalPathDecision", value)}
                      config={data.capitalPathConfig}
                      evidence={draft.evidence || []}
                      analysis={selected?.capitalPathAnalysis}
                      dirty={capitalPathDirty}
                    />
                  )}

                  <h3>
                    Evidence
                  </h3>

                  {(
                    draft.evidence ||
                    []
                  ).map(
                    (
                      evidenceEntry,
                      index
                    ) => {
                      const change = (
                        field,
                        value
                      ) =>
                        set(
                          "evidence",
                          (
                            draft.evidence ||
                            []
                          ).map(
                            (
                              entry,
                              entryIndex
                            ) =>
                              entryIndex ===
                              index
                                ? {
                                    ...entry,
                                    [field]:
                                      value,
                                  }
                                : entry
                          )
                        );

                      return (
                        <fieldset
                          key={
                            index
                          }
                        >
                          <legend>
                            Evidence{" "}
                            {index +
                              1}
                          </legend>

                          {[
                            "source",
                            "summary",
                          ].map(
                            (
                              field
                            ) =>
                              textField(
                                field,
                                evidenceEntry,
                                change
                              )
                          )}

                          {[
                            "observedAt",
                            "expiresAt",
                          ].map(
                            (
                              field
                            ) => (
                              <label
                                key={
                                  field
                                }
                              >
                                {label(
                                  field
                                )}{" "}
                                (UTC)

                                <input
                                  type="datetime-local"
                                  value={dateInput(
                                    evidenceEntry[
                                      field
                                    ]
                                  )}
                                  onChange={(
                                    event
                                  ) =>
                                    change(
                                      field,
                                      event
                                        .target
                                        .value
                                        ? `${event.target.value}:00.000Z`
                                        : ""
                                    )
                                  }
                                />
                              </label>
                            )
                          )}

                          <label>
                            Confidence

                            <select
                              value={
                                evidenceEntry.confidence ||
                                "incomplete"
                              }
                              onChange={(
                                event
                              ) =>
                                change(
                                  "confidence",
                                  event
                                    .target
                                    .value
                                )
                              }
                            >
                              {[
                                "incomplete",
                                "current",
                                "estimated",
                                "disputed",
                              ].map(
                                (
                                  confidence
                                ) => (
                                  <option
                                    key={
                                      confidence
                                    }
                                  >
                                    {
                                      confidence
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                        </fieldset>
                      );
                    }
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "evidence",
                        [
                          ...(
                            draft.evidence ||
                            []
                          ),

                          {
                            source: "",
                            summary: "",
                            confidence:
                              "incomplete",
                          },
                        ]
                      )
                    }
                  >
                    Add evidence
                  </button>

                  <h3>
                    Requirement
                    responses
                  </h3>

                  {spec?.requirements.map(
                    (
                      requirement,
                      index
                    ) => {
                      if (
                        requirement.endsWith(
                          ":"
                        )
                      ) {
                        return (
                          <h4
                            key={
                              index
                            }
                          >
                            {
                              requirement
                            }
                          </h4>
                        );
                      }

                      const response =
                        (
                          draft.responses ||
                          []
                        ).find(
                          (
                            entry
                          ) =>
                            entry.index ===
                            index
                        ) || {
                          index,
                          response: "",
                          evidenceIndexes:
                            [],
                        };

                      const change = (
                        field,
                        value
                      ) =>
                        set(
                          "responses",
                          [
                            ...(
                              draft.responses ||
                              []
                            ).filter(
                              (
                                entry
                              ) =>
                                entry.index !==
                                index
                            ),

                            {
                              ...response,
                              [field]:
                                value,
                            },
                          ]
                        );

                      return (
                        <fieldset
                          key={
                            index
                          }
                        >
                          <legend>
                            {
                              requirement
                            }
                          </legend>

                          <label>
                            Response

                            <textarea
                              value={
                                response.response
                              }
                              onChange={(
                                event
                              ) =>
                                change(
                                  "response",
                                  event
                                    .target
                                    .value
                                )
                              }
                            />
                          </label>

                          {(
                            draft.evidence ||
                            []
                          ).map(
                            (
                              _,
                              evidenceIndex
                            ) => (
                              <label
                                key={
                                  evidenceIndex
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={response.evidenceIndexes.includes(
                                    evidenceIndex
                                  )}
                                  onChange={(
                                    event
                                  ) =>
                                    change(
                                      "evidenceIndexes",
                                      event
                                        .target
                                        .checked
                                        ? [
                                            ...response.evidenceIndexes,
                                            evidenceIndex,
                                          ]
                                        : response.evidenceIndexes.filter(
                                            (
                                              entry
                                            ) =>
                                              entry !==
                                              evidenceIndex
                                          )
                                    )
                                  }
                                />

                                Evidence{" "}
                                {evidenceIndex +
                                  1}
                              </label>
                            )
                          )}
                        </fieldset>
                      );
                    }
                  )}

                  <label>
                    Reason for this
                    action

                    <input
                      required
                      maxLength={
                        1000
                      }
                      value={
                        reason
                      }
                      onChange={(
                        event
                      ) =>
                        setReason(
                          event.target
                            .value
                        )
                      }
                    />
                  </label>

                  <button type="submit">
                    Save draft
                  </button>
                </fieldset>
              </form>

              {selected && (
                <fieldset
                  disabled={busy}
                >
                  <legend>
                    Review saved
                    version{" "}
                    {
                      selected.__v
                    }
                  </legend>

                  <p>
                    These actions
                    use the saved
                    record. Save
                    any edits
                    first.
                  </p>

                  {governanceDirty && (
                    <p role="status">
                      Unsaved
                      CAPITAL-009
                      or CAPITAL-010 or CAPITAL-011
                      governance
                      changes must be
                      saved before
                      review actions
                      are enabled.
                    </p>
                  )}

                  <label>
                    Reviewer notes

                    <textarea
                      value={
                        notes
                      }
                      onChange={(
                        event
                      ) =>
                        setNotes(
                          event.target
                            .value
                        )
                      }
                    />
                  </label>

                  {[
                    "attest",
                    "submit",
                    "approve",
                    "request_changes",
                    "withdraw",
                  ].map(
                    (action) => (
                      <button
                        key={
                          action
                        }
                        type="button"
                        disabled={
                          !reason.trim() ||
                          governanceDirty
                        }
                        onClick={() =>
                          act(
                            () =>
                              send(
                                `/records/${
                                  selected.id ||
                                  selected._id
                                }/transitions`,

                                {
                                  action,
                                  reason,
                                  notes,
                                  version:
                                    selected.__v,

                                  outcome:
                                    action ===
                                    "approve"
                                      ? "pass"
                                      : "not_observed",
                                }
                              ),

                            "Review action recorded"
                          )
                        }
                      >
                        {label(
                          action
                        )}
                      </button>
                    )
                  )}

                  <h3>
                    Recipient access
                  </h3>

                  <label>
                    Recipient
                    account ID

                    <input
                      value={
                        recipient
                      }
                      onChange={(
                        event
                      ) =>
                        setRecipient(
                          event.target
                            .value
                        )
                      }
                    />
                  </label>

                  <label>
                    Share expires
                    (UTC)

                    <input
                      type="datetime-local"
                      value={
                        shareExpiry
                      }
                      onChange={(
                        event
                      ) =>
                        setShareExpiry(
                          event.target
                            .value
                        )
                      }
                    />
                  </label>

                  <button
                    type="button"
                    disabled={
                      !recipient ||
                      !shareExpiry ||
                      !reason.trim()
                    }
                    onClick={() =>
                      act(
                        () =>
                          send(
                            `/records/${
                              selected.id ||
                              selected._id
                            }/shares`,

                            {
                              recipient,
                              expiresAt:
                                `${shareExpiry}:00.000Z`,
                              reason,
                              version:
                                selected.__v,
                            }
                          ),

                        "Recipient access created. Copy the packet link below to share it."
                      )
                    }
                  >
                    Create recipient
                    access
                  </button>
                </fieldset>
              )}
            </section>

            <section>
              <h2>
                Shared packets
              </h2>

              {!data.shares
                .length && (
                <p>
                  No recipient
                  access granted.
                </p>
              )}

              {data.shares.map(
                (share) => (
                  <article
                    key={
                      share._id
                    }
                  >
                    <a
                      href={`/readiness/packets/${share._id}`}
                    >
                      Packet{" "}
                      {share._id}
                    </a>

                    <p>
                      Recipient:{" "}
                      {
                        share.recipient
                      }{" "}
                      ·{" "}
                      {share.revokedAt
                        ? "Revoked"
                        : `Expires ${new Date(
                            share.expiresAt
                          ).toLocaleString()}`}
                    </p>

                    <button
                      type="button"
                      disabled={
                        busy ||
                        !!share.revokedAt ||
                        !reason.trim()
                      }
                      onClick={() =>
                        act(
                          () =>
                            send(
                              `/shares/${share._id}/revoke`,
                              {
                                reason,
                              }
                            ),

                          "Access revoked"
                        )
                      }
                    >
                      Revoke access
                    </button>
                  </article>
                )
              )}
            </section>

            <section>
              <h2>
                Diligence
                questions
              </h2>

              {!data.questions
                .length && (
                <p>
                  No questions
                  received.
                </p>
              )}

              {data.questions.map(
                (question) => (
                  <fieldset
                    key={
                      question._id
                    }
                    disabled={busy}
                  >
                    <legend>
                      {
                        question.question
                      }
                    </legend>

                    <p>
                      {label(
                        question.status
                      )}{" "}
                      · Due{" "}
                      {new Date(
                        question.dueAt
                      ).toLocaleString()}
                    </p>

                    <label>
                      Response

                      <textarea
                        value={
                          answers[
                            question
                              ._id
                          ] ??
                          question.response
                        }
                        onChange={(
                          event
                        ) =>
                          setAnswers(
                            {
                              ...answers,

                              [question._id]:
                                event
                                  .target
                                  .value,
                            }
                          )
                        }
                      />
                    </label>

                    {[
                      "draft",
                      "approve",
                      "close",
                    ].map(
                      (action) => (
                        <button
                          key={
                            action
                          }
                          type="button"
                          disabled={
                            !reason.trim()
                          }
                          onClick={() =>
                            act(
                              () =>
                                send(
                                  `/questions/${question._id}`,

                                  {
                                    action,

                                    response:
                                      answers[
                                        question
                                          ._id
                                      ] ??
                                      question.response,

                                    version:
                                      question.__v,

                                    reason,
                                  }
                                ),

                              "Question updated"
                            )
                          }
                        >
                          {label(
                            action
                          )}
                        </button>
                      )
                    )}
                  </fieldset>
                )
              )}
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}